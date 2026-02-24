import { Did } from '@atcute/lexicons';

import 'dotenv/config';

export const DID = (process.env.DID ?? '') as Did;
export const SIGNING_KEY = process.env.SIGNING_KEY ?? '';
export const PORT = process.env.PORT ? Number(process.env.PORT) : 4002;
export const FIREHOSE_URL = process.env.FIREHOSE_URL ?? 'wss://jetstream.atproto.tools/subscribe';
export const WANTED_COLLECTION = 'app.bsky.feed.like';
export const BSKY_IDENTIFIER = process.env.BSKY_IDENTIFIER ?? '';
export const BSKY_PASSWORD = process.env.BSKY_PASSWORD ?? '';
export const CURSOR_UPDATE_INTERVAL = process.env.CURSOR_UPDATE_INTERVAL ? Number(process.env.CURSOR_UPDATE_INTERVAL) : 10000;
export const FEEDS_DOMAIN = process.env.FEEDS_DOMAIN ?? '';
export const BACKEND_DOMAIN = process.env.BACKEND_DOMAIN ?? `127.0.0.1:${PORT}`;
export const LABELER_PASSWORD = process.env.LABELER_PASSWORD ?? 'hackme';
export const LABELER_SALT = process.env.LABELER_SALT ?? 'hackme';
export const DB_PATH = process.env.DB_PATH ?? 'labels.db';
export const PDS = process.env.PDS ?? 'https://bsky.social';

if (!FEEDS_DOMAIN || !BSKY_IDENTIFIER || !BSKY_PASSWORD || !DID || !SIGNING_KEY) {
    throw new Error('Environment is misconfigured. Please modify .env');
}
