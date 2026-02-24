import { p256 } from "@noble/curves/nist.js";
import * as k256 from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import * as ui8 from "uint8arrays";
import { DidDocument } from "@atcute/identity";
import { CompositeDidDocumentResolver,PlcDidDocumentResolver,WebDidDocumentResolver } from "@atcute/identity-resolver";
import { Did,Nsid } from "@atcute/lexicons";
import { AtprotoDid } from "@atcute/lexicons/syntax";
import { XRPCError } from "@atcute/xrpc-server";
import { ServiceJwtVerifier } from "@atcute/xrpc-server/auth";

const P256_DID_PREFIX = new Uint8Array([0x80, 0x24]);
const SECP256K1_DID_PREFIX = new Uint8Array([0xe7, 0x01]);
// should equal P256_DID_PREFIX.length and SECP256K1_DID_PREFIX.length
const DID_PREFIX_LENGTH = 2;

const BASE58_MULTIBASE_PREFIX = "z";
const DID_KEY_PREFIX = "did:key:";

export const P256_JWT_ALG = "ES256";
export const SECP256K1_JWT_ALG = "ES256K";

const didToSigningKeyCache = new Map<string, { key: string; expires: number }>();

const didDocResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

/**
 * Verifies a JWT.
 * @param jwtStr The JWT to verify.
 * @param ownDid The DID of the service that is receiving the request.
 * @param lxm The lexicon method that is being called.
 * @returns The payload of the JWT.
 */
export async function verifyJwt(
	jwtStr: string,
	ownDid: string | null,
	lxm: string | null,
): Promise<{ iss: string; aud: string; lxm?: string; }> {
    const jwtVerifier = new ServiceJwtVerifier({
        serviceDid: ownDid as Did,
        resolver: didDocResolver,
    });

    const result = await jwtVerifier.verify(jwtStr, { lxm: lxm as Nsid });\
    if (!result.ok) {
        throw new XRPCError({
            status: 401,
            ...result.error
        });
    }

    return {
        iss: result.value.issuer,
        aud: result.value.audience,
        lxm: result.value.lxm,
    };
}

export function k256Sign(privateKey: Uint8Array, msg: Uint8Array): Uint8Array {
	const msgHash = sha256(msg);
	return k256.sign(msgHash, privateKey, { lowS: true, format: 'compact' });
}

/**
 * Parses a hex- or base64-encoded private key to a Uint8Array.
 * @param privateKey The private key to parse.
 */
export function parsePrivateKey(privateKey: string): Uint8Array {
	let keyBytes: Uint8Array | undefined;
	try {
		keyBytes = ui8.fromString(privateKey, "hex");
		if (keyBytes.byteLength !== 32) throw 0;
	} catch {
		try {
			keyBytes = ui8.fromString(privateKey, "base64url");
		} catch {}
	} finally {
		if (!keyBytes) {
			throw new Error("Invalid private key. Must be hex or base64url, and 32 bytes long.");
		}
		return keyBytes;
	}
};

/**
 * Formats a pubkey in did:key format.
 * @param jwtAlg The JWT algorithm used by the signing key.
 * @param keyBytes The bytes of the pubkey.
 */
export function formatDidKey(
	jwtAlg: typeof P256_JWT_ALG | typeof SECP256K1_JWT_ALG,
	keyBytes: Uint8Array,
): string {
	return DID_KEY_PREFIX + formatMultikey(jwtAlg, keyBytes);
}

/**
 * Compresses a pubkey to be used in a did:key.
 * @param curve p256 (secp256r1) or k256 (secp256k1)
 * @param keyBytes The pubkey to compress.
 * @see https://medium.com/asecuritysite-when-bob-met-alice/02-03-or-04-so-what-are-compressed-and-uncompressed-public-keys-6abcb57efeb6
 */
const compressPubkey = (curve: "p256" | "k256", keyBytes: Uint8Array): Uint8Array => {
	const ProjectivePoint = curve === "p256" ? p256.Point : k256.Point;
	return ProjectivePoint.fromBytes(keyBytes).toBytes(true);
};

/**
 * Formats a signing key as [base58 multibase](https://github.com/multiformats/multibase).
 * @param jwtAlg The JWT algorithm used by the signing key.
 * @param keyBytes The bytes of the signing key.
 */
const formatMultikey = (
	jwtAlg: typeof P256_JWT_ALG | typeof SECP256K1_JWT_ALG,
	keyBytes: Uint8Array,
): string => {
	const curve = jwtAlg === P256_JWT_ALG ? "p256" : "k256";
	let prefixedBytes: Uint8Array;
	if (jwtAlg === P256_JWT_ALG) {
		prefixedBytes = ui8.concat([P256_DID_PREFIX, compressPubkey(curve, keyBytes)]);
	} else if (jwtAlg === SECP256K1_JWT_ALG) {
		prefixedBytes = ui8.concat([SECP256K1_DID_PREFIX, compressPubkey(curve, keyBytes)]);
	} else {
		throw new Error("Invalid JWT algorithm: " + jwtAlg);
	}
	return (BASE58_MULTIBASE_PREFIX + ui8.toString(prefixedBytes, "base58btc"));
};
