import { dlopen, FFIType, suffix } from "bun:ffi";
import { join } from 'node:path';
import { TextDecoder } from 'node:util';

import { LuminosityLevel } from '../puzzle/index.js';

const path = join(import.meta.dirname, 'backend', `PuzzleUser.${suffix}`);

const {
    symbols: {
        load_and_generate_signature: loadAndGenerateSignatureImpl, // the function to call
    },
}: {
    symbols: {
        load_and_generate_signature: (
            data: Uint8Array,
            dataLength: number,
            output: Uint8Array,
            gridSize: number,
            noiseCutoff: number,
            sampleSizeRatio: number,
            enableAutocrop: number,
            exception: Uint8Array,
            exceptionLength: number,
        ) => number;
    }
} = dlopen(
    path, // a library name or file path
    {
        load_and_generate_signature: {
            args: [
                FFIType.buffer, // data
                FFIType.i32, // dataLength
                FFIType.buffer, // output, must be of length gridSize * gridSize * 8
                FFIType.i32, // gridSize = 9,
                FFIType.f64, // noiseCutoff = 2.0,
                FFIType.f64, // sampleSizeRatio = 2.0,
                FFIType.u8, // enableAutocrop = true
                FFIType.buffer, // exception
                FFIType.i32, // exceptionLength
            ],
            returns: FFIType.i32,
        },
    },
);

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
    const errLength = loadAndGenerateSignatureImpl(
        data instanceof Uint8Array ? data : new Uint8Array(data),
        data.byteLength,
        output,
        gridSize,
        noiseCutoff,
        sampleSizeRatio,
        enableAutocrop ? 1 : 0,
        error,
        error.byteLength,
    );

    if (errLength != 0) {
        throw new Error(td.decode(error.slice(0, errLength)))
    }

    return [...new Int8Array(output.buffer)];
}

// process.on('beforeExit', () => {
//     close('PuzzleUser');
// });