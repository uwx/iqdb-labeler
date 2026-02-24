import metricsServer from './services/metrics.js';
import { DB_PATH, DID, PORT, SIGNING_KEY } from './config.js';
import logger from './backend/logger.js';
import feedGenerator, { useDidWeb } from './services/feed-generator.js';
import { aesDecrypt } from './backend/crypto.js';
import { serve } from '@hono/node-server';
import { XRPCRouter } from '@atcute/xrpc-server';
import { createNodeWebSocket } from '@atcute/xrpc-server-node';
import { Hono } from 'hono';
import { cors } from '@atcute/xrpc-server/middlewares/cors';
import { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import { SqliteDbProvider } from './utils/nodesqlite-db-provider.ts';
import { P256PrivateKey } from '@atcute/crypto';
import { Labeler } from './labeler/index.ts';
import { DbLabelStore } from './utils/db-label-store.ts';
import { fromString as ui8FromString } from "uint8arrays/from-string";

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

const labelerServer = new Hono();

labelerServer.mount('/xrpc/*', router.fetch);

metricsServer(labelerServer);

feedGenerator(router, labelerDb); // TODO
useDidWeb(labelerServer);

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
})

const server = serve(
    {
        fetch: labelerServer.fetch,
        port: PORT,
    },
    (info) => {
        logger.info(`Labeler server listening on ${server.address()}`);
    },
);

injectWebSocket(server, router);

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
