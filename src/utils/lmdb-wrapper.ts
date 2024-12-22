/* eslint-disable @typescript-eslint/no-explicit-any */
import { rename } from 'fs/promises';
import { Database, DatabaseOptions, Key, open, RootDatabase, RootDatabaseOptions, Transaction, TransactionFlags } from 'lmdb';
import logger from '../backend/logger.js';

const sharedStructuresKey = Symbol.for('structures');

export class LmdbWrapper {
    private db_: RootDatabase<any, Key>;
    constructor(private readonly name: string, private readonly options: Partial<RootDatabaseOptions> = {}) {
        logger.debug(`Opening DB ${name}`);
        this.db_ = this.openDb();
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

    openDb(): RootDatabase<any, Key> {
        return open(this.name, {
            maxDbs: 25,
            compression: true,
            encoding: 'msgpack',
            sharedStructuresKey,
            pageSize: 8192, // By default, the maximum key size is 1978 bytes. If you explicitly set the pageSize to 8192 or higher, the maximum key size will be 4026, but this is the largest key size supported.

            ...this.options,
        });
    }

    async compactDb() {
        const adb = this.db;
        this.db_ = undefined!; // prevent dangerous ops
        await adb.backup(`${this.name}-compact`, true);
        adb.close();
        await rename(`./${this.name}`, `./${this.name}.001`);
        await rename(`./${this.name}-compact`, `./${this.name}`);
        this.db_ = this.openDb();
    }

    transaction<T>(action: () => T): Promise<T> {
        return this.db.transaction(action);
    }

    batch(action: () => any): Promise<boolean> {
        return this.db.batch(action);
    }

    // string values
    table(
        name: string,
        keyEncoding: 'uint32',
        encoding: 'string',
        opts?: DatabaseOptions,
    ): Database<string, number>;
    table(
        name: string,
        keyEncoding: 'binary',
        encoding: 'string',
        opts?: DatabaseOptions,
    ): Database<string, Uint8Array>;

    // uint32 keys. 4_294_967_295 is reserved for shared structures
    table<V>(
        name: string,
        keyEncoding: 'uint32',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
        opts?: DatabaseOptions,
    ): Database<V, number>;

    // arraybuffer keys
    table<V>(
        name: string,
        keyEncoding: 'binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
        opts?: DatabaseOptions,
    ): Database<V, Uint8Array>;

    // arbitrary keys
    table<V>(
        name: string,
        keyEncoding: 'ordered-binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
        opts?: DatabaseOptions,
    ): Database<V, Key>;

    // fallback
    table<K extends Key, V>(
        name: string,
        keyEncoding?: 'uint32' | 'binary' | 'ordered-binary',
        encoding?: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary',
        opts?: DatabaseOptions,
    ): Database<V, K>;

    table<K extends Key, V>(
        name: string,
        keyEncoding: 'uint32' | 'binary' | 'ordered-binary' = 'ordered-binary',
        encoding: 'msgpack' | 'json' | 'string' | 'binary' | 'ordered-binary' = 'msgpack',
        opts?: DatabaseOptions,
    ): Database<V, K> {
        return this.db.openDB(name, {
            compression: true,
            sharedStructuresKey: keyEncoding == 'uint32' ? 4_294_967_295 : sharedStructuresKey,

            keyEncoding,
            encoding,

            ...opts,
        });
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
        return new DatabaseSet<S>(this.table<S, Uint8Array>(name, keyEncoding));
    }
}

export class DatabaseSet<K extends Key = Key> {
    private static setValue = new Uint8Array();

    constructor(private readonly database: Database<Uint8Array, K>) { }

    /**
     * Get the value stored by given id/key
     * @param id The key for the entry
     * @param options Additional options for the retrieval
     **/
    has(id: K): boolean {
        return this.database.doesExist(id);
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
        return this.database.put(id, DatabaseSet.setValue, version!, ifVersion);
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
        return this.database.remove(id, ifVersion!);
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
        return this.database.putSync(id, DatabaseSet.setValue, version!);
    }

    /**
     * Synchronously remove the entry with the provided id/key
     * existing version
     * @param id The key for the entry to remove
     **/
    deleteSync(id: K): boolean {
        return this.database.removeSync(id);
    }

    /**
     * Execute a transaction asynchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     **/
    transaction<T>(action: () => T): Promise<T> {
        return this.database.transaction(action);
    }
    /**
     * Execute a transaction synchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     * @params flags Additional flags specifying transaction behavior, this is optional and defaults to abortable, synchronous commits that are flushed to disk before returning
     **/
    transactionSync<T>(action: () => T, flags?: TransactionFlags): T {
        return this.database.transactionSync(action, flags);
    }
    /**
     * Execute a transaction asynchronously, running all the actions within the action callback in the transaction,
     * and committing the transaction after the action callback completes.
     * existing version
     * @param action The function to execute within the transaction
     **/
    childTransaction<T>(action: () => T): Promise<T> {
        return this.database.childTransaction(action);
    }
    /**
     * Returns the transaction id of the currently executing transaction. This is an integer that increments with each
     * transaction. This is only available inside transaction callbacks (for transactionSync or asynchronous transaction),
     * and does not provide access transaction ids for asynchronous put/delete methods (the 'aftercommit' method can be
     * used for that).
     */
    getWriteTxnId(): number {
        return this.database.getWriteTxnId();
    }
    /**
     * Returns the current transaction and marks it as in use. This can then be explicitly used for read operations
     * @returns The transaction object
     **/
    useReadTransaction(): Transaction {
        return this.database.useReadTransaction();
    }
    /**
    /**
     * Execute a set of write operations that will all be batched together in next queued asynchronous transaction.
     * @param action The function to execute with a set of write operations.
     **/
    batch<T>(action: () => T): Promise<boolean> {
        return this.database.batch(action);
    }
    /**
     * Execute writes actions that are all conditionally dependent on the entry with the provided key having the provided
     * version number (checked atomically).
     * @param id Key of the entry to check
     * @param ifVersion The require version number of the entry for all actions to succeed
     * @param action The function to execute with actions that will be dependent on this condition
     **/
    ifVersion(id: K, ifVersion: number, action: () => any): Promise<boolean> {
        return this.database.ifVersion(id, ifVersion, action);
    }
    /**
     * Execute writes actions that are all conditionally dependent on the entry with the provided key
     * not existing (checked atomically).
     * @param id Key of the entry to check
     * @param action The function to execute with actions that will be dependent on this condition
     **/
    ifNoExists(id: K, action: () => any): Promise<boolean> {
        return this.database.ifNoExists(id, action);
    }

    /**
     * Delete this database/store (asynchronously).
     **/
    drop(): Promise<void> {
        return this.database.drop();
    }
    /**
     * Synchronously delete this database/store.
     **/
    dropSync(): void {
        return this.database.dropSync();
    }

    /**
     * Asynchronously clear all the entries from this database/store.
     **/
    clearAsync(): Promise<void> {
        return this.database.clearAsync();
    }
    /**
     * Synchronously clear all the entries from this database/store.
     **/
    clearSync(): void {
        return this.database.clearSync();
    }

    /** A promise-like object that resolves when previous writes have been committed.  */
    get committed(): Promise<boolean> {
        return this.database.committed;
    }
    /** A promise-like object that resolves when previous writes have been committed and fully flushed/synced to disk/storage.  */
    get flushed(): Promise<boolean> {
        return this.database.flushed;
    }
    /**
     * Check the reader locks and remove any stale reader locks. Returns the number of stale locks that were removed.
     **/
    readerCheck(): number {
        return this.database.readerCheck();
    }
    /**
     * Returns a string that describes all the current reader locks, useful for debugging if reader locks aren't being removed.
     **/
    readerList(): string {
        return this.database.readerList();
    }
    /**
     * Returns statistics about the current database
     **/
    getStats(): unknown {
        return this.database.getStats();
    }
    /**
     * Explicitly force the read transaction to reset to the latest snapshot/version of the database
     **/
    resetReadTxn(): void {
        return this.database.resetReadTxn();
    }
    /**
     * Make a snapshot copy of the current database at the indicated path
     * @param path Path to store the backup
     * @param compact Apply compaction while making the backup (slower and smaller)
     **/
    backup(path: string, compact: boolean): Promise<void> {
        return this.database.backup(path, compact);
    }
    /**
     * Close the current database.
     **/
    close(): Promise<void> {
        return this.database.close();
    }
    /**
     * Add event listener
     */
    on(event: 'beforecommit' | 'aftercommit', callback: (event: any) => void): void {
        return this.database.on(event, callback);
    }
}
