import { Jetstream } from '@skyware/jetstream';
import fs from 'node:fs';
import ws from 'ws';

import { CURSOR_UPDATE_INTERVAL, DID, FIREHOSE_URL } from './config.js';
import { labelPost } from './backend/label.js';
import logger from './backend/logger.js';

import { bot } from './backend/bot.js';
import { access, readFile } from 'node:fs/promises';
import { getDbConfigItem, setDbConfigItem } from './utils/db-config.js';
import { db } from './backend/lmdb.js';

let cursor = 0;
let cursorUpdateInterval: NodeJS.Timeout | Timer;

function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}

logger.info('Trying to read cursor from database...');
cursor = getDbConfigItem('jetstreamCursor');
if (!cursor) {
    logger.info('Cursor not found in database. trying to read from cursor.txt...');
    if (await access('cursor.txt').then(() => true).catch(() => false)) {
        cursor = Number(await readFile('cursor.txt', 'utf-8'))
        logger.info(`Cursor found: ${cursor} (${epochUsToDateTime(cursor)})`);
    } else {
        logger.info(`Cursor not found in database or cursor.txt, setting cursor to: ${cursor} (${epochUsToDateTime(cursor)})`);
        cursor = Math.floor(Date.now() * 1000);
    }
    await setDbConfigItem('jetstreamCursor', cursor);
} else {
    logger.info(`Cursor found: ${cursor} (${epochUsToDateTime(cursor)})`);
}

const jetstream = new Jetstream({
    wantedCollections: [
        'app.bsky.feed.post',
        'app.bsky.graph.follow',
        'app.bsky.feed.like',
    ],
    endpoint: FIREHOSE_URL,
    cursor: cursor,
    ws: typeof Bun === 'undefined' ? ws : undefined
});

jetstream.on('open', () => {
    logger.info(`Connected to Jetstream at ${FIREHOSE_URL} with cursor ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor!)})`);
    cursorUpdateInterval = setInterval(() => {
        if (jetstream.cursor) {
            logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
            setDbConfigItem('jetstreamCursor', jetstream.cursor);
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

const followers = db.set<string>('followers');
const likers = db.set<string>('likers');
const followRecords = db.table<string, string>('follow-records', 'ordered-binary', 'string');
const likeRecords = db.table<string, string>('like-records', 'ordered-binary', 'string');

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

jetstream.onCreate('app.bsky.feed.like', async ({ commit: { record, rkey }, did }) => {
    if (record.subject.uri == `at://${DID}/app.bsky.labeler.service/self`) {
        logger.debug(`Liked by ${did}`);
        likers.add(did);
        likeRecords.put(rkey, did);
    }

    if (followers.has(did) || likers.has(did)) {
        labelPost(record.subject.uri).catch((error: unknown) => {
            logger.error(`Unexpected error labeling ${record.subject.uri}: ${error}`);
            console.error(error);
        });

        // event.commit.record.subject.uri
        // label(event.did, event.commit.record.subject.uri.split('/').pop()!).catch((error: unknown) => {
        //     logger.error(`Unexpected error labeling ${event.did}: ${error}`);
        // });
    }
});

jetstream.onDelete('app.bsky.feed.like', async ({ commit: { rkey }, did }) => {
    if (likeRecords.doesExist(rkey)) {
        logger.debug(`Un-liked by ${did}`);
        likers.delete(did);
        likeRecords.remove(rkey);
    }
});

jetstream.onCreate('app.bsky.feed.post', async (event) => {
    const { commit, did } = event;
    const { record, cid, rkey } = commit;

    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;

    if (followers.has(did)) {
        labelPost(await bot.getPost(uri)).catch((error: unknown) => {
            logger.error(`Unexpected error labeling ${uri}: ${error}`);
        });

        // event.commit.record.subject.uri
        // label(event.did, event.commit.record.subject.uri.split('/').pop()!).catch((error: unknown) => {
        //     logger.error(`Unexpected error labeling ${event.did}: ${error}`);
        // });
    }
});

jetstream.start();
if (typeof Bun !== 'undefined')
    jetstream.ws!.binaryType = 'arraybuffer';

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        fs.writeFileSync('cursor.txt', jetstream.cursor!.toString(), 'utf8');
        jetstream.close();
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
