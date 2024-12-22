import { At } from "@atcute/client/lexicons";
import { blob, index, int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

function boolean() {
    return int({ mode: 'boolean' });
}

function datetime() {
    return text();
}

export const matchesByUrl = sqliteTable("matchesByUrl", {
    url: text().primaryKey(),

    similarity: real(),

    md5: text(),
    sha1: text(),
    sha256: text(),
    rating: text(),
    sourceUrl: text(),
    pixivId: int(),
    fileSize: int(),

    /** Danbooru tag IDs for post */
    tags: text({ mode: 'json' }).$type<number[]>(),
});

export const followers = sqliteTable('followers', {
    did: text().primaryKey(),
    rkey: text(),
}, t => [
    index('rkey_idx').on(t.rkey),
]);
export const likers = sqliteTable('likers', {
    did: text().primaryKey(),
    rkey: text(),
}, t => [
    index('rkey_idx').on(t.rkey),
]);

export const labels = sqliteTable('labels', {
    id: int().primaryKey({ autoIncrement: true }),
    src: text().notNull().$type<At.DID>(),
    uri: text().notNull(),
    cid: text(),
    val: text().notNull(),
    neg: boolean().default(false),
    cts: datetime().notNull(),
    exp: datetime(),
    sig: blob({ mode: 'buffer' }).notNull(),
}, t => [
    index('val_idx').on(t.val),
])
