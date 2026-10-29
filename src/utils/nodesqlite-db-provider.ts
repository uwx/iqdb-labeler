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
        const result = await this.db
            .selectFrom('labels')
            .selectAll()
            .where('val', '=', identifier)
            .where('id', '>', BigInt(cursor))
            .orderBy('id', 'asc')
            .limit(limit)
            .execute();

        return result.map((row) => ({
            ...row,
            neg: row.neg == 1n,
        }));
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
        const patterns = uriPatterns.includes('*')
            ? []
            : uriPatterns.map((pattern) => {
                  pattern = pattern.replaceAll(/%/g, '').replaceAll(/_/g, '\\_');

                  const starIndex = pattern.indexOf('*');
                  if (starIndex === -1) return pattern;

                  if (starIndex !== pattern.length - 1) {
                      throw new Error('Only trailing wildcards are supported in uriPatterns');
                  }
                  return pattern.slice(0, -1) + '%';
              });

        let query = this.db.selectFrom('labels').selectAll();

        if (patterns.length) {
            query = query.where((eb) => eb.or(patterns.map((pattern) => eb('uri', 'like', pattern))));
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
