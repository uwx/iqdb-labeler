import { Jetstream } from '@skyware/jetstream';
import fs from 'node:fs';
import ws from 'ws';

import { CURSOR_UPDATE_INTERVAL, DB_PATH, DID, FIREHOSE_URL } from './config.js';
import { labelPost } from './backend/label.js';
import logger from './backend/logger.js';

import { access, readFile } from 'node:fs/promises';
import { getDbConfigItem, setDbConfigItem } from './utils/db-config.js';
import { createDb } from './backend/kysely/index.js';

const db = createDb(DB_PATH);

let cursor = 0;
let cursorUpdateInterval: NodeJS.Timeout | Timer;

function epochUsToDateTime(cursor: number): string {
    return new Date(cursor / 1000).toISOString();
}

logger.info('Trying to read cursor from database...');
cursor = await getDbConfigItem('jetstreamCursor') ?? 0;
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

jetstream.onCreate('app.bsky.graph.follow', ({ commit: { record, rkey }, did }) => {
    // const uri = `at://${did}/app.bsky.graph.follow/${rkey}`;
    if (record.subject === DID) {
        logger.debug(`Followed by ${did}`);
        db
            .insertInto('followers')
            .values({ did, rkey })
            .onConflict((oc) => oc.column('did').doUpdateSet({ rkey }))
            .execute()
            .catch((error: unknown) => {
                logger.error(`Unexpected error inserting follower ${did}: ${error}`);
            });

        // this.emit("follow", { user: await bot.getProfile(did), uri });
    }
});

// is this the only way to find out if the follow record is for myself?
jetstream.onDelete('app.bsky.graph.follow', ({ commit: { rkey }, did }) => {
    db
        .deleteFrom('followers')
        .where('rkey', '=', rkey)
        .execute()
        .then((result) => {
            if (result[0].numDeletedRows > 0) {
                logger.debug(`Unfollowed by ${did}`);
            }
        })
        .catch((error: unknown) => {
            logger.error(`Unexpected error deleting follower ${did}: ${error}`);
        });
});

jetstream.onCreate('app.bsky.feed.like', async ({ commit: { record, rkey }, did }) => {
    if (record.subject.uri == `at://${DID}/app.bsky.labeler.service/self`) {
        logger.debug(`Liked by ${did}`);

        db
            .insertInto('likers')
            .values({ did, rkey })
            .onConflict((oc) => oc.column('did').doUpdateSet({ rkey }))
            .execute()
            .catch((error: unknown) => {
                logger.error(`Unexpected error inserting liker ${did}: ${error}`);
            });
    }

    db
        .selectFrom('followers')
        .selectAll()
        .unionAll((eb) =>
            eb
                .selectFrom('likers')
                .selectAll()
        )
        .where('did', '=', did)
        .executeTakeFirst()
        .then(result => {
            if (result) {
                labelPost(record.subject.uri).catch((error: unknown) => {
                    logger.error(`Unexpected error labeling ${record.subject.uri}: ${error}`);
                });
            }
        });
});

jetstream.onDelete('app.bsky.feed.like', async ({ commit: { rkey }, did }) => {
    db
        .deleteFrom('likers')
        .where('rkey', '=', rkey)
        .execute()
        .then((result) => {
            if (result[0].numDeletedRows > 0) {
                logger.debug(`Un-liked by ${did}`);
            }
        })
        .catch((error: unknown) => {
            logger.error(`Unexpected error deleting liker ${did}: ${error}`);
        });
});

jetstream.onCreate('app.bsky.feed.post', async (event) => {
    const { commit, did } = event;
    const { record, cid, rkey } = commit;

    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;

    db
        .selectFrom('followers')
        .selectAll()
        .unionAll((eb) =>
            eb
                .selectFrom('likers')
                .selectAll()
        )
        .where('did', '=', did)
        .executeTakeFirst()
        .then(result => {
            if (result) {
                labelPost({
                    ...record,
                    uri,
                    cid
                }).catch((error: unknown) => {
                    logger.error(`Unexpected error labeling ${uri}: ${error}`);
                });
            }
        });
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
