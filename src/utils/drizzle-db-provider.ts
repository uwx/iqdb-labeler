import { DbProvider } from "#skyware/labeler/db-provider.js";
import { db } from "../backend/db.js";
import type { SavedLabel, SignedLabel } from "#skyware/labeler";
import toBuffer from 'typedarray-to-buffer';
import { XRPCError } from "@atcute/client";
import { At } from "@atcute/client/lexicons";
import { sql } from "kysely";

export class KyselyDbProvider implements DbProvider {

    constructor() {
    }

    async queryLabels(identifier: string, cursor = 0, limit = 1): Promise<SavedLabel[]> {
        return await db
            .selectFrom('Label')
            .selectAll()
            .where(eb => eb.and([eb('val', '=', identifier), eb('id', '>', cursor)]))
            .orderBy('id asc')
            .limit(limit)
            .execute() as SavedLabel[];
    }

    async saveLabel(label: SignedLabel): Promise<number> {
        const { src, uri, cid, val, neg, cts, exp, sig } = label;

        const results = await db.insertInto('Label').values({
            src, uri, cid, val, neg, cts, exp, sig: toBuffer(sig)
        }).onConflict(oc => oc.doNothing()).execute();

        if (!results.length) throw new Error("Failed to insert label");

        return Number(results[0].insertId);
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
            .selectFrom('Label')
            .selectAll()
            .where(eb => eb.and([
                ...(patterns.length > 0 ? [eb.or(patterns.map(pattern => eb('uri', 'like', pattern)))] : []),
                ...(sources.length > 0 ? [eb('src', 'in', sources as At.DID[])] : []),
                ...(cursor ? [eb('id', '>', cursor)] : []),
            ]))
            .orderBy('id asc')
            .limit(limit)
            .execute() as Array<SavedLabel>;
    }

    async isCursorInTheFuture(cursor: number) {
        // TODO how to do this with kysely
        const latest = await db.executeQuery(sql<{ id: number }>`
            SELECT MAX(id) AS id FROM Label
        `.compile(db));

        console.log('isCursorInTheFuture', latest.rows[0].id)

        return !latest.rows[0].id ? true : cursor > latest.rows[0].id;
    }

    iterateLabels(cursor = 0) {
        return db
            .selectFrom('Label')
            .selectAll()
            .where('id', '>', cursor)
            .orderBy('id asc')
            .stream() as AsyncIterableIterator<SavedLabel>;
    }
}
