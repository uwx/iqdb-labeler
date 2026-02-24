import { JetstreamSubscription } from '@atcute/jetstream';
import fs from 'node:fs';
import type { BlueMicrocosmLinksGetBacklinks } from './lexicons/index.js';

import { CURSOR_UPDATE_INTERVAL, DB_PATH, DID, FIREHOSE_URL } from './config.js';
import { labelPost } from './backend/label.js';
import logger from './backend/logger.js';

import { access, readFile } from 'node:fs/promises';
import { getDbConfigItem, setDbConfigItem } from './utils/db-config.js';
import { createDb,migrateToLatest } from './backend/kysely/index.js';
import { is } from '@atcute/lexicons';
import { AppBskyFeedLike, AppBskyFeedPost, AppBskyGraphFollow } from '@atcute/bluesky';
import { KittyAgent } from 'kitty-agent';
import { ClientResponse } from '@atcute/client';

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

logger.info('Hydrating followers and likers into database...');
{
    const agent = KittyAgent.createAppview('https://constellation.microcosm.blue/');

    // followers
    {
        let cursor: string | undefined = undefined;
        do {
            const response: ClientResponse<BlueMicrocosmLinksGetBacklinks.mainSchema, { params: { subject: `did:${string}:${string}`; source: string; }; }> = await agent.get('blue.microcosm.links.getBacklinks', {
                params: {
                    subject: DID,
                    source: 'app.bsky.graph.follow:subject',
                    cursor: cursor,
                }
            });

            if (!response.ok) {
                logger.error(response.data, `Failed to fetch followers: ${response.status}`);
                break;
            } else {
                const followers = response.data.records.map(link => ({ did: link.did, rkey: link.rkey }));
                if (followers.length > 0) {
                    await db
                        .insertInto('followers')
                        .values(followers)
                        .onConflict((oc) => oc.column('did').doUpdateSet(eb => ({ rkey: eb.ref('excluded.rkey') })))
                        .execute()
                        .catch((error: unknown) => {
                            logger.error(`Unexpected error inserting followers: ${error}`);
                        });
                }
                cursor = response.data.cursor;
            }
        } while (cursor);
    }

    // likers
    {
        let cursor: string | undefined = undefined;
        do {
            const response: ClientResponse<BlueMicrocosmLinksGetBacklinks.mainSchema, { params: { subject: `at://${string}/app.bsky.labeler.service/self`; source: string; }; }> = await agent.get('blue.microcosm.links.getBacklinks', {
                params: {
                    subject: `at://${DID}/app.bsky.labeler.service/self`,
                    source: 'app.bsky.feed.like:subject.uri',
                    cursor: cursor,
                }
            });

            if (!response.ok) {
                logger.error(response.data, `Failed to fetch likers: ${response.status}`);
                break;
            } else {
                const likers = response.data.records.map(link => ({ did: link.did, rkey: link.rkey }));
                if (likers.length > 0) {
                    await db
                        .insertInto('likers')
                        .values(likers)
                        .onConflict((oc) => oc.column('did').doUpdateSet(eb => ({ rkey: eb.ref('excluded.rkey') })))
                        .execute()
                        .catch((error: unknown) => {
                            logger.error(`Unexpected error inserting likers: ${error}`);
                        });
                }
                cursor = response.data.cursor;
            }
        } while (cursor);
    }
}
logger.info('Hydrated followers and likers into database.');

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

    try {
        if (event.kind === 'commit') {
            const did = event.did;
            const commit = event.commit;
            const rkey = commit.rkey;

            if (commit.operation === 'create') {
                const cid = commit.cid;
                const record = commit.record;
                
                if (commit.collection === 'app.bsky.graph.follow') {
                    const subject = (record as AppBskyGraphFollow.Main)?.subject;

                    // const uri = `at://${did}/app.bsky.graph.follow/${rkey}`;
                    if (subject === DID) {
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
                    const uri = (record as AppBskyFeedLike.Main)?.subject?.uri;

                    if (uri) {
                        if (uri == `at://${DID}/app.bsky.labeler.service/self`) {
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
                                    await labelPost(uri).catch((error: unknown) => {
                                        logger.error(error, `Unexpected error labeling ${uri}: ${error}`);
                                    });
                                }
                            });
                    } else {
                        logger.warn(record, `Like record missing subject.uri`);
                    }
                }

                if (commit.collection === 'app.bsky.feed.post') {
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
                                    ...(record as AppBskyFeedPost.Main),
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
    } catch (error) {
        logger.error(error, `Unexpected error processing event: ${error}`);
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
