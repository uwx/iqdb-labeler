import { XRPC, CredentialManager } from '@atcute/client';
import '@atcute/bluesky/lexicons';
import { Bot, EventStrategy } from "@skyware/bot";
import ws from "ws";
import { BSKY_IDENTIFIER, BSKY_PASSWORD } from './config.js';

export const bot = new Bot({
    emitEvents: false,
});
await bot.login({
	identifier: BSKY_IDENTIFIER,
	password: BSKY_PASSWORD,
});
