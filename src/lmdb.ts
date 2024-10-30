import { Database, Key, open } from 'lmdb';

const db = open('database', {
    maxDbs: 25,
    compression: true,
    encoding: 'msgpack',
	sharedStructuresKey: Symbol.for('structures')
});

// string values
export function table(
    name: string,
    keyEncoding: 'uint32',
    encoding: 'string',
): Database<string, number>;
export function table(
    name: string,
    keyEncoding: 'binary',
    encoding: 'string',
): Database<string, Uint8Array>;

// uint32 keys
export function table<V>(
    name: string,
    keyEncoding: 'uint32',
    encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
): Database<V, number>;

// arraybuffer keys
export function table<V>(
    name: string,
    keyEncoding: 'binary',
    encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
): Database<V, Uint8Array>;

// arbitrary keys
export function table<V>(
    name: string,
    keyEncoding: 'ordered-binary',
    encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
): Database<V, Key>;

export function table<K extends Key, V>(
    name: string,
    keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
    encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'msgpack',
): Database<V, K> {
    return db.openDB(name, {
        keyEncoding,
        encoding
    });
}

process.on('beforeExit', () => {
    db.close();
});