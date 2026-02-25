import metricsServer from './services/metrics.js';
import { DB_PATH, DID, PORT, SIGNING_KEY } from './config.js';
import logger from './backend/logger.js';
import feedGenerator, { useDidWeb } from './services/feed-generator.js';
import { aesDecrypt } from './backend/crypto.js';
import { serve } from '@hono/node-server';
import { json,
XRPCRouter,XRPCSubscriptionError } from '@atcute/xrpc-server';
import { createNodeWebSocket } from '@atcute/xrpc-server-node';
import { Hono } from 'hono';
import { cors } from '@atcute/xrpc-server/middlewares/cors';
import { ComAtprotoLabelDefs, ComAtprotoLabelQueryLabels, ComAtprotoLabelSubscribeLabels, ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { SqliteDbProvider } from './utils/nodesqlite-db-provider.ts';
import { P256PrivateKey } from '@atcute/crypto';
import { FutureCursorError,
Labeler } from './labeler/index.ts';
import { DbLabelStore } from './utils/db-label-store.ts';
import { fromString as ui8FromString } from "uint8arrays/from-string";
import { createDb, migrateToLatest } from './backend/kysely/index.ts';
import { createRequestListener } from '@remix-run/node-fetch-server'
import * as http from 'node:http';
import { ResourceUri } from '@atcute/lexicons';

await migrateToLatest(createDb(DB_PATH));

const labelerDb = new SqliteDbProvider(DB_PATH);

const labeler = new Labeler({
	serviceDid: DID,
	signingKey: await P256PrivateKey.importRaw(ui8FromString(SIGNING_KEY, 'hex')),
	store: new DbLabelStore(labelerDb),
});

const { adapter, injectWebSocket } = createNodeWebSocket();
const router = new XRPCRouter({
    websocket: adapter,
    middlewares: [cors()],
});

router.addSubscription(ComAtprotoLabelSubscribeLabels, {
	async *handler({ params, signal }) {
		try {
			for await (const label of labeler.subscribeLabels({ cursor: params.cursor, signal })) {
                logger.debug(label, 'Emitting label event');

				yield {
                    ...label,
                    $type: 'com.atproto.label.subscribeLabels#labels'
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
            sources
        );

        logger.debug(events, `Queried labels with patterns ${uriPatterns?.join(', ')}, sources ${sources?.join(', ')}, cursor ${cursor}, limit ${limit}. Found ${events.length} events.`);
        
        return json({
            labels: events.map(event => ({
                src: event.src,
                uri: event.uri as ResourceUri,
                cid: event.cid ?? undefined,
                val: event.val,
                neg: event.neg,
                cts: event.cts,
                exp: event.exp ?? undefined,
            } satisfies ComAtprotoLabelDefs.Label)),
            cursor: undefined, // TODO implement cursor-based pagination
        });
    }
})


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

labelerServer.post('/label', async c => {
    const decryptedBody: BotLabelRecordOptions = JSON.parse(await aesDecrypt(await c.req.text()));

    if (!('uri' in decryptedBody.reference)) {
        return c.text('No URI', 400);
    }

    logger.debug(`Received label request for ${decryptedBody.reference.uri} with labels: ${decryptedBody.labels.join(', ')}`);

    const labels = await labeler.applyLabels(
        decryptedBody.labels.map(label => {
            return {
                uri: decryptedBody.reference.uri,
                cid: decryptedBody.reference.cid,
                value: label,
                issuedAt: new Date().toISOString(),
            };
        })
    );

    return c.json(labels, 200);
});

labelerServer.get('/robots.txt', c => {
    return c.text('User-agent: *\nDisallow: /', 200);
});

let server = http.createServer(createRequestListener(labelerServer.fetch))

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
