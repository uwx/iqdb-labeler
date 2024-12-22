import { encodeToBitArray, decodeFromBitArray, LuminosityLevel } from "./puzzle/index.js";
import { generateSignature as phashGenerateSignature } from "./phash/index.js";
import { loadAndGenerateSignature as puzzleGenerateSignature } from "./edge/puzzle-nativeaot.js";
import sharp from 'sharp';
import { readFile } from "node:fs/promises";
import bmp from "sharp-bmp";
import { uint64ToUint8Array, uint8ArrayToUint64 } from "../utils/ints.js";
import SQLite from 'better-sqlite3'

export const riDb = new Kysely<DB>({
    dialect: new SqliteDialect({
        database: new SQLite("./db/reverse-image.db"),
    }),
    log(event) {
        if (event.level === "error") {
            logger.error({
                error: event.error,
                sql: event.query.sql,
                params: event.query.parameters,
            }, `RIDB query failed in ${event.queryDurationMillis.toFixed(2)}ms`);
        } else { // 'query'
            logger.trace({
                sql: event.query.sql,
                params: event.query.parameters,
            }, `RIDB query executed in ${event.queryDurationMillis.toFixed(2)}ms`);
        }
    }
});

await sql`PRAGMA journal_mode = WAL`.execute(riDb);

// temp
import { PartialPost } from "../utils/booru-client/types.js";
import { Insertable, Kysely, sql, SqliteDialect } from "kysely";
import { DB, ScraperEntry } from "../backend/db/ridb-types.js";
import logger from "../backend/logger.js";
import toBuffer from "typedarray-to-buffer";

const enum HashType {
    Puzzle,
    PHash,
}

export enum Service {
    Danbooru,
    E621,
    Konachan,
    Rule34,
    Yandere,
    Gelbooru,
}

export interface PostEntry {
    service: Service;
    get postId(): number;
    toScraperEntry(): Insertable<ScraperEntry>;
}

export class IdPostEntry {
    constructor(public readonly postId: number, public readonly service: Service, public readonly md5?: string) {}

    static fromScraperEntry(scraperEntry: ScraperEntry) {
        return new this(+scraperEntry.id, scraperEntry.service, scraperEntry.md5 ?? undefined);
    }

    toScraperEntry() {
        return {
            service: this.service,
            id: this.postId,
            ...(this.md5 ? { md5: this.md5 ?? null } : {})
        };
    }
}

/**
 * Generates an image signature from an image and adds it to the database.
 * @param input The image data or a path to a file.
 * @param value The booru post to relate the image signature to.
 * @returns A key that can be used to fetch the entry using {@link getEntry}
 */
export async function addEntry(input: string
    | Buffer
    | ArrayBuffer
    | Uint8Array
    | Uint8ClampedArray
    | Int8Array
    | Uint16Array
    | Int16Array
    | Uint32Array
    | Int32Array
    | Float32Array
    | Float64Array,
    value: PostEntry
): Promise<[key: [service: Service, postId: number], puzzleSigArray: Uint8Array, phashSigArray: Uint8Array]> {
    const img = typeof input !== 'string' && isBmp(input)
        ? (bmp.sharpFromBmp(Buffer.from(input as ArrayBuffer), { failOnError: false }) as sharp.Sharp)
        : sharp(input, { failOnError: false });

    const uid = value.postId;

    const [puzzleSignature, phashSignature] = await Promise.all([
        puzzleGenerateSignature(typeof input === 'string' ? await readFile(input) : new Uint8Array(input)),
        phashGenerateSignature(img)
    ]);

    const puzzleSigArray = new Uint8Array(encodeToBitArray(puzzleSignature));
    const phashSigArray = uint64ToUint8Array(phashSignature);

    await riDb.transaction().execute(async trx => {
        await trx.insertInto('Hash').values([{
            hashType: HashType.Puzzle,
            service: value.service,
            hash: toBuffer(puzzleSigArray),
            id: uid,
        }, {
            hashType: HashType.PHash,
            service: value.service,
            hash: toBuffer(phashSigArray),
            id: uid,
        }]).execute();

        await trx
            .insertInto('ScraperEntry')
            .values(value.toScraperEntry())
            .execute();
    })

    return [[value.service, uid], puzzleSigArray, phashSigArray];
}

export async function *iteratePuzzleHashes(): AsyncGenerator<[hash: LuminosityLevel[], key: [service: Service, id: number]]> {
    for await (const entry of riDb
            .selectFrom('Hash')
            .where('hashType', '==', HashType.Puzzle)
            .select(['hash', 'service', 'id'])
            .stream()) {
        yield [decodeFromBitArray(entry.hash.buffer), [entry.service, entry.id]];
    }
}

export async function *iteratePHashHashes(): AsyncGenerator<[hash: bigint, key: [service: Service, id: number]]> {
    for await (const entry of riDb
        .selectFrom('Hash')
        .where('hashType', '==', HashType.PHash)
        .select(['hash', 'service', 'id'])
        .stream()) {
        yield [uint8ArrayToUint64(entry.hash.buffer), [entry.service, entry.id]];
    }
}

/**
 * Gets an image entry from the database by key.
 * @param key the key, from {@link addEntry}, {@link iteratePuzzleHashes} or {@link iteratePHashHashes}.
 * @returns ScraperEntry
 */
export async function getEntry([service, id]: [service: Service, id: number]): Promise<ScraperEntry | undefined> {
    return await riDb
        .selectFrom('ScraperEntry')
        .where(eb => eb.and([
            eb('id', '==', id),
            eb('service', '==', service)
        ]))
        .selectAll()
        .executeTakeFirst();
}

function isBmp(buf: Buffer | ArrayBuffer | Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array) {
    buf = new Uint8Array(buf);
    if (buf[0] == 0x42 && buf[1] == 0x4D) {
        return true;
    }
    return false;
}

