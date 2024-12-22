import 'dotenv/config';

import { BSKY_IDENTIFIER, BSKY_PASSWORD, METRICS_PORT, PORT } from "../config.js";
import { plcClearLabeler, plcRequestToken, plcSetupLabeler } from "#skyware/labeler/scripts/index.js";
import logger from '../backend/logger.js';
import { XRPCError } from "@atcute/client";
import { access, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { secp256k1 as k256 } from "@noble/curves/secp256k1";
import { fromString as ui8FromString } from "uint8arrays/from-string";
import { toString as ui8ToString } from "uint8arrays/to-string";

export function genPrivateAndPublicKeys(privateKey?: Uint8Array) {
    privateKey = privateKey ?? k256.utils.randomPrivateKey();
    const publicKey = k256.getPublicKey(privateKey);
    return [privateKey, publicKey] as const;
}

export async function setupTunnel(url: string) {
    let keys: readonly [privateKey: Uint8Array, publicKey: Uint8Array];

    if (process.env.SIGNING_KEY) {
        keys = genPrivateAndPublicKeys(ui8FromString(process.env.SIGNING_KEY, 'hex'));
    } else {
        keys = genPrivateAndPublicKeys();
        // await writeFile('./.labeler-keys', ui8ToString(keys[0], 'hex'), 'ascii');
    }

    if (await access('./.plc-token').then(() => true).catch(() => false)) {
        let token = await readFile('./.plc-token', 'utf-8');

        try {
            //logger.info('Clearing labeler');
            //await plcClearLabeler({
            //    identifier: BSKY_IDENTIFIER,
            //    password: BSKY_PASSWORD,
            //    plcToken: token,
            //});

            logger.info('Setting up labeler');
            await plcSetupLabeler({
                identifier: BSKY_IDENTIFIER,
                password: BSKY_PASSWORD,
                plcToken: token,
                endpoint: url,
                privateKey: keys[0]
            });
            logger.info('Set up labeler');
        } catch (err) {
            if (typeof err === 'object' && err != null && 'kind' in err && (err.kind === 'ExpiredToken' || err.kind === 'InvalidToken')) {
                logger.info('Token expired, refreshing');
                await plcRequestToken({
                    identifier: BSKY_IDENTIFIER,
                    password: BSKY_PASSWORD,
                });

                const rl = createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                token = await rl.question('Input the token received in your email > ');
                rl.close();

                await writeFile('./.plc-token', token, 'utf-8');

                //logger.info('Clearing labeler');
                //await plcClearLabeler({
                //    identifier: BSKY_IDENTIFIER,
                //    password: BSKY_PASSWORD,
                //    plcToken: token,
                //});

                logger.info('Setting up labeler');
                await plcSetupLabeler({
                    identifier: BSKY_IDENTIFIER,
                    password: BSKY_PASSWORD,
                    plcToken: token,
                    endpoint: url,
                    privateKey: keys[0]
                });
                logger.info('Set up labeler');
            } else {
                throw err;
            }
        }
    } else {
        await plcRequestToken({
            identifier: BSKY_IDENTIFIER,
            password: BSKY_PASSWORD,
        });

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const token = await rl.question('Input the token received in your email: ');
        rl.close();

        await writeFile('./.plc-token', token, 'utf-8');

        logger.info('Clearing labeler');
        await plcClearLabeler({
            identifier: BSKY_IDENTIFIER,
            password: BSKY_PASSWORD,
            plcToken: token,
        });

        logger.info('Setting up labeler');
        await plcSetupLabeler({
            identifier: BSKY_IDENTIFIER,
            password: BSKY_PASSWORD,
            plcToken: token,
            endpoint: url,
            privateKey: keys[0]
        });
        logger.info('Set up labeler');
    }

}