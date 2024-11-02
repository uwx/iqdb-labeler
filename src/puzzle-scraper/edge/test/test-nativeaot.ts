import { readFile, writeFile } from "node:fs/promises";
import assert, { deepStrictEqual } from "node:assert";
import test from "node:test";

import { TEST_CASES_ROOT } from "../../test/utils.js";
import { loadAndGenerateSignature } from "../puzzle-nativeaot.js";
import { LuminosityLevel } from "puzzle-scraper/puzzle/index.js";

const f = await readFile(`${TEST_CASES_ROOT}/original-mona.jpg`);

// benchmark!
for (let i = 0; i < 100; i++) {
    console.time('puzzle');
    console.log(loadAndGenerateSignature(new Uint8Array(f)));
    console.timeEnd('puzzle');
}

test('result matches .NET Puzzle', async () => {
    const expected = [...new Int8Array(await readFile(`${TEST_CASES_ROOT}/original-mona.signature`))] as LuminosityLevel[];
    const actual = loadAndGenerateSignature(await readFile(`${TEST_CASES_ROOT}/original-mona.jpg`));

    deepStrictEqual(actual, expected);
});