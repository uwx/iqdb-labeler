import { AtpSessionData, CredentialManager, XRPCError } from "@atcute/client";
import { ComAtprotoServerCreateSession, ComAtprotoServerGetSession } from "@atcute/client/lexicons";
import { BotLoginOptions } from "#skyware/bot";
import { db } from "./lmdb.js";
import { BSKY_IDENTIFIER, BSKY_PASSWORD, DID } from "./config.js";
import logger from "./logger.js";

export const credentialManager = new CredentialManager({ service: "https://bsky.social" });

const sessions = db.table<string, AtpSessionData>('sessions', 'ordered-binary', 'msgpack');

const existingSession = sessions.get(DID);
if (existingSession != undefined) {
    try {
        logger.info(`Attempting to resume session for ${BSKY_IDENTIFIER}.`);

        await resumeSession(existingSession);

        logger.info(`Resumed session for ${BSKY_IDENTIFIER}.`);
    } catch (err) {
        if (err instanceof Error && err.cause instanceof XRPCError && err.cause.kind == 'InvalidToken') {
            logger.info(`Session for ${BSKY_IDENTIFIER} has expired, logging in again.`);

            await login({
                identifier: BSKY_IDENTIFIER,
                password: BSKY_PASSWORD,
            });

            logger.info(`Logged in as ${BSKY_IDENTIFIER}.`);

            await saveSession();
        } else {
            throw err;
        }
    }
} else {
    await login({
        identifier: BSKY_IDENTIFIER,
        password: BSKY_PASSWORD,
    });

    logger.info(`Logged in as ${BSKY_IDENTIFIER}.`);

    await saveSession();
}

async function saveSession() {
    if (credentialManager.session) {
        sessions.put(DID, credentialManager.session);
        logger.debug(`Saved session for ${BSKY_IDENTIFIER}.`);
    } else {
        sessions.remove(DID);
    }
}

/**
 * Log in with an identifier and password.
 * @param options The bot account's identifier and password.
 * @returns Session data.
 */
async function login(
    { identifier, password }: BotLoginOptions,
): Promise<ComAtprotoServerCreateSession.Output> {
    if (identifier[0] === "@") identifier = identifier.slice(1);

    const response = await credentialManager.login({ identifier, password }).catch((e) => {
        throw new Error("Failed to log in - double check your credentials and try again.", {
            cause: e,
        });
    });

    return response;
}

/**
 * Resume an existing session.
 * @param session Session data.
 * @returns Updated session data.
 */
async function resumeSession(session: AtpSessionData): Promise<ComAtprotoServerGetSession.Output> {
    const response = await credentialManager.resume(session).catch((e) => {
        throw new Error("Failed to resume session.", { cause: e });
    });

    return response;
}
