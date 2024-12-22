import { encodeToBitArray, decodeFromBitArray, LuminosityLevel } from "./puzzle/index.js";
import { generateSignature as phashGenerateSignature } from "./phash/index.js";
import { loadAndGenerateSignature as puzzleGenerateSignature } from "./edge/puzzle-nativeaot.js";
import sharp from 'sharp';
import { readFile } from "node:fs/promises";
import { LmdbWrapper } from "../utils/lmdb-wrapper.js";
import bmp from "sharp-bmp";
import { uint64ToUint8Array, uint8ArrayToUint64 } from "../utils/ints.js";

const riDb = new LmdbWrapper('reverse-image-database', {
    keyEncoding: 'binary',
    encoding: 'binary',
});

export const cursors = riDb.table<string, number>('cursors', 'ordered-binary', 'ordered-binary');

export const hashesReverse = riDb.table<[service: Service, id: number | string], [phash: Uint8Array, puzzle: Uint8Array]>('TEMP-HASHES-REVERSE', 'ordered-binary', 'msgpack');

const valuesTable = riDb.table<[service: Service, id: number | string], ScraperEntry>('values', 'ordered-binary', 'msgpack');

// key: single int64 containing an 8x8 similarity bit table
// value: [Service, ID] index into valuesTable
const phashTable = riDb.table<Uint8Array, [service: Service, id: number | string]>('phash', 'binary', 'ordered-binary');

// key: uint8 array of 2-bit encoded values, of length ((gridSize * gridSize * 8) / 4), default gridSize is 9
// value: [Service, ID] index into valuesTable
const puzzleTable = riDb.table<Uint8Array, [service: Service, id: number | string]>('puzzle', 'binary', 'ordered-binary');

// temp
import { PartialPost } from "../utils/booru-client/types.js";
export const postsDb = riDb.table<[service: Service, id: number | string], PartialPost>('TEMP-POSTS', 'ordered-binary', 'msgpack');
export const errorsDb = riDb.table<[service: Service, id: number | string], string>('TEMP-ERRORS', 'ordered-binary', 'msgpack');

export enum Service {
    Danbooru,
    E621,
    Konachan,
    Rule34,
    Yandere,
    Gelbooru,
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

export class IdPostEntry {
    constructor(public readonly postId: number, public readonly service: Service, public readonly md5?: string) {}

    static fromScraperEntry(scraperEntry: ScraperEntry) {
        return new this(+scraperEntry.i, scraperEntry.s, scraperEntry.m);
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
): Promise<[key: [service: Service, postId: string | number], puzzleSigArray: Uint8Array, phashSigArray: Uint8Array]> {
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

    await riDb.transaction(() => {
        valuesTable.put([value.service, uid], value.toScraperEntry());
        puzzleTable.put(puzzleSigArray, [value.service, uid]);
        phashTable.put(phashSigArray, [value.service, uid]);

        hashesReverse.put([value.service, uid], [phashSigArray, puzzleSigArray]);
    });

    return [[value.service, uid], puzzleSigArray, phashSigArray];
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

function isBmp(buf: Buffer | ArrayBuffer | Uint8Array | Uint8ClampedArray | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array) {
    buf = new Uint8Array(buf);
    if (buf[0] == 0x42 && buf[1] == 0x4D) {
        return true;
    }
    return false;
}

