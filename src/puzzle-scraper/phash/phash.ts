// https://github.com/btd/sharp-phash
//
// MIT License
//
// Copyright (c) 2016 Denis Bardadym
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import sharp from "sharp";

const SAMPLE_SIZE = 32;

function initSQRT(N: number) {
    const c: number[] = new Array(N);
    for (let i = 1; i < N; i++) {
        c[i] = 1;
    }
    c[0] = 1 / Math.sqrt(2.0);
    return c;
}

const SQRT = initSQRT(SAMPLE_SIZE);

function initCOS(N: number) {
    const cosines: number[][] = new Array(N);
    for (let k = 0; k < N; k++) {
        cosines[k] = new Array(N);
        for (let n = 0; n < N; n++) {
            cosines[k][n] = Math.cos(((2 * k + 1) / (2.0 * N)) * n * Math.PI);
        }
    }
    return cosines;
}

const COS = initCOS(SAMPLE_SIZE);

function applyDCT(f: number[][], size: number) {
    const N = size;

    const F = new Array(N);
    for (let u = 0; u < N; u++) {
        F[u] = new Array(N);
        for (let v = 0; v < N; v++) {
            let sum = 0;
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    sum += COS[i][u] * COS[j][v] * f[i][j];
                }
            }
            sum *= (SQRT[u] * SQRT[v]) / 4;
            F[u][v] = sum;
        }
    }
    return F;
}

const LOW_SIZE = 8;

/**
 * Calculate the perceptual hash of an image
 * @param input Buffer containing image data or a string containing the path to an image.
 * @param options Object with optional attributes.
 * @returns A promise that resolves to a 64-char 01 string as the perceptual hash of the image
 */
export default async function phash(input?: Parameters<typeof sharp>[0] | sharp.Sharp, options?: Parameters<typeof sharp>[1]) {
    const data = await (typeof input !== 'string' && input !== undefined && 'resize' in input ? input : sharp(input, options))
        .greyscale()
        .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
        .rotate()
        .raw()
        .toBuffer();
    // copy signal
    const s = new Array(SAMPLE_SIZE);
    for (let x = 0; x < SAMPLE_SIZE; x++) {
        s[x] = new Array(SAMPLE_SIZE);
        for (let y = 0; y < SAMPLE_SIZE; y++) {
            s[x][y] = data[SAMPLE_SIZE * y + x];
        }
    }

    // apply 2D DCT II
    const dct = applyDCT(s, SAMPLE_SIZE);

    // get AVG on high frequencies
    let totalSum = 0;
    for (let x = 0; x < LOW_SIZE; x++) {
        for (let y = 0; y < LOW_SIZE; y++) {
            totalSum += dct[x + 1][y + 1];
        }
    }

    const avg = totalSum / (LOW_SIZE * LOW_SIZE);

    // compute hash
    // const fingerprint = new Array<number>(LOW_SIZE * LOW_SIZE);
    let fingerprint = 0n;

    for (let x = 0, i = 0n; x < LOW_SIZE; x++, i++) {
        for (let y = 0; y < LOW_SIZE; y++, i++) {
            // fingerprint[(x * LOW_SIZE) + y] = dct[x + 1][y + 1] > avg ? 1 : 0;
            fingerprint |= (dct[x + 1][y + 1] > avg ? 1n : 0n) << i;
        }
    }

    return fingerprint;
}