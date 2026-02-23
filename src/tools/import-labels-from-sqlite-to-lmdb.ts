import { DefaultDbProvider } from "#skyware/labeler/db-provider.js";
import { db } from "../backend/lmdb.js";
import logger from "../backend/logger.js";
import { LmdbDbProvider } from "../utils/lmdb-skyware-db-provider.js";

const sqliteProvider = new DefaultDbProvider();
const lmdbProvider = new LmdbDbProvider(db);

for (const label of sqliteProvider.iterateLabels()) {
    logger.info(label.id);
    const { src, uri, cid, val, neg, cts, exp, sig } = label;

    await lmdbProvider.labels.ifNoExists(label.id, () => {
        db.transaction(() => {
            lmdbProvider.nextIdxDb.put(0, Math.max(lmdbProvider.nextIdxDb.get(0) ?? 0, label.id));
            lmdbProvider.labels.put(label.id, { src, uri, cid, val, neg, cts, exp, sig });
            lmdbProvider.labelsByIdentifier.put(label.val, label.id);
        });
    });
}