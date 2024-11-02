import { startMetricsServer } from './metrics.js';
import { DID, METRICS_PORT, PORT, SIGNING_KEY } from './config.js';
import { LabelerServer } from './labeler/src/index.js';
import logger from './logger.js';

export const labelerServer = new LabelerServer({ did: DID, signingKey: SIGNING_KEY });

const metricsServer = startMetricsServer(METRICS_PORT);

labelerServer.start(PORT, (error, address) => {
    if (error) {
        logger.error('Error starting server: %s', error);
    } else {
        logger.info(`Labeler server listening on ${address}`);
    }
});

function shutdown() {
    try {
        logger.info('Shutting down gracefully...');
        labelerServer.stop();
        metricsServer.close();
    } catch (error) {
        logger.error(`Error shutting down gracefully: ${error}`);
        process.exit(1);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
