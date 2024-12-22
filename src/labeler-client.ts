import { Jetstream } from '@skyware/jetstream';
import fs from 'node:fs';
import ws from 'ws';

import { CURSOR_UPDATE_INTERVAL, DID, FIREHOSE_URL } from './config.js';
import { labelPost } from './backend/label.js';
import logger from './backend/logger.js';

import { bot } from './backend/bot.js';
import { access, readFile } from 'node:fs/promises';
import { db } from './backend/db.js';
import { config } from './utils/configs.js';

let cursor = 0;
let cursorUpdateInterval: NodeJS.Timeout | Timer;

function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}

const trackedUsers = await config.get('trackedUsers') ?? {followers: [], likers: []};

logger.info('Trying to track missing follows...');
{
    const { data: { followers } } = await bot.agent.get('app.bsky.graph.getFollowers', {
        params: {
            actor: DID,
            limit: 100,
        }
    });

    const { data: { likes } } = await bot.agent.get('app.bsky.feed.getLikes', {
        params: {
            uri: `at://${DID}/app.bsky.labeler.service/self`,
            limit: 100,
        }
    });

    for (const follower of followers) {
        if (!trackedUsers.followers.find(e => e.did == follower.did)) {
            trackedUsers.followers.push({
                rkey: null,
                did: follower.did,
            })
        }
    }

    for (const liker of likes) {
        if (!trackedUsers.likers.find(e => e.did == liker.actor.did)) {
            trackedUsers.likers.push({
                rkey: null,
                did: liker.actor.did,
            })
        }
    }
}

logger.info('Trying to read cursor from database...');
cursor = await config.get('jetstreamCursor') ?? 0;
if (!cursor) {
    logger.info(`Cursor not found in database, setting cursor to: ${cursor} (${epochUsToDateTime(cursor)})`);
    cursor = Math.floor(Date.now() * 1000);
    await config.set('jetstreamCursor', cursor);
} else {
    logger.info(`Cursor found: ${cursor} (${epochUsToDateTime(cursor)})`);
}

const jetstream = new Jetstream({
    wantedCollections: [
        'app.bsky.feed.post',
        'app.bsky.graph.follow',
        'app.bsky.feed.like',
        'app.bsky.feed.repost',
    ],
    endpoint: FIREHOSE_URL,
    cursor: cursor,
    ws: typeof Bun === 'undefined' ? ws : undefined
});

jetstream.on('open', () => {
    logger.info(`Connected to Jetstream at ${FIREHOSE_URL} with cursor ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor!)})`);
    cursorUpdateInterval = setInterval(async () => {
        if (jetstream.cursor) {
            logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
            await config.set('jetstreamCursor', jetstream.cursor);
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

jetstream.onCreate('app.bsky.graph.follow', async ({ commit: { record, rkey }, did }) => {
    // const uri = `at://${did}/app.bsky.graph.follow/${rkey}`;
    if (record.subject === bot.profile.did) {
        logger.debug(`Followed by ${did}`);
        
        const idx = trackedUsers.followers.findIndex(e => e.did === did);
        if (idx === -1) {
            trackedUsers.followers.push({rkey, did});
            await config.set('trackedUsers', trackedUsers);
        }
    }
});

// is this the only way to find out if the follow record is for myself?
jetstream.onDelete('app.bsky.graph.follow', async ({ commit: { rkey }, did }) => {
    const idx = trackedUsers.followers.findIndex(e => e.rkey == rkey);
    if (idx !== -1) {
        trackedUsers.followers.splice(idx, 1);
        await config.set('trackedUsers', trackedUsers);
    }
});

jetstream.onCreate('app.bsky.feed.like', async ({ commit: { record, rkey }, did }) => {
    if (record.subject.uri == `at://${DID}/app.bsky.labeler.service/self`) {
        logger.debug(`Liked by ${did}`);
        const idx = trackedUsers.likers.findIndex(e => e.did === did);
        if (idx === -1) {
            trackedUsers.likers.push({rkey, did});
            await config.set('trackedUsers', trackedUsers);
        }

        return;
    }

    if (
        trackedUsers.likers.find(e => e.did === did) ||
        trackedUsers.followers.find(e => e.did === did)
    ) {
        labelPost(record.subject.uri).catch((error: unknown) => {
            logger.error(`Unexpected error labeling ${record.subject.uri}: ${error}`);
            console.error(error);
        });
    }
});

jetstream.onDelete('app.bsky.feed.like', async ({ commit: { rkey }, did }) => {
    const idx = trackedUsers.likers.findIndex(e => e.rkey == rkey);
    if (idx !== -1) {
        trackedUsers.likers.splice(idx, 1);
        await config.set('trackedUsers', trackedUsers);
    }
});

jetstream.onCreate('app.bsky.feed.repost', ({ commit: { record, rkey }, did }) => {
    if (
        trackedUsers.likers.find(e => e.did === did) ||
        trackedUsers.followers.find(e => e.did === did)
    ) {
        labelPost(record.subject.uri).catch((error: unknown) => {
            logger.error(`Unexpected error labeling ${record.subject.uri}: ${error}`);
            console.error(error);
        });
    }
})

jetstream.onCreate('app.bsky.feed.post', async (event) => {
    const { commit, did } = event;
    const { record, cid, rkey } = commit;

    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;

    if (
        trackedUsers.likers.find(e => e.did === did) ||
        trackedUsers.followers.find(e => e.did === did)
    ) {
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
