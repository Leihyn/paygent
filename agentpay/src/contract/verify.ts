// Signature creation and verification for Agent B's responses.
// Agent B signs a SHA256 hash of its response payload.
// The Clarity contract verifies the same signature on-chain via secp256k1-verify.

import * as crypto from "crypto";
import { sign, getPublicKey, Signature, etc } from "@noble/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

// @noble/secp256k1 v2 requires hmacSha256Sync for synchronous signing
etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) => {
  const h = hmac.create(sha256, k);
  m.forEach(v => h.update(v));
  return h.digest();
};

export const { hexToBytes, bytesToHex } = etc;

// Recursively sort all object keys for deterministic serialization.
// Without this, nested objects with different insertion order produce different hashes.
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  return Object.keys(obj)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = canonicalize(obj[key]);
      return acc;
    }, {});
}

// Hash any JSON-serializable payload to a 32-byte Buffer.
// Keys are recursively sorted for deterministic output.
export function hashPayload(payload: object): Buffer {
  const canonical = canonicalize(payload);
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest();
}

// Agent B signs the hash of its recommendation payload.
// Returns a 65-byte recoverable secp256k1 signature.
export function signPayload(
  payload: object,
  privateKeyHex: string
): { resultHashHex: string; signatureHex: string } {
  const hash = hashPayload(payload);
  const privKeyBytes = hexToBytes(privateKeyHex);

  const signature: Signature = sign(hash, privKeyBytes);

  // 64-byte compact signature (r || s)
  const compactSig = signature.toCompactRawBytes();

  // Build 65-byte recoverable: [recovery byte] + [64-byte compact sig]
  const recoverable = new Uint8Array(65);
  recoverable[0] = signature.recovery!;
  recoverable.set(compactSig, 1);

  return {
    resultHashHex: bytesToHex(hash),
    signatureHex: bytesToHex(recoverable),
  };
}

// Off-chain verification: recover the signer's public key from the signature
// and compare it against the expected public key.
export function verifySignature(
  payload: object,
  signatureHex: string,
  expectedPublicKeyHex: string
): boolean {
  try {
    const hash = hashPayload(payload);
    const sigBytes = hexToBytes(signatureHex);

    const recovery = sigBytes[0];
    const compactSig = sigBytes.slice(1);

    const sig = Signature.fromCompact(compactSig).addRecoveryBit(recovery);
    const recoveredPubKey = sig.recoverPublicKey(hash);
    const recoveredHex = bytesToHex(recoveredPubKey.toRawBytes(true));

    return recoveredHex === expectedPublicKeyHex;
  } catch {
    return false;
  }
}

// Get compressed public key (33 bytes) from private key.
export function getCompressedPublicKey(privateKeyHex: string): string {
  const privKeyBytes = hexToBytes(privateKeyHex);
  const pubKey = getPublicKey(privKeyBytes, true);
  return bytesToHex(pubKey);
}
