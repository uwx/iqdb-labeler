import { db } from "../lmdb.js";

type ConfigItems = {
    jetstreamCursor: number
};

const configTable = db.table<keyof ConfigItems, unknown>('config', 'ordered-binary', 'msgpack');
export function getDbConfigItem<K extends keyof ConfigItems>(key: K): ConfigItems[K] {
    return configTable.get(key) as ConfigItems[K];
}
export async function setDbConfigItem<K extends keyof ConfigItems>(key: K, value: ConfigItems[K]) {
    await configTable.put(key, value);
}
