/* eslint-disable @typescript-eslint/no-explicit-any */
import { rename } from 'fs/promises';
import logger from '../backend/logger.js';
import { DatabaseSync,SQLInputValue,SQLOutputValue,StatementResultingChanges,StatementSync } from 'node:sqlite';
import { toBufferKey, fromBufferKey } from 'ordered-binary';
import { pack,unpack } from 'msgpackr';

const sharedStructuresKey = Symbol.for('structures');

export type Key = Key[] | string | symbol | number | boolean | Uint8Array;

type None = Record<string, never>;
type StatementSync<
    A extends SQLInputValue[] = SQLInputValue[],
    B extends Record<string, SQLInputValue> = None,
    R extends Record<string, SQLOutputValue> = Record<string, SQLOutputValue>,
> = {
    /**
     * This method executes a prepared statement and returns all results as an array of
     * objects. If the prepared statement does not return any results, this method
     * returns an empty array. The prepared statement [parameters are bound](https://www.sqlite.org/c3ref/bind_blob.html) using
     * the values in `namedParameters` and `anonymousParameters`.
     * @since v22.5.0
     * @param namedParameters An optional object used to bind named parameters. The keys of this object are used to configure the mapping.
     * @param anonymousParameters Zero or more values to bind to anonymous parameters.
     * @return An array of objects. Each object corresponds to a row returned by executing the prepared statement. The keys and values of each object correspond to the column names and values of
     * the row.
     */
    all(...anonymousParameters: A): R;
    all(
        namedParameters: B,
        ...anonymousParameters: A
    ): R[];

    /**
     * This method executes a prepared statement and returns the first result as an
     * object. If the prepared statement does not return any results, this method
     * returns `undefined`. The prepared statement [parameters are bound](https://www.sqlite.org/c3ref/bind_blob.html) using the
     * values in `namedParameters` and `anonymousParameters`.
     * @since v22.5.0
     * @param namedParameters An optional object used to bind named parameters. The keys of this object are used to configure the mapping.
     * @param anonymousParameters Zero or more values to bind to anonymous parameters.
     * @return An object corresponding to the first row returned by executing the prepared statement. The keys and values of the object correspond to the column names and values of the row. If no
     * rows were returned from the database then this method returns `undefined`.
     */
    get(...anonymousParameters: A): R | undefined;
    get(
        namedParameters: B,
        ...anonymousParameters: A
    ): R | undefined;
    /**
     * This method executes a prepared statement and returns an iterator of
     * objects. If the prepared statement does not return any results, this method
     * returns an empty iterator. The prepared statement [parameters are bound](https://www.sqlite.org/c3ref/bind_blob.html) using
     * the values in `namedParameters` and `anonymousParameters`.
     * @since v22.13.0
     * @param namedParameters An optional object used to bind named parameters.
     * The keys of this object are used to configure the mapping.
     * @param anonymousParameters Zero or more values to bind to anonymous parameters.
     * @returns An iterable iterator of objects. Each object corresponds to a row
     * returned by executing the prepared statement. The keys and values of each
     * object correspond to the column names and values of the row.
     */
    iterate(...anonymousParameters: A): NodeJS.Iterator<R>;
    iterate(
        namedParameters: B,
        ...anonymousParameters: A
    ): NodeJS.Iterator<R>;
    /**
     * This method executes a prepared statement and returns an object summarizing the
     * resulting changes. The prepared statement [parameters are bound](https://www.sqlite.org/c3ref/bind_blob.html) using the
     * values in `namedParameters` and `anonymousParameters`.
     * @since v22.5.0
     * @param namedParameters An optional object used to bind named parameters. The keys of this object are used to configure the mapping.
     * @param anonymousParameters Zero or more values to bind to anonymous parameters.
     */
    run(...anonymousParameters: A): StatementResultingChanges;
    run(
        namedParameters: B,
        ...anonymousParameters: A
    ): StatementResultingChanges;
}

export class SqliteWrapper {
    private db_: DatabaseSync;
    private _set: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number]>;
    private _setIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number, ifVersion: number]>;
    private _get: StatementSync<[superkey: Uint8Array, key: Uint8Array], None, {value: Uint8Array<ArrayBuffer>, version: number}>;
    private _delete: StatementSync<[superkey: Uint8Array, key: Uint8Array]>;
    private _deleteWithValue: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array]>;
    private _deleteIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, ifVersion: number]>;

    constructor(private readonly name: string) {
        logger.debug(`Opening DB ${name}`);
        this.db_ = this.openDb();
        this._set = this.db_.prepare(`--sql
            INSERT INTO genericdb (superkey, key, value, version) VALUES (?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, version=excluded.version
        `) as any
        this._setIfVersion = this.db_.prepare(`--sql
            INSERT INTO genericdb (superkey, key, value, version) VALUES (?, ?, ?, ?)
            WHERE version = ?
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, version=excluded.version
            WHERE version = ?
        `) as any
        this._get = this.db_.prepare(`--sql
            SELECT value, version FROM genericdb WHERE key = ? AND superkey = ?
        `) as any
        this._delete = this.db_.prepare(`--sql
            DELETE FROM genericdb WHERE key = ? AND superkey = ?
        `) as any
        this._deleteWithValue = this.db_.prepare(`--sql
            DELETE FROM genericdb WHERE key = ? AND superkey = ? AND value = ?
        `) as any
        this._deleteIfVersion = this.db_.prepare(`--sql
            DELETE FROM genericdb WHERE key = ? AND version = ? AND superkey = ?
        `) as any
        logger.debug(`Opened DB ${name}`);

        const self = this;
        function beforeExit() {
            process.off('beforeExit', beforeExit);
            logger.debug(`Closing DB ${name}`);
            self.db?.close();
            logger.debug(`Closed DB ${name}`);
        }

        process.on('beforeExit', beforeExit);
    }

    get db() { return this.db_; };

    openDb(): DatabaseSync {
        const db = new DatabaseSync(this.name ?? "labels.db");
        db.exec("pragma journal_mode = WAL;");
        db.exec(`--sql
            CREATE TABLE IF NOT EXISTS genericdb (
                superkey BLOB,
                key BLOB,
                value BLOB,
                version INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (superkey, key)
            );
        `);
        return db;
    }

    async compactDb() {
        const db = this.db_;
        db.exec(`--sql
            VACUUM;
        `);
    }

    transaction<T>(action: () => T): Promise<T> {
        this.db_.exec(`--sql
            BEGIN TRANSACTION;
        `);
        let result;
        try {
            result = action();
        } catch (err) {
            this.db_.exec(`--sql
                ROLLBACK;
            `);
            throw err;
        }
        this.db_.exec(`--sql
            COMMIT;
        `);
        return Promise.resolve(result);
    }

    // string values
    table(
        name: string,
        keyEncoding: 'uint32',
        encoding: 'string',
    ): Database<string, number>;
    table(
        name: string,
        keyEncoding: 'binary',
        encoding: 'string',
    ): Database<string, Uint8Array>;

    // uint32 keys. 4_294_967_295 is reserved for shared structures
    table<V>(
        name: string,
        keyEncoding: 'uint32',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
    ): Database<V, number>;

    // arraybuffer keys
    table<V>(
        name: string,
        keyEncoding: 'binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
    ): Database<V, Uint8Array>;

    // arbitrary keys
    table<V>(
        name: string,
        keyEncoding: 'ordered-binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
    ): Database<V, Key>;

    // fallback
    table<K extends Key, V>(
        name: string,
        keyEncoding?: 'uint32' | 'binary' | 'ordered-binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
    ): Database<V, K>;

    table<K extends Key, V>(
        name: string,
        keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
        encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'msgpack',
    ): Database<V, K> {
        return new Database<V, K>(this.db_, this._set, this._setIfVersion, this._get, this._delete, this._deleteWithValue, this._deleteIfVersion, name, keyEncoding, encoding);
    }

    set(
        name: string,
        keyEncoding: 'uint32',
    ): DatabaseSet<number>;
    set(
        name: string,
        keyEncoding: 'binary',
    ): DatabaseSet<Uint8Array>;
    set<S extends Key>(
        name: string,
        keyEncoding?: 'uint32' | 'binary' | 'ordered-binary',
    ): DatabaseSet<S>;
    set<S extends Key>(
        name: string,
        keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
    ): DatabaseSet<S> {
        return new DatabaseSet<S>(this.db_, this._set, this._setIfVersion, this._get, this._delete, this._deleteIfVersion, name, keyEncoding);
    }
}

export class Database<V = any, K extends Key = Key> {
    private readonly encodeKey: (key: K) => Uint8Array;
    private readonly encodeValue: (value: V) => Uint8Array;
    private readonly decodeValue: (data: Uint8Array) => V;
    private readonly nameKey: Uint8Array;

    constructor(
        private readonly db_: DatabaseSync,
        private readonly set: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number]>,
        private readonly setIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number, ifVersion: number]>,
        private readonly getStmt: StatementSync<[superkey: Uint8Array, key: Uint8Array], None, {value: Uint8Array<ArrayBuffer>, version: number}>,
        private readonly deleteStmt: StatementSync<[superkey: Uint8Array, key: Uint8Array]>,
        private readonly deleteWithValue: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array]>,
        private readonly deleteIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, ifVersion: number]>,
        private readonly name: string,
        keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
        encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'msgpack',
    ) {
        if (keyEncoding == 'uint32') {
            this.encodeKey = (key: K) => {
                const buffer = new ArrayBuffer(4);
                new DataView(buffer).setUint32(0, key as unknown as number);
                return new Uint8Array(buffer);
            }
        } else if (keyEncoding == 'binary') {
            this.encodeKey = (key: K) => key as unknown as Uint8Array;
        } else if (keyEncoding == 'ordered-binary') {
            this.encodeKey = (key: K) => toBufferKey(key);
        } else {
            throw new Error(`Invalid key encoding: ${keyEncoding}`);
        }

        if (encoding == 'msgpack') {
            this.encodeValue = (value: V) => pack(value);
            this.decodeValue = (data: Uint8Array) => unpack(data);
        } else if (encoding == 'json') {
            this.encodeValue = (value: V) => new TextEncoder().encode(JSON.stringify(value));
            this.decodeValue = (data: Uint8Array) => JSON.parse(new TextDecoder().decode(data));
        } else if (encoding == 'string') {
            this.encodeValue = (value: V) => new TextEncoder().encode(String(value));
            this.decodeValue = (data: Uint8Array) => new TextDecoder().decode(data) as unknown as V;
        } else if (encoding == 'binary') {
            this.encodeValue = (value: V) => value as unknown as Uint8Array;
            this.decodeValue = (data: Uint8Array) => data as unknown as V;
        } else if (encoding == 'ordered-binary') {
            this.encodeValue = (value: V) => toBufferKey(value as Key);
            this.decodeValue = (data: Uint8Array) => fromBufferKey(Buffer.from(data)) as V;
        } else {
            throw new Error(`Invalid encoding: ${encoding}`);
        }

        this.nameKey = toBufferKey(this.name);
    }
    /**
     * Get the value stored by given id/key
     * @param id The key for the entry
     * @param options Additional options for the retrieval
     **/
    get(id: K): V | undefined {
        const row = this.getStmt.get(this.nameKey, this.encodeKey(id));
        if (!row) return undefined;
        const value = row.value;
        return this.decodeValue(value);
    }

    /**
     * Store the provided value, using the provided id/key and version number, and optionally the required
     * existing version
     * @param id The key for the entry
     * @param value The value to store
     * @param version The version number to assign to this entry
     * @param ifVersion If provided the put will only succeed if the previous version number matches this (atomically checked)
     **/
    put(id: K, value: V, version?: number, ifVersion?: number): Promise<boolean> {
        const encodedValue = this.encodeValue(value);
        if (ifVersion !== undefined) {
            const changes = this.setIfVersion.run(this.nameKey, this.encodeKey(id), encodedValue, version ?? 0, ifVersion);
            return Promise.resolve(changes.changes > 0);
        } else {
            const changes = this.set.run(this.nameKey, this.encodeKey(id), encodedValue, version ?? 0);
            return Promise.resolve(changes.changes > 0);
        }
    }

    /**
     * Remove the entry with the provided id/key
     * @param id The key for the entry to remove
     **/
    remove(id: K): Promise<boolean>;
    /**
     * Remove the entry with the provided id/key, conditionally based on the provided existing version number
     * @param id The key for the entry to remove
     * @param ifVersion If provided the remove will only succeed if the previous version number matches this (atomically checked)
     **/
    remove(id: K, ifVersion: number): Promise<boolean>;
    /**
     * Remove the entry with the provided id/key and value (mainly used for dupsort databases) and optionally the required
     * existing version
     * @param id The key for the entry to remove
     * @param valueToRemove The value for the entry to remove
     **/
    remove(id: K, valueToRemove: V): Promise<boolean>;

    remove(id: K, arg2?: number | V): Promise<boolean> {
        if (typeof arg2 === 'number') {
            const changes = this.deleteIfVersion.run(this.nameKey, this.encodeKey(id), arg2);
            return Promise.resolve(changes.changes > 0);
        } else if (arg2 !== undefined) {
            const changes = this.deleteStmt.run(this.nameKey, this.encodeKey(id));
            return Promise.resolve(changes.changes > 0);
        } else {
            const changes = this.deleteWithValue.run(this.nameKey, this.encodeKey(id), this.encodeValue(arg2 as V));
            return Promise.resolve(changes.changes > 0);
        }
    }

    /**
     * Synchronously store the provided value, using the provided id/key and version number
     * @param id The key for the entry
     * @param value The value to store
     * @param version The version number to assign to this entry
     **/
    putSync(id: K, value: V, version?: number): void {
        const encodedValue = this.encodeValue(value);
        this.set.run(this.nameKey, this.encodeKey(id), encodedValue, version ?? 0);
        return;
    }
    /**
     * Synchronously remove the entry with the provided id/key
     * existing version
     * @param id The key for the entry to remove
     **/
    removeSync(id: K): boolean;
    /**
     * Synchronously remove the entry with the provided id/key and value (mainly used for dupsort databases)
     * existing version
     * @param id The key for the entry to remove
     * @param valueToRemove The value for the entry to remove
     **/
    removeSync(id: K, valueToRemove: V): boolean;
    removeSync(id: K, valueToRemove?: V): boolean {
        if (valueToRemove !== undefined) {
            const changes = this.deleteWithValue.run(this.nameKey, this.encodeKey(id), this.encodeValue(valueToRemove));
            return changes.changes > 0;
        } else {
            const changes = this.deleteStmt.run(this.nameKey, this.encodeKey(id));
            return changes.changes > 0;
        }
    }

    doesExist(id: K): boolean {
        const row = this.getStmt.get(this.nameKey, this.encodeKey(id));
        return !!row;
    }
}

export class DatabaseSet<K extends Key = Key> {
    private static readonly setValue = new Uint8Array();

    private readonly encodeKey: (key: K) => Uint8Array;
    private readonly nameKey: Uint8Array;

    constructor(
        private readonly database: DatabaseSync,
        private readonly set: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number]>,
        private readonly setIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, value: Uint8Array, version: number, ifVersion: number]>,
        private readonly get: StatementSync<[superkey: Uint8Array, key: Uint8Array], None, {value: Uint8Array<ArrayBuffer>, version: number}>,
        private readonly deleteStmt: StatementSync<[superkey: Uint8Array, key: Uint8Array]>,
        private readonly deleteIfVersion: StatementSync<[superkey: Uint8Array, key: Uint8Array, ifVersion: number]>,
        private readonly name: string,
        keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
    ) {
        if (keyEncoding == 'uint32') {
            this.encodeKey = (key: K) => {
                const buffer = new ArrayBuffer(4);
                new DataView(buffer).setUint32(0, key as unknown as number);
                return new Uint8Array(buffer);
            }
        } else if (keyEncoding == 'binary') {
            this.encodeKey = (key: K) => key as unknown as Uint8Array;
        } else if (keyEncoding == 'ordered-binary') {
            this.encodeKey = (key: K) => toBufferKey(key);
        } else {
            throw new Error(`Invalid key encoding: ${keyEncoding}`);
        }

        this.nameKey = toBufferKey(this.name);
    }

    /**
     * Get the value stored by given id/key
     * @param id The key for the entry
     * @param options Additional options for the retrieval
     **/
    has(id: K): boolean {
        const row = this.get.get(this.nameKey, this.encodeKey(id));
        return !!row;
    }

    /**
     * Store the provided value, using the provided id/key
     * @param id The key for the entry
     **/
    add(id: K): Promise<boolean>;

    /**
     * Store the provided value, using the provided id/key and version number, and optionally the required
     * existing version
     * @param id The key for the entry
     * @param version The version number to assign to this entry
     * @param ifVersion If provided the put will only succeed if the previous version number matches this (atomically checked)
     **/
    add(id: K, version: number, ifVersion?: number): Promise<boolean>;

    add(id: K, version?: number, ifVersion?: number): Promise<boolean> {
        if (ifVersion !== undefined) {
            const changes = this.setIfVersion.run(this.nameKey, this.encodeKey(id), DatabaseSet.setValue, version ?? 0, ifVersion);
            return Promise.resolve(changes.changes > 0);
        } else {
            const changes = this.set.run(this.nameKey, this.encodeKey(id), DatabaseSet.setValue, version ?? 0);
            return Promise.resolve(changes.changes > 0);
        }
    }

    /**
     * Remove the entry with the provided id/key
     * @param id The key for the entry to remove
     **/
    delete(id: K): Promise<boolean>;

    /**
     * Remove the entry with the provided id/key, conditionally based on the provided existing version number
     * @param id The key for the entry to remove
     * @param ifVersion If provided the remove will only succeed if the previous version number matches this (atomically checked)
     **/
    delete(id: K, ifVersion: number): Promise<boolean>

    /**
     * Remove the entry with the provided id/key, conditionally based on the provided existing version number
     * @param id The key for the entry to remove
     * @param ifVersion If provided the remove will only succeed if the previous version number matches this (atomically checked)
     **/
    delete(id: K, ifVersion?: number): Promise<boolean> {
        if (ifVersion !== undefined) {
            const changes = this.deleteIfVersion.run(this.nameKey, this.encodeKey(id), ifVersion);
            return Promise.resolve(changes.changes > 0);
        } else {
            const changes = this.deleteStmt.run(this.nameKey, this.encodeKey(id));
            return Promise.resolve(changes.changes > 0);
        }
    }
    /**
     * Synchronously store the provided value, using the provided id/key, will return after the data has been written.
     * @param id The key for the entry
     **/
    addSync(id: K): void
    /**
     * Synchronously store the provided value, using the provided id/key and version number
     * @param id The key for the entry
     * @param version The version number to assign to this entry
     **/
    addSync(id: K, version: number): void

    /**
     * Synchronously store the provided value, using the provided id/key and version number
     * @param id The key for the entry
     * @param version The version number to assign to this entry
     **/
    addSync(id: K, version?: number): void {
        this.set.run(this.nameKey, this.encodeKey(id), DatabaseSet.setValue, version!);
    }

    /**
     * Synchronously remove the entry with the provided id/key
     * existing version
     * @param id The key for the entry to remove
     **/
    deleteSync(id: K): boolean {
        const changes = this.deleteStmt.run(this.nameKey, this.encodeKey(id));
        return changes.changes > 0;
    }

    /**
     * Execute a transaction asynchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     **/
    transaction<T>(action: () => T): Promise<T> {
        this.database.exec(`--sql
            BEGIN TRANSACTION;
        `);
        let result;
        try {
            result = action();
        } catch (err) {
            this.database.exec(`--sql
                ROLLBACK;
            `);
            throw err;
        }
        this.database.exec(`--sql
            COMMIT;
        `);
        return Promise.resolve(result);
    }
    /**
     * Execute a transaction synchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     * @params flags Additional flags specifying transaction behavior, this is optional and defaults to abortable, synchronous commits that are flushed to disk before returning
     **/
    transactionSync<T>(action: () => T): T {
        this.database.exec(`--sql
            BEGIN TRANSACTION;
        `);
        let result;
        try {
            result = action();
        } catch (err) {
            this.database.exec(`--sql
                ROLLBACK;
            `);
            throw err;
        }
        this.database.exec(`--sql
            COMMIT;
        `);
        return result;
    }
    /**
     * Execute a transaction asynchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     **/
    childTransaction<T>(action: () => T): Promise<T> {
        this.database.exec(`--sql
            SAVEPOINT sp;
        `);
        let result;
        try {
            result = action();
        } catch (err) {
            this.database.exec(`--sql
                ROLLBACK TO sp;
            `);
            throw err;
        }
        this.database.exec(`--sql
            RELEASE sp;
        `);
        return Promise.resolve(result);
    }
    /**
     * Execute writes actions that are all conditionally dependent on the entry with the provided key having the provided
     * version number (checked atomically).
     * @param id Key of the entry to check
     * @param ifVersion The require version number of the entry for all actions to succeed
     * @param action The function to execute with actions that will be dependent on this condition
     **/
    ifVersion(id: K, ifVersion: number, action: () => any): Promise<boolean> {
        return this.transaction(() => {
            const result = this.get.get(this.nameKey, this.encodeKey(id));
            if (!result || result.version !== ifVersion) {
                return false;
            }
            action();
            this.set.run(this.nameKey, this.encodeKey(id), DatabaseSet.setValue, ifVersion);
            return true;
        });
    }
    /**
     * Execute writes actions that are all conditionally dependent on the entry with the provided key
     * not existing (checked atomically).
     * @param id Key of the entry to check
     * @param action The function to execute with actions that will be dependent on this condition
     **/
    ifNoExists(id: K, action: () => any): Promise<boolean> {
        return this.transaction(() => {
            const result = this.get.get(this.nameKey, this.encodeKey(id));
            if (result) {
                return false;
            }
            action();
            this.set.run(this.nameKey, this.encodeKey(id), DatabaseSet.setValue, 0);
            return true;
        });
    }
}
