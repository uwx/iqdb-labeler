import '@atcute/bluesky/lexicons';
import { Bot } from "@skyware/bot";
import { BSKY_IDENTIFIER, BSKY_PASSWORD } from './config.js';
import { table } from './lmdb.js';
import { AtpSessionData, CredentialManager, XRPCError } from '@atcute/client';

const sessions = table<number, AtpSessionData>('sessions', 'ordered-binary', 'msgpack');

export const bot = new Bot({
    emitEvents: false,
});

const existingSession = sessions.get(0);
if (existingSession != undefined) {
    try {
        await bot.resumeSession(existingSession);
    } catch (err) {
        if (err instanceof Error && err.cause instanceof XRPCError && err.cause.kind == 'InvalidToken') {
            await bot.login({
                identifier: BSKY_IDENTIFIER,
                password: BSKY_PASSWORD,
            });

            await saveSession();
        } else {
            throw err;
        }
    }
} else {
    await bot.login({
        identifier: BSKY_IDENTIFIER,
        password: BSKY_PASSWORD,
    });

    await saveSession();
}

async function saveSession() {}
    if (bot.hasSession) {
        const session = ((bot as any).handler as CredentialManager).session;
        if (session) {
            sessions.put(0, session);
        } else {
            sessions.remove(0);
        }
    } else {
        sessions.remove(0);
    }