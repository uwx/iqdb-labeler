// one-off: connect to a subscribeLabels websocket, verify each label's
// signature against the PLC atproto_label key. usage:
//   node src/tools/verify-live-labels.mjs [wss-url] [cursor]
import { verifySigWithDidKey } from '@atcute/crypto';
import { encode, fromBytes } from '@atcute/cbor';

const PLC_LABEL_KEY = 'did:key:zQ3shdZ39Fh5EqmA8bWJELVgmc1E9zDuXYfwoh9nHQ4Sd718q';
const url = process.argv[2] ?? 'wss://labeler.nothingeverhappen.com/xrpc/com.atproto.label.subscribeLabels';
const cursor = process.argv[3] ? `?cursor=${process.argv[3]}` : '?cursor=5211690';

let verified = 0;
let failed = 0;
let errors = 0;
const failures = [];

const ws = new WebSocket(url + cursor);
ws.binaryType = 'arraybuffer';

ws.onmessage = (evt) => {
	try {
		const bytes = new Uint8Array(evt.data);
		const frame = decodeFrame(bytes);
		if (frame.header.op === -1) {
			console.log('error frame:', JSON.stringify(frame.body));
			return;
		}
		if (frame.header.t !== '#labels') return;
		for (const label of frame.body.labels) {
			const { sig, ...unsigned } = label;
			const sigBytes = fromBytes(sig);
			try {
				const ok = verifySigWithDidKey(PLC_LABEL_KEY, sigBytes, encode(unsigned));
				if (ok) {
					verified++;
				} else {
					failed++;
					failures.push({ seq: frame.body.seq, val: label.val });
				}
			} catch (e) {
				errors++;
				console.log('verify error seq', frame.body.seq, e.message);
			}
		}
	} catch (e) {
		errors++;
		console.log('frame parse error:', e.message);
	}
};

ws.onerror = (e) => console.log('ws error:', e.message ?? e.type);
ws.onclose = (e) => console.log('ws closed:', e.code, e.reason);

function decodeFrame(bytes) {
	// frames are [header cbor][body cbor]; @atcute/cbor decode consumes one object.
	// brute-force the split point — headers are tiny maps.
	for (let len = 2; len <= bytes.length; len++) {
		try {
			const header = decodeOne(bytes.subarray(0, len));
			const body = decodeOne(bytes.subarray(len));
			return { header, body };
		} catch {}
	}
	throw new Error(`cannot split frame of ${bytes.length} bytes`);
}

import { decode as cborDecode } from '@atcute/cbor';
const decodeOne = (b) => cborDecode(b);

const ms = Number(process.argv[4] ?? 5000);
setTimeout(() => {
	console.log(`verified: ${verified}, failed: ${failed}, errors: ${errors}`);
	if (failures.length) console.log('failing seqs:', failures.slice(0, 5));
	process.exit(failed + errors > 0 ? 1 : 0);
}, ms);
