import { CommitCreateEvent, Jetstream } from '@skyware/jetstream';
import fs from 'node:fs';

import { CURSOR_UPDATE_INTERVAL, FIREHOSE_URL, METRICS_PORT, PORT } from './config.js';
import { label, labelerServer, labelPost } from './label.js';
import logger from './logger.js';
import { startMetricsServer } from './metrics.js';

import { set, table } from './lmdb.js';
import { bot } from './bot.js';
import { Facet, Post, PostEmbed, postEmbedFromView } from '@skyware/bot';

let cursor = 0;
let cursorUpdateInterval: NodeJS.Timeout;

function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}

try {
    logger.info('Trying to read cursor from cursor.txt...');
    cursor = Number(fs.readFileSync('cursor.txt', 'utf8'));
    logger.info(`Cursor found: ${cursor} (${epochUsToDateTime(cursor)})`);
} catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        cursor = Math.floor(Date.now() * 1000);
        logger.info(`Cursor not found in cursor.txt, setting cursor to: ${cursor} (${epochUsToDateTime(cursor)})`);
        fs.writeFileSync('cursor.txt', cursor.toString(), 'utf8');
    } else {
        logger.error(error);
        process.exit(1);
    }
}

const jetstream = new Jetstream({
    wantedCollections: [
        'app.bsky.feed.post',
        'app.bsky.graph.follow',
        'app.bsky.feed.like',
    ],
    endpoint: FIREHOSE_URL,
    cursor: cursor,
});

jetstream.on('open', () => {
    logger.info(`Connected to Jetstream at ${FIREHOSE_URL} with cursor ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor!)})`);
    cursorUpdateInterval = setInterval(() => {
        if (jetstream.cursor) {
            logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
            fs.writeFile('cursor.txt', jetstream.cursor.toString(), (err) => {
                if (err) logger.error(err);
            });
        }
    }, CURSOR_UPDATE_INTERVAL);
});

jetstream.on('close', () => {
    clearInterval(cursorUpdateInterval);
    logger.info('Jetstream connection closed.');
});

jetstream.on('error', (error) => {
    logger.error(`Jetstream error: ${error.message}`);
});

const followers = set<string>('followers');
const followRecords = table<string, string>('follow-records', 'ordered-binary', 'string');
jetstream.onCreate('app.bsky.graph.follow', ({ commit: { record, rkey }, did }) => {
    // const uri = `at://${did}/app.bsky.graph.follow/${rkey}`;
    if (record.subject === bot.profile.did) {
        logger.debug(`Followed by ${did}`);
        followers.add(did);
        followRecords.put(rkey, did);

        // this.emit("follow", { user: await bot.getProfile(did), uri });
    }
});

// is this the only way to find out if the follow record is for myself?
jetstream.onDelete('app.bsky.graph.follow', ({ commit: { rkey }, did }) => {
    if (followRecords.doesExist(rkey)) {
        logger.debug(`Unfollowed by ${did}`);
        followers.delete(did);
        followRecords.remove(rkey);
    }
});

jetstream.onCreate('app.bsky.feed.like', async ({ commit: { record }, did }) => {
    if (followers.has(did)) {
        labelPost(record.subject.uri).catch((error: unknown) => {
            logger.error(`Unexpected error labeling ${record.subject.uri}: ${error}`);
        });

        // event.commit.record.subject.uri
        // label(event.did, event.commit.record.subject.uri.split('/').pop()!).catch((error: unknown) => {
        //     logger.error(`Unexpected error labeling ${event.did}: ${error}`);
        // });
    }
});

jetstream.onCreate('app.bsky.feed.post', async (event) => {
    const { commit, did } = event;
    const { record, cid, rkey } = commit;

    if (followers.has(did)) {
        labelPost({...record, uri: `at://${did}/app.bsky.feed.post/${rkey}`}).catch((error: unknown) => {
            logger.error(`Unexpected error labeling at://${did}/app.bsky.feed.post/${rkey}: ${error}`);
        });

        // event.commit.record.subject.uri
        // label(event.did, event.commit.record.subject.uri.split('/').pop()!).catch((error: unknown) => {
        //     logger.error(`Unexpected error labeling ${event.did}: ${error}`);
        // });
    }
});

const metricsServer = startMetricsServer(METRICS_PORT);

labelerServer.start(PORT, (error, address) => {
    if (error) {
        logger.error('Error starting server: %s', error);
    } else {
        logger.info(`Labeler server listening on ${address}`);
    }
});

jetstream.start();

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        fs.writeFileSync('cursor.txt', jetstream.cursor!.toString(), 'utf8');
        jetstream.close();
        labelerServer.stop();
        metricsServer.close();
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
