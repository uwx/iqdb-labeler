import { pack, unpack } from 'msgpackr';
import { createDb } from '../backend/kysely/index.js';
import { DB_PATH } from '../config.js';

type ConfigItems = {
    jetstreamCursor: number;
};

const db = createDb(DB_PATH);

export async function getDbConfigItem<K extends keyof ConfigItems>(key: K): Promise<ConfigItems[K] | null> {
    const row = await db.selectFrom('config').select('value').where('key', '=', key).executeTakeFirst();
    return row ? (unpack(row.value) as ConfigItems[K]) : null;
}
export async function setDbConfigItem<K extends keyof ConfigItems>(key: K, value: ConfigItems[K]) {
    await db
        .insertInto('config')
        .values({ key, value: pack(value) })
        .onConflict((oc) => oc.column('key').doUpdateSet({ value: pack(value) }))
        .execute();
}
