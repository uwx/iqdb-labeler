import 'dotenv/config';

import { tunnel } from "cloudflared";
import { BSKY_IDENTIFIER, BSKY_PASSWORD, METRICS_PORT, PORT } from "../config.js";
import { plcClearLabeler, plcRequestToken, plcSetupLabeler } from "#skyware/labeler/scripts/index.js";
import logger from '../logger.js';
import { XRPCError } from "@atcute/client";
import { access, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { secp256k1 as k256 } from "@noble/curves/secp256k1";
import { fromString as ui8FromString } from "uint8arrays/from-string";
import { toString as ui8ToString } from "uint8arrays/to-string";
import { setupTunnel } from '../utils/setup-tunnel.js';

export async function startTunnelAndUpdateLabeler() {
    const { url: tunnelUrl, child: tunnelChildProcess, stop: stopTunnel } = tunnel({ '--url': `http://localhost:${PORT}` });
    const { url: monitoringUrl, child: metricsChildProcess, stop: stopMonitoringTunnel } = tunnel({ '--url': `http://localhost:${METRICS_PORT}` });

    tunnelChildProcess.stdout?.on('data', (data) => {
        console.log(`Tunnel ${data.toString('utf-8').trim()}`);
    });
    tunnelChildProcess.stderr?.on('data', (data) => {
        console.error(`Tunnel ${data.toString('utf-8').trim()}`);
    });

    metricsChildProcess.stdout?.on('data', (data) => {
        console.log(`Metrics: ${data.toString('utf-8').trim()}`);
    });
    metricsChildProcess.stderr?.on('data', (data) => {
        console.error(`Metrics: ${data.toString('utf-8').trim()}`);
    });

    tunnelUrl.then(tunnelUrl => logger.info(`Created tunnel at ${tunnelUrl}`));
    monitoringUrl.then(monitoringUrl => logger.info(`Created monitoring tunnel at ${monitoringUrl}`));

    await setupTunnel(await tunnelUrl);

    process.on('beforeExit', () => {
        stopTunnel();
        stopMonitoringTunnel();
    });

    return {
        stop() {
            stopTunnel();
            stopMonitoringTunnel();
        }
    }
}

await startTunnelAndUpdateLabeler();