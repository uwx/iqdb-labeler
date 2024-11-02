import { encodeToBitArray, decodeFromBitArray, LuminosityLevel } from "./puzzle/index.js";
import { generateSignature as phashGenerateSignature } from "./phash/index.js";
import { loadAndGenerateSignature as puzzleGenerateSignature } from "./edge/puzzle-nativeaot.js";
import sharp from 'sharp';
import { PartialPost } from "./scrapers/types.js";
import { readFile } from "node:fs/promises";
import { LmdbWrapper } from "../lmdb-wrapper.js";

const db = new LmdbWrapper('reverse-image-database', {
    keyEncoding: 'binary',
    encoding: 'binary',
});

export const cursors = db.table<string, number>('cursors', 'ordered-binary', 'ordered-binary');

export const posts = db.table<[id: number, service: string], PartialPost>('TEMP-POSTS', 'ordered-binary', 'msgpack');

const valuesTable = db.table<[service: Service, id: number | string], ScraperEntry>('values', 'ordered-binary', 'msgpack');

// key: single int64 containing an 8x8 similarity bit table
// value: [Service, ID] index into valuesTable
const phashTable = db.table<Uint8Array, [service: Service, id: number | string]>('phash', 'binary', 'ordered-binary');

// key: uint8 array of 2-bit encoded values, of length ((gridSize * gridSize * 8) / 4), default gridSize is 9
// value: [Service, ID] index into valuesTable
const puzzleTable = db.table<Uint8Array, [service: Service, id: number | string]>('puzzle', 'binary', 'ordered-binary');

// https://stackoverflow.com/a/55646905
function parseBigInt(value: string, radix: number) {
    if (radix < 1 || radix > 36) throw new Error('Radix must be >= 1 <= 36')

    const size = 10; // Number.MAX_SAFE_INTEGER is of length 11, so 10 is the most possible
    const factor = BigInt(radix ** size);

    let r = 0n;

    {
        const v = value.slice(0, value.length % size || size);
        r = r * factor + BigInt(parseInt(v, radix));
    }

    for (let i = value.length % size || size; i < value.length; i += size) {
        const v = value.slice(i, i += size);

        r = r * factor + BigInt(parseInt(v, radix));
    }

    return r;
}

function ulidToUint8Array(value: string) {
    let big = parseBigInt(value, 36);

    const parts: bigint[] = [];
    while (big > 0) {
        parts.push(big & 0xFFFFFFFFFFFFFFFFn);
        big >>= 64n;
    }

    return new Uint8Array(new BigUint64Array(parts).buffer);
}

// convert 32-bit sized positive number into uint8array containing an uint32
function uint32ToUint8Array(value: number) {
    const arr = new Uint32Array(1);
    arr[0] = value;
    return new Uint8Array(arr.buffer);
}

// convert 64-bit sized positive bigint into uint8array containing an uint64
function uint64ToUint8Array(bigint: bigint) {
    const arr = new BigUint64Array(1);
    arr[0] = bigint;
    return new Uint8Array(arr.buffer);
}

function uint8ArrayToUint64(arr: ArrayBuffer) {
    return new BigUint64Array(arr)[0];
}

export const enum Service {
    Danbooru, E621
}

export interface ScraperEntry {
    // the service itself
    s: Service;

    // per-service proprietary components
    i: string | number;
    j?: string | number;
    k?: string | number;
    l?: string | number;

    // optional md5
    m?: string;

    // optional sha1
    h?: string;
}

export interface PostEntry {
    service: Service;
    get postId(): string | number;
    toScraperEntry(): ScraperEntry;
}

export class DanbooruPostEntry {
    readonly service = Service.Danbooru;

    constructor(public readonly postId: number, public readonly md5?: string) {}

    static fromScraperEntry(scraperEntry: ScraperEntry) {
        return new this(+scraperEntry.i);
    }

    toScraperEntry(): ScraperEntry {
        return {
            s: this.service,
            i: this.postId,
            ...(this.md5 ? { m: this.md5 } : {})
        };
    }
}
export class E6PostEntry {
    readonly service = Service.E621;

    constructor(public readonly postId: number, public readonly md5?: string) {}

    static fromScraperEntry(scraperEntry: ScraperEntry) {
        return new this(+scraperEntry.i);
    }

    toScraperEntry(): ScraperEntry {
        return {
            s: this.service,
            i: this.postId,
            ...(this.md5 ? { m: this.md5 } : {})
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
) {
    const img = sharp(input, { failOnError: false });

    const uid = value.postId;

    const [puzzleSignature, phashSignature] = await Promise.all([
        puzzleGenerateSignature(typeof input === 'string' ? await readFile(input) : input),
        phashGenerateSignature(img)
    ]);

    await db.transaction(() => {
        valuesTable.put([value.service, uid], value.toScraperEntry());
        puzzleTable.put(new Uint8Array(encodeToBitArray(puzzleSignature)), [value.service, uid]);
        phashTable.put(uint64ToUint8Array(phashSignature), [value.service, uid]);
    });

    return [value.service, uid];
}

export function *iteratePuzzleHashes(): Generator<[hash: LuminosityLevel[], key: [service: Service, id: string | number]]> {
    for (const {key, value} of puzzleTable.getRange()) {
        yield [decodeFromBitArray(key.buffer), value];
    }
}

export function *iteratePHashHashes(): Generator<[hash: bigint, key: [service: Service, id: string | number]]> {
    for (const {key, value} of phashTable.getRange()) {
        yield [uint8ArrayToUint64(key.buffer), value];
    }
}

/**
 * Gets an image entry from the database by key.
 * @param key the key, from {@link addEntry}, {@link iteratePuzzleHashes} or {@link iteratePHashHashes}.
 * @returns ScraperEntry
 */
export function getEntry(key: [service: Service, id: string | number]) {
    return valuesTable.get(key);
}
