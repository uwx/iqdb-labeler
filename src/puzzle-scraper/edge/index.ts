import { LuminosityLevel } from "../puzzle/index.js";

let loadAndGenerateSignature: (
    data: Uint8Array | Buffer | ArrayBuffer,
    gridSize?: number,
    noiseCutoff?: number,
    sampleSizeRatio?: number,
    enableAutocrop?: boolean
) => PromiseLike<LuminosityLevel[]> | LuminosityLevel[];

const GRID_SIZE_DEFAULT = 9;
const NOISE_CUTOFF_DEFAULT = 2.0;
const SAMPLE_SIZE_RATIO_DEFAULT = 2.0;
const ENABLE_AUTOCROP_DEFAULT = true;

if (process.env.USE_EDGE) {
    const { loadAndGenerateSignature: loadAndGenerateSignatureImpl } = await import('./puzzle-edge.js');
    loadAndGenerateSignature = async (
        data,
        gridSize = GRID_SIZE_DEFAULT,
        noiseCutoff = NOISE_CUTOFF_DEFAULT,
        sampleSizeRatio = SAMPLE_SIZE_RATIO_DEFAULT,
        enableAutocrop = ENABLE_AUTOCROP_DEFAULT
    ) => {
        return [...new Int8Array(await loadAndGenerateSignatureImpl({
            data: data instanceof Buffer ? data : Buffer.from(new Uint8Array(data)),
            gridSize,
            noiseCutoff,
            sampleSizeRatio,
            enableAutocrop,
        }))] as LuminosityLevel[];
    };
} else if (typeof Bun !== "undefined") {
    const { loadAndGenerateSignature: loadAndGenerateSignatureImpl } = await import('./puzzle-nativeaot-bun.js');
    loadAndGenerateSignature = loadAndGenerateSignatureImpl;
} else {
    const { loadAndGenerateSignature: loadAndGenerateSignatureImpl } = await import('./puzzle-nativeaot.js');
    loadAndGenerateSignature = loadAndGenerateSignatureImpl;
}

export { loadAndGenerateSignature };