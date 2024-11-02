
import { SignatureSimilarity } from "../puzzle/index.js";
import phash from "./phash.js";
import sharp from "sharp";

export async function generateSignature(input: string
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
    | Float64Array
    | string
    | sharp.Sharp,
): Promise<bigint> {
    // const phashed = await phash(input);
    //
    // return BigInt('0b' + phashed.join(''));
    return await phash(input);
}

export function compareSimilarity(
    a: bigint,
    b: bigint,
    sameThreshold = 0.4,
    similarityThreshold = 0.48,
    dissimilarThreshold = 0.68,
    differentThreshold = 0.7
) {
    let count = 0;
    //for (let i = 0; i < a.length; i++) {
    //  if (a[i] !== b[i]) {
    //    count++;
    //  }
    //}

    for (let i = 0n; i < 64n; i++) {
        if (((a >> i) & 1n) !== ((b >> i) & 1n)) {
            count++;
        }
    }

    const distance = (count / 64);
    console.log(distance);

    if (distance <= 0.0) return SignatureSimilarity.Identical;
    if (distance <= sameThreshold) return SignatureSimilarity.Same;
    if (distance <= similarityThreshold) return SignatureSimilarity.Similar;
    if (distance <= dissimilarThreshold) return SignatureSimilarity.Dissimilar;
    if (distance <= differentThreshold) return SignatureSimilarity.Different;
    else return SignatureSimilarity.Different;
}