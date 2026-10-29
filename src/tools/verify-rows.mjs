// dev helper: verify a JSON array of label rows against the PLC label key.
// usage: node src/tools/verify-rows.mjs rows.json
import fs from 'node:fs';
import { verifySigWithDidKey } from '@atcute/crypto';
import { encode } from '@atcute/cbor';

const KEY = 'did:key:zQ3shdZ39Fh5EqmA8bWJELVgmc1E9zDuXYfwoh9nHQ4Sd718q';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

for (const r of rows) {
	const unsigned = { cid: r.cid, cts: r.cts, src: r.src, uri: r.uri, val: r.val, ver: 1 };
	const withNeg = { ...unsigned, neg: Boolean(r.neg) };
	const ok = await verifySigWithDidKey(KEY, Buffer.from(r.sig, 'hex'), encode(unsigned));
	const okNeg = await verifySigWithDidKey(KEY, Buffer.from(r.sig, 'hex'), encode(withNeg));
	console.log(String(r.id).padEnd(9), r.cts, 'plain:', ok, 'with neg:', okNeg, '|', r.val);
}
