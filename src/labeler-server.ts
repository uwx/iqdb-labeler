import metricsServer from './metrics.js';
import { DID, PORT, SIGNING_KEY } from './config.js';
import { labelerServerPlugin, labelerServerKey } from '#skyware/labeler/index.js';
import logger from './logger.js';
import fastify, { FastifyBaseLogger, FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import feedGenerator from './feed-generator.js';
import { XRPCError } from '@atcute/client';
import { aesDecrypt } from './crypto.js';
import { BotLabelRecordOptions } from '#skyware/bot';
import { fastifyWebsocket } from "@fastify/websocket";
import { LmdbDbProvider } from './utils/lmdb-skyware-db-provider.js';
import { db } from './lmdb.js';

const app = fastify({
    logger: logger as FastifyBaseLogger
});

// needs to be registered before all other routes because of fastifyWebsocket...
await app.register(fastifyWebsocket);

await app.register(labelerServerPlugin, { did: DID, signingKey: SIGNING_KEY, db: new LmdbDbProvider(db) });
export const labelerServer = app[labelerServerKey];

await app.register(metricsServer);

await app.register(feedGenerator, { labelerServer });

/**
 * Catch-all handler for unknown XRPC methods.
 */
async function unknownMethodHandler(_req: FastifyRequest, res: FastifyReply) {
    return await res.status(501).send({ error: "MethodNotImplemented", message: "Method Not Implemented" });
}

/**
 * Default error handler.
 */
async function errorHandler(err: FastifyError, _req: FastifyRequest, res: FastifyReply) {
    if (err instanceof XRPCError) {
        return await res.status(err.status).send({ error: err.kind, message: err.description });
    } else {
        console.error(err);
        return await res.status(500).send({
            error: "InternalServerError",
            message: "An unknown error occurred",
        });
    }
}

app.post('/label', async (req: FastifyRequest<{ Body: string }>, res) => {
    const decryptedBody: BotLabelRecordOptions = JSON.parse(await aesDecrypt(req.body));

    if (!('uri' in decryptedBody.reference)) {
        return await res.code(400).send('No URI');
    }

    const labels = await labelerServer.createLabels(
        decryptedBody.reference,
        {
            create: decryptedBody.labels
        },
    );

    return await res.code(200).send(labels);
})

app.get("/xrpc/*", unknownMethodHandler);

app.get('/robots.txt', async (req, res) => {
    return await res.code(200).send(['User-agent: *', 'Disallow: /'].join('\n'));
})

app.setErrorHandler(errorHandler);

const address = await app.listen({ port: PORT });
logger.info(`Labeler server listening on ${address}`);

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        app.close();
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

logger.info('g');

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('h');
