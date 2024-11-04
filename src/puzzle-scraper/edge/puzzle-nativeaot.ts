
import { equal } from 'assert';
import { load, DataType, open, close, arrayConstructor, define } from 'ffi-rs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';
import { platform } from 'os';

import { LuminosityLevel } from 'puzzle-scraper/puzzle/index.js';

// First open dynamic library with key for close
// It only needs to be opened once.
open({
    library: 'PuzzleUser', // key
    path: join(import.meta.dirname, 'backend', platform() === 'win32' ? 'PuzzleUser.dll' : 'PuzzleUser.so') // path
});

// Use define function to define a function signature
const { load_and_generate_signature: loadAndGenerateSignatureImpl } = define({
    load_and_generate_signature: {
        library: 'PuzzleUser', // path to the dynamic library file
        retType: DataType.I32, // the return value type
        paramsType: [
            DataType.U8Array, // data
            DataType.I32, // dataLength
            DataType.U8Array, // output, must be of length gridSize * gridSize * 8
            DataType.I32, // gridSize = 9,
            DataType.Double, // noiseCutoff = 2.0,
            DataType.Double, // sampleSizeRatio = 2.0,
            DataType.U8, // enableAutocrop = true
            DataType.U8Array, // exception
            DataType.I32, // exceptionLength
        ], // the parameter types
        // freeResultMemory: true, // whether or not need to free the result of return value memory automatically, default is false
    }
});

const td = new TextDecoder('utf-8');
const error = new Uint8Array(8192);
export function loadAndGenerateSignature(
    data: Uint8Array | Buffer | ArrayBuffer,
    gridSize = 9,
    noiseCutoff = 2.0,
    sampleSizeRatio = 2.0,
    enableAutocrop = true
): LuminosityLevel[] {
    const output = new Uint8Array(gridSize * gridSize * 8);
    const errLength = loadAndGenerateSignatureImpl([
        data instanceof Uint8Array ? data : new Uint8Array(data),
        data.byteLength,
        output,
        gridSize,
        noiseCutoff,
        sampleSizeRatio,
        enableAutocrop ? 1 : 0,
        error,
        error.byteLength,
    ]);

    if (errLength != 0) {
        throw new Error(td.decode(error.slice(0, errLength)))
    }

    return [...new Int8Array(output.buffer)];
}

process.on('beforeExit', () => {
    close('PuzzleUser');
});