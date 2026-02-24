import { JetstreamSubscription } from '@atcute/jetstream';
import fs from 'node:fs';
import ws from 'ws';

import { CURSOR_UPDATE_INTERVAL, DB_PATH, DID, FIREHOSE_URL } from './config.js';
import { labelPost } from './backend/label.js';
import logger from './backend/logger.js';

import { access, readFile } from 'node:fs/promises';
import { getDbConfigItem, setDbConfigItem } from './utils/db-config.js';
import { createDb,migrateToLatest } from './backend/kysely/index.js';
import { is } from '@atcute/lexicons';
import { AppBskyFeedLike, AppBskyFeedPost, AppBskyGraphFollow } from '@atcute/bluesky';

const db = createDb(DB_PATH);

await migrateToLatest(db);

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

if (process.argv.includes('--reset-cursor')) {
    // for testing purposes, to reprocess all events from the firehose
    cursor = Math.floor(Date.now() * 1000);
    logger.info(`Resetting cursor to: ${cursor} (${epochUsToDateTime(cursor)})`);
    await setDbConfigItem('jetstreamCursor', cursor);
}

if (process.argv.includes('--start-early')) {
    // start from 24 hours ago, to label some existing posts
    let date = new Date();
    date.setDate(date.getDate() - 1);
    cursor = Math.floor(date.getTime() * 1000);
}

let labelAnything = false;
if (process.argv.includes('--label-anything')) {
    // for testing purposes, to label any post that comes in, regardless of whether the author is a follower or liker
    labelAnything = true;
    logger.info('Labeling anything that comes in, regardless of followers/likers');
}

const jetstream = new JetstreamSubscription({
    wantedCollections: [
        'app.bsky.feed.post',
        'app.bsky.graph.follow',
        'app.bsky.feed.like',
    ],
    url: FIREHOSE_URL,
    cursor: cursor
});

logger.info(`Connected to Jetstream at ${FIREHOSE_URL} with cursor ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor!)})`);
cursorUpdateInterval = setInterval(() => {
    if (jetstream.cursor) {
        logger.info(`Cursor updated to: ${jetstream.cursor} (${epochUsToDateTime(jetstream.cursor)})`);
        setDbConfigItem('jetstreamCursor', jetstream.cursor);

        const delay = Date.now() * 1000 - jetstream.cursor;
        logger.info(`Current delay: ${(delay / 1000).toFixed(2)} seconds`);
    }
}, CURSOR_UPDATE_INTERVAL);

let stopped = false;

for await (const event of jetstream) {
    if (stopped) {
        break;
    }

    if (event.kind === 'commit') {
        const did = event.did;
		const commit = event.commit;
        const rkey = commit.rkey;

        if (commit.operation === 'create') {
            const cid = commit.cid;
            const record = commit.record;
            
            if (commit.collection === 'app.bsky.graph.follow') {
                if (!is(AppBskyGraphFollow.mainSchema, record)) {
                    logger.warn(`Received invalid follow record: at://${did}/app.bsky.graph.follow/${rkey}`);
                    continue;
                }

                // const uri = `at://${did}/app.bsky.graph.follow/${rkey}`;
                if (record.subject === DID) {
                    logger.debug(`Followed by ${did}`);
                    await db
                        .insertInto('followers')
                        .values({ did, rkey })
                        .onConflict((oc) => oc.column('did').doUpdateSet({ rkey }))
                        .execute()
                        .catch((error: unknown) => {
                            logger.error(`Unexpected error inserting follower ${did}: ${error}`);
                        });

                    // this.emit("follow", { user: await bot.getProfile(did), uri });
                }
            }

            if (commit.collection === 'app.bsky.feed.like') {
                if (!is(AppBskyFeedLike.mainSchema, record)) {
                    logger.warn(`Received invalid like record: at://${did}/app.bsky.feed.like/${rkey}`);
                    continue;
                }
                
                if (record.subject.uri == `at://${DID}/app.bsky.labeler.service/self`) {
                    logger.debug(`Liked by ${did}`);

                    await db
                        .insertInto('likers')
                        .values({ did, rkey })
                        .onConflict((oc) => oc.column('did').doUpdateSet({ rkey }))
                        .execute()
                        .catch((error: unknown) => {
                            logger.error(`Unexpected error inserting liker ${did}: ${error}`);
                        });
                }

                await db
                    .selectFrom('followers')
                    .selectAll()
                    .unionAll((eb) =>
                        eb
                            .selectFrom('likers')
                            .selectAll()
                    )
                    .where('did', '=', did)
                    .executeTakeFirst()
                    .then(async result => {
                        if (result) {
                            await labelPost(record.subject.uri).catch((error: unknown) => {
                                logger.error(error, `Unexpected error labeling ${record.subject.uri}: ${error}`);
                            });
                        }
                    });
            }

            if (commit.collection === 'app.bsky.feed.post') {
                if (!is(AppBskyFeedPost.mainSchema, record)) {
                    logger.warn(`Received invalid post record: at://${did}/app.bsky.feed.post/${rkey}`);
                    continue;
                }
                
                const uri = `at://${did}/app.bsky.feed.post/${rkey}`;

                await db
                    .selectFrom('followers')
                    .selectAll()
                    .unionAll((eb) =>
                        eb
                            .selectFrom('likers')
                            .selectAll()
                    )
                    .where('did', '=', did)
                    .executeTakeFirst()
                    .then(async result => {
                        if (result || labelAnything) {
                            await labelPost({
                                ...record,
                                uri,
                                cid
                            }).catch((error: unknown) => {
                                logger.error(error, `Unexpected error labeling ${uri}: ${error}`);
                            });
                        }
                    });
            }
        } else if (commit.operation === 'delete') {
            if (commit.collection === 'app.bsky.graph.follow') {
                await db
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
            }

            if (commit.collection === 'app.bsky.feed.like') {
                await db
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
            }
        }
    }
}

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        fs.writeFileSync('cursor.txt', jetstream.cursor!.toString(), 'utf8');
        clearInterval(cursorUpdateInterval);
        stopped = true;
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
