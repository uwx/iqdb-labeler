import { Bytes, Did } from '@atcute/lexicons';
import type { SavedLabel, SignedLabel, DbProvider as SkywareDbProvider } from './db-provider.js';
import { createDb, Database } from '../backend/kysely/index.js';

function toArray(buf: Uint8Array | Bytes): Uint8Array {
    if (buf instanceof Uint8Array) return buf;
    return Buffer.from(buf.$bytes, 'base64');
}

export class SqliteDbProvider implements SkywareDbProvider {
    private db: Database;

    constructor(dbPath?: string) {
        this.db = createDb(dbPath ?? 'labels.db');
    }

    async queryLabels(identifier: string, cursor = 0, limit = 1): Promise<SavedLabel[]> {
        // newest first, one row per post: the same label value gets applied to a
        // post repeatedly, and a feed that repeats the same post 300 times is useless.
        // cursor is the id of the last post emitted, so we page backwards from it.
        const cursorId = cursor > 0 ? BigInt(cursor) : BigInt(Number.MAX_SAFE_INTEGER);

        // stream the (val, id) index newest-first and keep the first row per uri.
        // GROUP BY / ROW_NUMBER() sort every matching row (7s for a 72k-row value);
        // this stops as soon as it has `limit` distinct posts.
        const stream = this.db
            .selectFrom('labels')
            .selectAll()
            .where('val', '=', identifier)
            .where('id', '<', cursorId)
            .orderBy('id', 'desc')
            .stream();

        const seen = new Set<string>();
        const result: SavedLabel[] = [];
        for await (const row of stream) {
            if (seen.has(row.uri)) continue;
            seen.add(row.uri);
            result.push({ ...row, neg: row.neg == 1n });
            if (result.length >= limit) break;
        }

        return result;
    }

    /**
     * Posts matching `include` (all), `exclude` (none) and `prefix` (at least one of
     * each group's vals). Streams the rarest included val's index newest-first and
     * checks candidates with point lookups: GROUP BY/HAVING on this table costs
     * 0.7-1.3s, a lookup by (uri, val) is ~2us.
     * @returns post uris, plus whether the scan cap was hit before filling the page
     */
    async searchLabelsByTags(
        query: { include: string[]; exclude: string[]; prefix: string[][] },
        offset: number,
        limit: number,
        maxScan = 2000,
    ): Promise<{ posts: string[]; truncated: boolean }> {
        // each group is a prefix expansion; the uri must match at least one val in each
        const hasAnyOfEach = async (uri: string, groups: string[][]): Promise<boolean> => {
            for (const group of groups) {
                if (group.length === 0) continue;
                const found = await this.db
                    .selectFrom('labels')
                    .select('val')
                    .where('uri', '=', uri)
                    .where('val', 'in', group)
                    .executeTakeFirst();
                if (found === undefined) return false;
            }
            return true;
        };

        // true when the uri carries every val in the list (an empty list is true)
        const hasAll = async (uri: string, vals: string[]): Promise<boolean> => {
            if (vals.length === 0) return true;
            const found = await this.db
                .selectFrom('labels')
                .select('val')
                .where('uri', '=', uri)
                .where('val', 'in', vals)
                .execute();
            return new Set(found.map((row) => row.val)).size === new Set(vals).size;
        };

        // drive off the first include val, else every val of the first prefix group
        // (a group is an OR, so one val would miss posts carrying only the others).
        // With only negative terms there is no useful index to start from.
        const rest = query.include.slice(1);
        const isIncludeDriver = query.include.length > 0;
        const drivers = isIncludeDriver ? [query.include[0]] : (query.prefix[0] ?? []);
        if (drivers.length === 0) return { posts: [], truncated: false };
        // when the prefix group *is* the driver its constraint is already satisfied
        const otherPrefixGroups = isIncludeDriver ? query.prefix : query.prefix.slice(1);
        const posts: string[] = [];
        let matched = 0;

        // collect candidates first: the executor is single-connection, so issuing a
        // query while a stream is open deadlocks. id is kept to restore newest-first
        // order across the per-val streams.
        const ids = new Map<string, bigint>();
        let exhausted = false;
        outer: for (const val of drivers) {
            const stream = this.db
                .selectFrom('labels')
                .select(['uri', 'id'])
                .where('val', '=', val)
                .orderBy('id', 'desc')
                .stream();

            for await (const row of stream) {
                const previous = ids.get(row.uri);
                if (previous !== undefined) {
                    if (row.id > previous) ids.set(row.uri, row.id);
                    continue;
                }
                // cap on distinct posts considered, not rows: a common tag repeats.
                // offset shifts the window so deep pages are still reachable.
                if (ids.size >= maxScan + offset) {
                    exhausted = true;
                    break outer;
                }
                ids.set(row.uri, row.id);
            }
        }

        const candidates = [...ids.entries()]
            .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0))
            .map(([uri]) => uri);

        for (const uri of candidates) {
            if (!(await hasAll(uri, rest))) continue;
            // excludes are per-tag: carrying any one of them rejects the post
            if (query.exclude.length > 0 && (await hasAnyOfEach(uri, [query.exclude]))) continue;
            // each prefix group needs at least one of its vals
            if (!(await hasAnyOfEach(uri, otherPrefixGroups))) continue;

            // skip the first `offset` matches, then collect the page
            if (matched++ < offset) continue;
            posts.push(uri);
            if (posts.length >= limit) break;
        }

        // a short page after the cap is not authoritative: there may be more matches
        // the scan never reached. A full page is, so it is never flagged.
        return { posts, truncated: exhausted && posts.length < limit };
    }

    async saveLabel(label: SignedLabel): Promise<bigint> {
        const { src, uri, cid, val, neg, cts, exp, sig } = label;

        const result = await this.db
            .insertInto('labels')
            .values({
                src: src,
                uri: uri,
                cid: cid ?? null,
                val: val,
                neg: neg ? 1n : 0n,
                cts: cts,
                exp: exp ?? null,
                sig: toArray(sig),
            })
            .execute();
        if (!result[0].numInsertedOrUpdatedRows) throw new Error('Failed to insert label');

        return result[0].insertId!;
    }

    async saveLabels(labels: SignedLabel[]): Promise<bigint[]> {
        const ids = await this.db.transaction().execute(async (trx) => {
            const ids: bigint[] = [];
            for (const label of labels) {
                const { src, uri, cid, val, neg, cts, exp, sig } = label;
                const result = await trx
                    .insertInto('labels')
                    .values({
                        src: src,
                        uri: uri,
                        cid: cid ?? null,
                        val: val,
                        neg: neg ? 1n : 0n,
                        cts: cts,
                        exp: exp ?? null,
                        sig: toArray(sig),
                    })
                    .execute();

                ids.push(result[0].insertId!);
            }
            return ids;
        });

        return ids;
    }

    async searchLabels(cursor?: number, limit = 50, uriPatterns: string[] = [], sources: string[] = []) {
        // exact patterns use '=' so the uri index is seekable: SQLite's LIKE is
        // case-insensitive by default, so it can never use a binary index and
        // falls back to scanning the whole table (~1s on 5M rows)
        const exact: string[] = [];
        const prefixes: string[] = [];
        if (!uriPatterns.includes('*')) {
            for (let pattern of uriPatterns) {
                pattern = pattern.replaceAll(/%/g, '').replaceAll(/_/g, '\\_');

                const starIndex = pattern.indexOf('*');
                if (starIndex === -1) {
                    exact.push(pattern);
                    continue;
                }
                if (starIndex !== pattern.length - 1) {
                    throw new Error('Only trailing wildcards are supported in uriPatterns');
                }
                prefixes.push(pattern.slice(0, -1) + '%');
            }
        }

        let query = this.db.selectFrom('labels').selectAll();

        if (exact.length || prefixes.length) {
            query = query.where((eb) =>
                eb.or([
                    ...exact.map((pattern) => eb('uri', '=', pattern)),
                    ...prefixes.map((pattern) => eb('uri', 'like', pattern)),
                ]),
            );
        }

        if (sources.length) {
            query = query.where('src', 'in', sources as Did[]);
        }

        if (cursor) {
            query = query.where('id', '>', BigInt(cursor));
        }

        const result = await query.orderBy('id', 'asc').limit(limit).execute();

        return result.map((row) => ({
            ...row,
            neg: row.neg == 1n,
        }));
    }

    async isCursorInTheFuture(cursor: number) {
        const result = await this.db
            .selectFrom('labels')
            .select((eb) => eb.fn.max('id').as('id'))
            .executeTakeFirst();

        return cursor > (result?.id ?? 0);
    }

    async getLatestCursor(): Promise<bigint | null> {
        const result = await this.db
            .selectFrom('labels')
            .select((eb) => eb.fn.max('id').as('id'))
            .executeTakeFirst();

        return result?.id ?? null;
    }

    async *iterateLabels(cursor = 0): AsyncIterable<SavedLabel> {
        const results = this.db
            .selectFrom('labels')
            .selectAll()
            .where('id', '>', BigInt(cursor))
            .orderBy('id', 'asc')
            .stream();

        for await (const row of results) {
            yield {
                ...row,
                neg: row.neg == 1n,
            };
        }
    }
}
