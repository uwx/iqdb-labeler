// https://stackoverflow.com/a/65863997

// default: base 26 alphabet using only characters that are valid in
// - feed rkey
// - label identifier
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export function alphabetParseInt(value: string, alphabet: string = ALPHABET) {
    let result = 0;
    const radix = alphabet.length;
    for (const a of value) {
        result = result * radix + alphabet.indexOf(a);
    }
    return result;
}

// function baseLog(base: number, x: number) {
//     return Math.log2(x) / Math.log2(base);
// }

export function alphabetToString(value: number, alphabet: string = ALPHABET) {
    let digit;
    const radix = alphabet.length;
    let len = 1;
    let temp = value;

    // Calculate len = Math.max(1, 1 + Math.floor(baseLog(radix, value)))
    while (temp >= radix) {
        len++;
        temp = (temp - temp % radix) / radix;
    }
    // In another language you would allocate the memory here:
    const result = new Array(len);
    do {
        digit = value % radix;
        len--;
        // Fill from back to start of array
        result[len] = alphabet[digit];
        value = (value - digit) / radix;
    } while (len);

    return result.join(""); // Convert char-array to string
}

// console.log(toString(115, 'abcdefghijklmnopqrstuvwxyz-'));
// console.log(parseInt("hd", 'abcdefghijklmnopqrstuvwxyz-'));

// https://stackoverflow.com/a/55646905
export function parseBigInt(value: string, radix: number) {
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

// prefer ulid from id128
//export function ulidToUint8Array(value: string) {
//    let big = parseBigInt(value, 36);
//
//    const parts: bigint[] = [];
//    while (big > 0) {
//        parts.push(big & 0xFFFFFFFFFFFFFFFFn);
//        big >>= 64n;
//    }
//
//    return new Uint8Array(new BigUint64Array(parts).buffer);
//}

// convert 32-bit sized positive number into uint8array containing an uint32
export function uint32ToUint8Array(value: number) {
    const arr = new Uint32Array(1);
    arr[0] = value;
    return new Uint8Array(arr.buffer);
}

// convert 64-bit sized positive bigint into uint8array containing an uint64
export function uint64ToUint8Array(bigint: bigint) {
    const arr = new BigUint64Array(1);
    arr[0] = bigint;
    return new Uint8Array(arr.buffer);
}

export function uint8ArrayToUint64(arr: ArrayBufferLike) {
    return new BigUint64Array(arr)[0];
}