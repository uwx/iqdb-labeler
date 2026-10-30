import metricsServer from './services/metrics.js';
import { DB_PATH, DID, PORT, SIGNING_KEY } from './config.js';
import logger from './backend/logger.js';
import feedGenerator, { useDidWeb } from './services/feed-generator.js';
import { aesDecrypt } from './backend/crypto.js';
import { createRequestListener } from '@remix-run/node-fetch-server';
import { json, XRPCRouter, XRPCSubscriptionError } from '@atcute/xrpc-server';
import { createNodeWebSocket } from '@atcute/xrpc-server-node';
import { encode } from '@atcute/cbor';
import { Hono } from 'hono';
import { cors } from '@atcute/xrpc-server/middlewares/cors';
import {
    type ComAtprotoLabelDefs,
    ComAtprotoLabelQueryLabels,
    ComAtprotoLabelSubscribeLabels,
    type ComAtprotoRepoStrongRef,
} from '@atcute/atproto';
import { SqliteDbProvider } from './utils/nodesqlite-db-provider.ts';
import { Secp256k1PrivateKey } from '@atcute/crypto';
import { FutureCursorError, Labeler } from '@atcute/labeler';
import { DbLabelStore } from './utils/db-label-store.ts';
import { reserveLabelBudget } from './utils/label-budget.ts';
import { fromString as ui8FromString } from 'uint8arrays/from-string';
import { createDb, migrateToLatest, setJournalMode } from './backend/kysely/index.ts';
import * as http from 'node:http';
import type { ResourceUri } from '@atcute/lexicons';

setJournalMode(DB_PATH);
await migrateToLatest(createDb(DB_PATH));

const labelerDb = new SqliteDbProvider(DB_PATH);

// how many labels per post are published to the appview; the rest are stored
// for feeds and queryLabels only. 4 keeps the 5/s, 50k/day budget workable.
const MAX_LABELS_PER_POST = Math.max(1, Number(process.env.MAX_LABELS_PER_POST) || 4);

const signingKey = Secp256k1PrivateKey.importRaw(ui8FromString(SIGNING_KEY, 'hex'));

const labeler = new Labeler({
    serviceDid: DID,
    signingKey: await signingKey,
    store: new DbLabelStore(labelerDb),
});

const { adapter, injectWebSocket } = createNodeWebSocket();
const router = new XRPCRouter({
    websocket: adapter,
    middlewares: [cors()],
    // the default handler swallows the exception without logging it
    handleException(err, request) {
        logger.error({ err }, `Unhandled error for ${new URL(request.url).pathname}`);
        return Response.json({ error: 'InternalServerError', message: 'an exception happened whilst processing this request' }, { status: 500 });
    },
});

router.addSubscription(ComAtprotoLabelSubscribeLabels, {
    async *handler({ params, signal }) {
        // no backfill: the appview caps ingestion at 5/s, 5k/hour, 50k/day, so
        // replaying the multi-million-row history only burns the budget and gets
        // dropped. new subscribers start from live.
        try {
            for await (const label of labeler.subscribeLabels({ signal })) {
                // not logger.debug(label, ...): this fires for every label and the
                // pretty-printed dump was ~1.9k lines/min of synchronous writes,
                // which starved the event loop and made getFeedSkeleton time out


                yield {
                    ...label,
                    $type: 'com.atproto.label.subscribeLabels#labels',
                };
            }
        } catch (err) {
            if (err instanceof FutureCursorError) {
                throw new XRPCSubscriptionError({ error: 'FutureCursor' });
            }
            throw err;
        }
    },
});

router.addQuery(ComAtprotoLabelQueryLabels, {
    async handler({ params: { uriPatterns, cursor, sources, limit } }) {
        const events = await labelerDb.searchLabels(
            cursor && !isNaN(Number(cursor)) ? Number(cursor) : undefined,
            limit ?? 100,
            uriPatterns,
            sources,
        );

        logger.debug(
            events,
            `Queried labels with patterns ${uriPatterns?.join(', ')}, sources ${sources?.join(', ')}, cursor ${cursor}, limit ${limit}. Found ${events.length} events.`,
        );

        return json({
            labels: events.map(
                (event) =>
                    ({
                        src: event.src,
                        uri: event.uri as ResourceUri,
                        cid: event.cid ?? undefined,
                        val: event.val,
                        neg: event.neg,
                        cts: event.cts,
                        exp: event.exp ?? undefined,
                    }) satisfies ComAtprotoLabelDefs.Label,
            ),
            cursor: undefined, // TODO implement cursor-based pagination
        });
    },
});

const labelerServer = new Hono();

metricsServer(labelerServer);

feedGenerator(router, labelerDb); // TODO
useDidWeb(labelerServer);

labelerServer.mount('/xrpc', router.fetch, {
    replaceRequest: (req) => req,
});

export interface BotLabelRecordOptions {
    /**
     * A reference to the record to label.
     */
    reference: ComAtprotoRepoStrongRef.Main;

    /**
     * The labels to apply.
     */
    labels: Array<string>;

    /**
     * The CIDs of specific blobs within the record that the labels apply to, if any.
     */
    blobCids?: Array<string> | undefined;

    /**
     * An optional comment.
     */
    comment?: string | undefined;
}

labelerServer.post('/label', async (c) => {
    const decryptedBody: BotLabelRecordOptions = JSON.parse(await aesDecrypt(await c.req.text()));

    if (!('uri' in decryptedBody.reference)) {
        return c.text('No URI', 400);
    }

    const uri = decryptedBody.reference.uri;

    // the same post gets relabeled constantly; re-applying a value it already
    // has spends the appview's ingest budget for nothing
    const existing = new Set(
        (await labelerDb.searchLabels(undefined, 1000, [uri])).map((label) => label.val),
    );
    const wanted = [...new Set(decryptedBody.labels)].filter((val) => !existing.has(val));

    if (wanted.length === 0) {
        return c.json([], 200);
    }

    // everything is stored so feeds and queryLabels keep the full tag set, but
    // only a few per post are published: the appview budget is what actually
    // limits how many labels exist at all
    const allowed = Math.min(
        MAX_LABELS_PER_POST - existing.size,
        await reserveLabelBudget(Math.min(wanted.length, MAX_LABELS_PER_POST)),
    );
    const toPublish = wanted.slice(0, Math.max(0, allowed));
    const storeOnly = wanted.slice(toPublish.length);

    const issuedAt = new Date().toISOString();
    const labels = toPublish.length
        ? await labeler.applyLabels(
              toPublish.map((label) => ({ uri, cid: decryptedBody.reference.cid, value: label, issuedAt })),
          )
        : [];

    if (storeOnly.length) {
        const key = await signingKey;
        const rows = await Promise.all(
            storeOnly.map(async (val) => {
                const unsigned = { cid: decryptedBody.reference.cid, cts: issuedAt, src: DID, uri, val, ver: 1 };
                return { ...unsigned, sig: await key.sign(encode(unsigned)) };
            }),
        );
        await labelerDb.saveLabels(rows as never);
    }

    logger.debug(
        `Labeled ${uri}: published ${toPublish.length}, stored-only ${storeOnly.length} (${wanted.length} new)`,
    );

    return c.json(labels, 200);
});

labelerServer.get('/robots.txt', (c) => {
    return c.text('User-agent: *\nDisallow: /', 200);
});

const server = http.createServer(createRequestListener(labelerServer.fetch));

injectWebSocket(server, router);

server.listen(PORT, () => {
    logger.info(`Labeler server listening on ${server.address()}`);
});

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        server.close();
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

logger.info('g');

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('h');
