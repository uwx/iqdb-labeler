import { Bytes } from "@atcute/lexicons";
import type { SavedLabel, SignedLabel, DbProvider as SkywareDbProvider } from "./db-provider.js";
import { DatabaseSync } from 'node:sqlite';
import { createDb,Database } from "../backend/kysely/index.js";

function toArray(buf: Uint8Array | Bytes): Uint8Array {
    if (buf instanceof Uint8Array) return buf;
    return Buffer.from(buf.$bytes, 'base64');
}

export class SqliteDbProvider implements SkywareDbProvider {
    private db: Database;

    constructor(dbPath?: string) {
        this.db = createDb(dbPath ?? "labels.db");
    }

    async queryLabels(identifier: string, cursor = 0, limit = 1): Promise<SavedLabel[]> {
        const result = await this.db.selectFrom('labels')
            .selectAll()
            .where('val', '=', identifier)
            .where('id', '>', cursor)
            .orderBy('id', 'asc')
            .limit(limit)
            .execute();

        return result.map(row => ({
            ...row,
            neg: row.neg == 1,
        }));
    }

    async saveLabel(label: SignedLabel): Promise<number> {
        const { src, uri, cid, val, neg, cts, exp, sig } = label;

        const result = await this.db.insertInto('labels')
            .values({
                src: src,
                uri: uri,
                cid: cid ?? null,
                val: val,
                neg: neg ? 1 : 0,
                cts: cts,
                exp: exp ?? null,
                sig: toArray(sig),
            })
            .execute();
        if (!result[0].numInsertedOrUpdatedRows) throw new Error("Failed to insert label");

        return Number(result[0].insertId);
    }

    async saveLabels(labels: SignedLabel[]): Promise<number[]> {
        const ids = await this.db
            .transaction()
            .execute(async trx => {
                const ids: number[] = [];
                for (const label of labels) {
                    const { src, uri, cid, val, neg, cts, exp, sig } = label;
                    const result = await trx.insertInto('labels')
                        .values({
                            src: src,
                            uri: uri,
                            cid: cid ?? null,
                            val: val,
                            neg: neg ? 1 : 0,
                            cts: cts,
                            exp: exp ?? null,
                            sig: toArray(sig),
                        })
                        .execute();

                    ids.push(Number(result[0].insertId));
                }
                return ids;
            });

        return ids;
    }

    async searchLabels(cursor?: number, limit = 50, uriPatterns: string[] = [], sources: string[] = []) {
        const patterns = uriPatterns.includes("*") ? [] : uriPatterns.map((pattern) => {
            pattern = pattern.replaceAll(/%/g, "").replaceAll(/_/g, "\\_");

            const starIndex = pattern.indexOf("*");
            if (starIndex === -1) return pattern;

            if (starIndex !== pattern.length - 1) {
                throw new Error("Only trailing wildcards are supported in uriPatterns");
            }
            return pattern.slice(0, -1) + "%";
        });

        const result = await this.db.selectFrom('labels')
            .selectAll()
            .where(patterns.length ? "uri", "like", patterns.map(() => "?").join(" OR "))
            .where(sources.length ? `src`, `in`, sources.map(() => "?"))
            .where(cursor ? "id", ">", cursor)
            .orderBy('id', 'asc')
            .limit(limit)

        const stmt = this.db.prepare(`
            SELECT * FROM labels
            WHERE 1 = 1
            ${patterns.length ? "AND " + patterns.map(() => "uri LIKE ?").join(" OR ") : ""}
            ${sources.length ? `AND src IN (${sources.map(() => "?").join(", ")})` : ""}
            ${cursor ? "AND id > ?" : ""}
            ORDER BY id ASC
            LIMIT ?
        `);

        const params = [];
        if (patterns.length) params.push(...patterns);
        if (sources.length) params.push(...sources);
        if (cursor) params.push(cursor);
        params.push(limit);

        return stmt.all(...params) as unknown as Array<SavedLabel>;
    }

    isCursorInTheFuture(cursor: number) {
        const latest = this.db.prepare(`
            SELECT MAX(id) AS id FROM labels
        `).get() as { id: number };

        return cursor > latest.id;
    }

    getLatestCursor(): number | null {
        const latest = this.db.prepare(`
            SELECT MAX(id) AS id FROM labels
        `).get() as { id: number };

        return latest.id ?? null;
    }

    iterateLabels(cursor = 0) {
        const stmt = this.db.prepare(`
            SELECT * FROM labels
            WHERE id > ?
            ORDER BY id ASC
        `);

        return stmt.iterate(cursor) as Iterable<SavedLabel>;
    }
}
