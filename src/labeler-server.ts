import metricsServer from './services/metrics.js';
import { DID, PORT, SIGNING_KEY } from './config.js';
import { LabelerServer } from '#skyware/labeler/index.js';
import logger from './backend/logger.js';
import feedGenerator from './services/feed-generator.js';
import { XRPCError } from '@atcute/client';
import { aesDecrypt } from './backend/crypto.js';
import { BotLabelRecordOptions } from '#skyware/bot';
import { KyselyDbProvider } from './utils/drizzle-db-provider.js';

import { createNodeWebSocket } from '@hono/node-ws'
import { Context, Hono } from 'hono'
import { serve } from '@hono/node-server'
import { HTTPResponseError } from 'hono/types';
import { StatusCode } from 'hono/utils/http-status';
import { inspect } from 'node:util';

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

export const labelerServer = new LabelerServer(app, upgradeWebSocket, {
    did: DID, signingKey: SIGNING_KEY, db: new KyselyDbProvider()
}, logger);

metricsServer(app);

feedGenerator(app, { labelerServer });

/**
 * Catch-all handler for unknown XRPC methods.
 */
async function unknownMethodHandler(c: Context) {
    return c.json({ error: "MethodNotImplemented", message: "Method Not Implemented" }, 501);
}

/**
 * Default error handler.
 */
async function errorHandler(err: Error | HTTPResponseError, c: Context) {
    if (err instanceof XRPCError) {
        return c.json({ error: err.kind, message: err.description }, err.status as StatusCode);
    } else {
        console.error(err);
        return c.json({
            error: "InternalServerError",
            message: "An unknown error occurred",
        }, 500);
    }
}

app.post('/label', async q => {
    const decryptedBody: BotLabelRecordOptions = JSON.parse(await aesDecrypt(await q.req.text()));

    if (!('uri' in decryptedBody.reference)) {
        return q.text('No URI', 400);
    }

    const labels = await labelerServer.createLabels(
        decryptedBody.reference,
        {
            create: decryptedBody.labels
        },
    );

    return q.json(labels, 200);
})

app.get("/xrpc/*", unknownMethodHandler);

app.get('/robots.txt', async (q) => {
    return q.text(['User-agent: *', 'Disallow: /'].join('\n'), 200);
})

app.onError(errorHandler);

const server = serve({
    fetch: app.fetch,
    port: PORT,
});
injectWebSocket(server);
logger.info(`Labeler server listening on ${inspect(server.address())}`);

logger.info('g');
