// one-off: re-signs every stored label with the correct secp256k1 key and
// re-inserts it with a fresh id, so the appview sees it as a new event.
// run with node 22+: node src/tools/reemit-labels.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { Secp256k1PrivateKey, verifySigWithDidKey } from '@atcute/crypto';
import { encode } from '@atcute/cbor';
import { fromString } from 'uint8arrays/from-string';

const PLC_LABEL_KEY = 'did:key:zQ3shdZ39Fh5EqmA8bWJELVgmc1E9zDuXYfwoh9nHQ4Sd718q';

const env = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const dbPath = env.match(/^DB_PATH=(.*)$/m)?.[1]?.trim() ?? 'labels.db';
const signingKeyHex = env.match(/^SIGNING_KEY=(.*)$/m)?.[1]?.trim();

const key = await Secp256k1PrivateKey.importRaw(fromString(signingKeyHex, 'hex'));
const derivedDid = await key.exportPublicKey('did');
if (derivedDid !== PLC_LABEL_KEY) {
	throw new Error(`SIGNING_KEY does not match the PLC atproto_label key:\n  derived: ${derivedDid}\n  plc:     ${PLC_LABEL_KEY}`);
}

const db = new DatabaseSync(dbPath);
const { max } = db.prepare('SELECT MAX(id) AS max FROM labels').get();
console.log(`db: ${dbPath}, old rows up to id ${max}`);

const select = db.prepare(
	'SELECT id, src, uri, cid, val, neg, cts, exp FROM labels WHERE id > ? AND id <= ? ORDER BY id LIMIT ?',
);
const insert = db.prepare(
	'INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);

const BATCH = 10_000;
let lastId = 0;
let reemitted = 0;
const started = Date.now();

while (lastId < max) {
	const rows = select.all(lastId, max, BATCH);
	if (rows.length === 0) break;

	db.exec('BEGIN');
	try {
		for (const row of rows) {
			// must match src/labeler/signing.ts byte-for-byte: ver 1, neg/exp omitted when absent
			const unsigned = {
				cid: row.cid ?? undefined,
				cts: row.cts,
				exp: row.exp ?? undefined,
				neg: row.neg ? true : undefined,
				src: row.src,
				uri: row.uri,
				val: row.val,
				ver: 1,
			};
			const bytes = encode(unsigned);
			const sig = await key.sign(bytes);

			if (!(await verifySigWithDidKey(PLC_LABEL_KEY, sig, bytes))) {
				throw new Error(`signature failed verification for source row id ${row.id}`);
			}

			insert.run(row.src, row.uri, row.cid, row.val, row.neg ? 1 : 0, row.cts, row.exp, sig);
		}
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}

	lastId = rows.at(-1).id;
	reemitted += rows.length;
	const secs = ((Date.now() - started) / 1000).toFixed(0);
	console.log(`${reemitted}/${max} re-signed (${secs}s)`);
}

const { newMax } = db.prepare('SELECT MAX(id) AS newMax FROM labels').get();
console.log(`done: ${reemitted} labels re-emitted as ids ${max + 1}..${newMax}`);
