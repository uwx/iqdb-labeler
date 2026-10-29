import { webcrypto } from 'node:crypto';
import { LABELER_PASSWORD, LABELER_SALT } from '../config.js';
import { toString as ui8ToString } from 'uint8arrays/to-string';
import { fromString as ui8FromString } from 'uint8arrays/from-string';

const ec = new TextEncoder();

const keyMaterial = await webcrypto.subtle.importKey('raw', ec.encode(LABELER_PASSWORD), 'PBKDF2', false, [
    'deriveKey',
]);
const key = await webcrypto.subtle.deriveKey(
    {
        name: 'PBKDF2',
        hash: 'SHA-512',
        salt: ec.encode(LABELER_SALT),
        iterations: 1000,
    },
    keyMaterial,
    {
        name: 'AES-CBC',
        length: 256,
    },
    true,
    ['encrypt', 'decrypt', 'unwrapKey', 'wrapKey'],
);

export async function aesEncrypt(plaintext: string): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }>;
export async function aesEncrypt(plaintext: string, opts: { outString: true }): Promise<string>;
export async function aesEncrypt(plaintext: string, { outString = false }: { outString?: boolean } = {}) {
    const ec = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(16)).buffer;

    const ciphertext = await webcrypto.subtle.encrypt(
        {
            name: 'AES-CBC',
            iv,
        },
        key,
        ec.encode(plaintext),
    );

    return outString ? ivAndCiphertextToString({ iv, ciphertext }) : { iv, ciphertext };
}

function ivAndCiphertextToString({ iv, ciphertext }: { iv: ArrayBuffer; ciphertext: ArrayBuffer }) {
    return JSON.stringify([
        ui8ToString(new Uint8Array(ciphertext), 'base64'),
        ui8ToString(new Uint8Array(iv), 'base64'),
    ]);
}

export async function aesDecrypt(encrypted: string): Promise<string>;
export async function aesDecrypt(ciphertext: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>): Promise<string>;
export async function aesDecrypt(
    ciphertextOrEncrypted: Uint8Array<ArrayBuffer> | string,
    iv?: Uint8Array<ArrayBuffer>,
) {
    if (typeof ciphertextOrEncrypted === 'string') {
        const [parsedCiphertext, parsedIv] = JSON.parse(ciphertextOrEncrypted);
        [ciphertextOrEncrypted, iv] = [
            ui8FromString(parsedCiphertext, 'base64') as Uint8Array<ArrayBuffer>,
            ui8FromString(parsedIv, 'base64') as Uint8Array<ArrayBuffer>,
        ];
    }

    const dec = new TextDecoder();
    const plaintext = await webcrypto.subtle.decrypt(
        {
            name: 'AES-CBC',
            iv,
        },
        key,
        ciphertextOrEncrypted,
    );

    return dec.decode(plaintext);
}
