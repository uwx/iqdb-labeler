// parser self-check: node src/tools/search-selftest.mjs (after pnpm build)
import assert from 'node:assert/strict';
import { parseTagQuery, UnsupportedQueryError } from '../../out/src/utils/tag-query.js';

// consecutive plain words are one tag; '-' and 'order:' break the run
assert.deepEqual(parseTagQuery('1girl solo').include, ['1girl', 'solo']);
assert.deepEqual(parseTagQuery('solo -nsfw').exclude, ['nsfw']);
assert.deepEqual(parseTagQuery('solo -nsfw').include, ['solo']);
assert.deepEqual(parseTagQuery('order:recent solo 1girl').include, ['solo', '1girl']);

assert.deepEqual(parseTagQuery('Blu*').prefix, ['blu']);
assert.deepEqual(parseTagQuery('1girl blu*'), { include: ['1girl'], exclude: [], prefix: ['blu'], order: 'recent' });
assert.deepEqual(parseTagQuery(' Blue_Hair ').include, ['blue_hair']);
assert.deepEqual(parseTagQuery('blue_hair').include, ['blue_hair']);
assert.equal(parseTagQuery('').include.length, 0);
assert.equal(parseTagQuery('order:recent 1girl').order, 'recent');

for (const bad of ['rating:e', '~solo', 'solo or 1girl', 'order:score', '(solo 1girl)', 'score:>10']) {
	assert.throws(() => parseTagQuery(bad), UnsupportedQueryError, `${bad} should throw`);
}
// '-tag' terms don't merge, so this really is 20 tags
assert.throws(() => parseTagQuery(Array.from({ length: 20 }, (_, i) => `-t${i}`).join(' ')), UnsupportedQueryError);

console.log('tag-query self-check ok');
