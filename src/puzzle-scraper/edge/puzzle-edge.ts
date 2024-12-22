import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TEST_CASES_ROOT } from 'puzzle-scraper/test/utils.js';

process.env.EDGE_USE_CORECLR = '1';
process.env.EDGE_APP_ROOT = String.raw`<TODO>\Puzzle\PuzzleUser\bin\Release\net8.0`;

const { edgeFuncAsync } = await import('../../utils/edge-wrapper.js');
const edge = await import('edge-js');
const baseDll = join(process.env.EDGE_APP_ROOT!, 'PuzzleUser.dll');
const localTypeName = 'PuzzleUser.PuzzleUser';

const loadAndGenerateSignature = edgeFuncAsync<{
    data: Buffer;
    gridSize?: number,
    noiseCutoff?: number,
    sampleSizeRatio?: number,
    enableAutocrop?: boolean,
}, Buffer>({
    assemblyFile: baseDll,
    typeName: localTypeName,
    methodName: 'LoadAndGenerateSignature1'
});

const f = await readFile(`${TEST_CASES_ROOT}/original-mona.jpg`);

console.time('puzzle')
console.log(new Int8Array(await loadAndGenerateSignature({
    data: f
})));
console.timeEnd('puzzle');

console.time('puzzle')
console.log(new Int8Array(await loadAndGenerateSignature({
    data: f
})));
console.timeEnd('puzzle');

console.time('puzzle')
console.log(new Int8Array(await loadAndGenerateSignature({
    data: f
})));
console.timeEnd('puzzle');