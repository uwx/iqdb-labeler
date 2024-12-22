import '@atcute/bluesky/lexicons';
import { Bot } from "#skyware/bot";
import { credentialManager } from './session.js';

export const bot = new Bot({
    emitEvents: false,
    credentialManager
});

// Needed to hydrate internal bot fields
await bot.useExistingSession();