import { DbProvider } from "#skyware/labeler/db-provider.js";
import { and, asc, eq, gt, inArray, like, max, or, sql } from "drizzle-orm";
import { db, takeUniqueOrUndefined } from "../backend/db.js";
import { labels } from "../backend/schema.js";
import type { SavedLabel, SignedLabel } from "#skyware/labeler";
import toBuffer from 'typedarray-to-buffer';
import { XRPCError } from "@atcute/client";
import { At } from "@atcute/client/lexicons";

export class DrizzleDbProvider implements DbProvider {

    constructor(dbPath?: string) {
    }

    async queryLabels(identifier: string, cursor = 0, limit = 1): Promise<SavedLabel[]> {
        return await db
            .select()
            .from(labels)
            .where(and(eq(labels.val, identifier), gt(labels.id, cursor)))
            .orderBy(asc(labels.id))
            .limit(limit);
    }

    async saveLabel(label: SignedLabel): Promise<number> {
        const { src, uri, cid, val, neg, cts, exp, sig } = label;

        const results = await db.insert(labels).values({
            src, uri, cid, val, neg, cts, exp, sig: toBuffer(sig)
        }).onConflictDoNothing();

        if (!results.rowsAffected) throw new Error("Failed to insert label");

        return Number(results.lastInsertRowid);
    }

    async searchLabels(cursor?: number, limit = 50, uriPatterns: string[] = [], sources: string[] = []) {
        const patterns = uriPatterns.includes("*") ? [] : uriPatterns.map((pattern) => {
            pattern = pattern.replaceAll(/%/g, "").replaceAll(/_/g, "\\_");

            const starIndex = pattern.indexOf("*");
            if (starIndex === -1) return pattern;

            if (starIndex !== pattern.length - 1) {
                throw new XRPCError(400, {
                    kind: "InvalidRequest",
                    description: "Only trailing wildcards are supported in uriPatterns",
                });
            }
            return pattern.slice(0, -1) + "%";
        });

        return await db
            .select()
            .from(labels)
            .where(and(...[
                sql`(1 = 1)`,
                ...(patterns.length > 0 ? [or(...patterns.map(pattern => like(labels.uri, pattern)))] : []),
                ...(sources.length > 0 ? [inArray(labels.src, sources as At.DID[])] : []),
                ...(cursor ? [gt(labels.id, cursor!)] : []),
            ]))
            .orderBy(asc(labels.id))
            .limit(limit) as Array<SavedLabel>;
    }

    async isCursorInTheFuture(cursor: number) {
        await db.select({ id: max(labels.id) }).from(labels).limit(1).then(takeUniqueOrUndefined);
        const latest = this.db.prepare(`
            SELECT MAX(id) AS id FROM labels
        `).get() as { id: number };

        return cursor > latest.id;
    }

    iterateLabels(cursor = 0) {
        const stmt = this.db.prepare<[number]>(`
            SELECT * FROM labels
            WHERE id > ?
            ORDER BY id ASC
        `);

        return stmt.iterate(cursor) as Iterable<SavedLabel>;
    }
}
