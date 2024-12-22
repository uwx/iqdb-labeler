import { SavedLabel, SignedLabel } from "#skyware/labeler";
import { DbProvider as SkywareDbProvider } from "#skyware/labeler/db-provider.js";
import { Database } from "lmdb";
import { LmdbWrapper } from "./lmdb-wrapper.js";

export class LmdbDbProvider implements SkywareDbProvider {
    labels: Database<SignedLabel, number>;
    labelsByIdentifier: Database<number, string>;
    nextIdxDb: Database<number, number>;

    constructor(private readonly db: LmdbWrapper) {
        this.labels = db.table<number, SignedLabel>('labels', 'ordered-binary', 'msgpack');

        // keyed by SignedLabel.val
        this.labelsByIdentifier = db.table<string, number>('label-by-identifier', 'ordered-binary', 'msgpack', { dupSort: true });
        this.nextIdxDb = db.table<number, number>('label-last-idx', 'uint32', 'ordered-binary');
    }

    async getAndIncrementIdx() {
        return await this.db.transaction(() => {
            const idx = this.nextIdxDb.get(0) ?? 0;
            this.nextIdxDb.put(0, idx + 1);
            return idx;
        });
    }

    async queryLabels(identifier: string, cursor = 0, limit = 1): Promise<SavedLabel[]> {
        const keys = this.labelsByIdentifier.getValues(identifier, {offset: cursor, limit}).asArray;

        return (await this.labels.getMany(keys))
            .map((label, idx) => label != undefined ? {
                id: keys[idx],
                ...label
            } satisfies SavedLabel : undefined)
            .filter(label => label !== undefined);
    }

    async saveLabel(label: SignedLabel): Promise<number> {
        const id = await this.getAndIncrementIdx();

		const { src, uri, cid, val, neg, cts, exp, sig } = label;

        this.db.batch(() => {
            this.labels.put(id, { src, uri, cid, val, neg, cts, exp, sig });
            this.labelsByIdentifier.put(val, id);
        });

		return id;
    }

    searchLabels(cursor?: number, limit = 50, uriPatterns: string[] = [], sources: string[] = []) {
        function escapeRegExp(string: string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
        }

		const pattern = uriPatterns.includes("*") ? '' : uriPatterns.map((pattern) => escapeRegExp(pattern).replace(/\\\*/g, '.*')).join('|');
        const regex = pattern ? new RegExp(pattern) : undefined;

        const results = this.labels
            .getRange({ start: cursor })
            .filter(({key, value}) => (sources.length === 0 || sources.includes(value.src)) && (regex === undefined || regex.test(value.uri)) && key !== cursor)
            .slice(0, limit)
            .map(({key, value}) => ({
                id: key,
                ...value
            } satisfies SavedLabel))
            .asArray;

        return results;
    }

    isCursorInTheFuture(cursor: number): boolean {
        const nextId = this.nextIdxDb.get(0);
        if (nextId === undefined) return cursor > 0;
        return cursor > (nextId - 1);
    }

    iterateLabels(cursor = 0) {
        return this.labels.getRange({ start: cursor })
            .map(({key, value}) => ({
                id: key,
                ...value
            } satisfies SavedLabel));
    }
}