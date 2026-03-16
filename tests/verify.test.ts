// Unit tests for cryptographic operations (hashing, signing, verification).
// Runs offline — no blockchain dependency.

import * as crypto from "crypto";

const secp = require("@noble/secp256k1");
const { hmac } = require("@noble/hashes/hmac");
const { sha256 } = require("@noble/hashes/sha256");

secp.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) => {
  const h = hmac.create(sha256, k);
  m.forEach((v: Uint8Array) => h.update(v));
  return h.digest();
};

// Mirror the canonicalize function from verify.ts
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  return Object.keys(obj)
    .sort()
    .reduce((acc: any, key: string) => {
      acc[key] = canonicalize(obj[key]);
      return acc;
    }, {});
}

function hashPayload(payload: object): Buffer {
  const canonical = canonicalize(payload);
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest();
}

describe("hashPayload", () => {
  it("produces consistent 32-byte hashes", () => {
    const payload = { test: "data", number: 42 };
    const hash1 = hashPayload(payload);
    const hash2 = hashPayload(payload);
    expect(hash1.toString("hex")).toBe(hash2.toString("hex"));
    expect(hash1.length).toBe(32);
  });

  it("produces different hashes for different payloads", () => {
    const hash1 = hashPayload({ a: 1 });
    const hash2 = hashPayload({ a: 2 });
    expect(hash1.toString("hex")).not.toBe(hash2.toString("hex"));
  });

  it("sorts top-level keys deterministically", () => {
    const hash1 = hashPayload({ b: 2, a: 1 });
    const hash2 = hashPayload({ a: 1, b: 2 });
    expect(hash1.toString("hex")).toBe(hash2.toString("hex"));
  });

  it("sorts nested keys deterministically", () => {
    const hash1 = hashPayload({ outer: { z: 3, a: 1 } });
    const hash2 = hashPayload({ outer: { a: 1, z: 3 } });
    expect(hash1.toString("hex")).toBe(hash2.toString("hex"));
  });
});

describe("secp256k1 signing", () => {
  const testPrivKey = "0000000000000000000000000000000000000000000000000000000000000001";

  it("derives a 33-byte compressed public key", () => {
    const privBytes = secp.etc.hexToBytes(testPrivKey);
    const pubKey = secp.getPublicKey(privBytes, true);
    expect(pubKey.length).toBe(33);
    expect(pubKey[0] === 0x02 || pubKey[0] === 0x03).toBe(true);
  });

  it("private key 1 produces the known generator point", () => {
    const privBytes = secp.etc.hexToBytes(testPrivKey);
    const pubHex = secp.etc.bytesToHex(secp.getPublicKey(privBytes, true));
    expect(pubHex).toBe("0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
  });

  it("signs and produces a 65-byte recoverable signature", () => {
    const hash = hashPayload({ jobId: 1, data: "test" });
    const privBytes = secp.etc.hexToBytes(testPrivKey);
    const sig = secp.sign(hash, privBytes);

    const compact = sig.toCompactRawBytes();
    expect(compact.length).toBe(64);

    const recoverable = new Uint8Array(65);
    recoverable[0] = sig.recovery!;
    recoverable.set(compact, 1);
    expect(recoverable.length).toBe(65);
    expect(recoverable[0] === 0 || recoverable[0] === 1).toBe(true);
  });

  it("round-trips sign and verify", () => {
    const hash = hashPayload({ test: "roundtrip" });
    const privBytes = secp.etc.hexToBytes(testPrivKey);
    const pubKey = secp.getPublicKey(privBytes, true);
    const sig = secp.sign(hash, privBytes);

    expect(secp.verify(sig, hash, pubKey)).toBe(true);
  });

  it("recovers the correct public key from signature", () => {
    const hash = hashPayload({ test: "recovery" });
    const privBytes = secp.etc.hexToBytes(testPrivKey);
    const expectedPubKey = secp.getPublicKey(privBytes, true);
    const sig = secp.sign(hash, privBytes);

    const recovered = secp.Signature.fromCompact(sig.toCompactRawBytes())
      .addRecoveryBit(sig.recovery!)
      .recoverPublicKey(hash);

    expect(secp.etc.bytesToHex(recovered.toRawBytes(true))).toBe(
      secp.etc.bytesToHex(expectedPubKey)
    );
  });
});

describe("verifySignature logic", () => {
  const privKey = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
  const privBytes = secp.etc.hexToBytes(privKey);
  const expectedPubHex = secp.etc.bytesToHex(secp.getPublicKey(privBytes, true));

  function signAndVerify(payload: object, pubKeyHex: string): boolean {
    const hash = hashPayload(payload);
    const sig = secp.sign(hash, privBytes);
    const compact = sig.toCompactRawBytes();
    const recoverable = new Uint8Array(65);
    recoverable[0] = sig.recovery!;
    recoverable.set(compact, 1);
    const sigHex = secp.etc.bytesToHex(recoverable);

    // Recover and compare
    const sigBytes = secp.etc.hexToBytes(sigHex);
    const recSig = secp.Signature.fromCompact(sigBytes.slice(1)).addRecoveryBit(sigBytes[0]);
    const recovered = recSig.recoverPublicKey(hash);
    return secp.etc.bytesToHex(recovered.toRawBytes(true)) === pubKeyHex;
  }

  it("returns true for correct public key", () => {
    expect(signAndVerify({ data: "test" }, expectedPubHex)).toBe(true);
  });

  it("returns false for wrong public key", () => {
    const wrongPub = secp.etc.bytesToHex(
      secp.getPublicKey(secp.etc.hexToBytes("0000000000000000000000000000000000000000000000000000000000000001"), true)
    );
    expect(signAndVerify({ data: "test" }, wrongPub)).toBe(false);
  });
});

describe("Clarity signature compatibility", () => {
  it("produces buffer sizes matching Clarity contract expectations", () => {
    const privKey = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
    const privBytes = secp.etc.hexToBytes(privKey);
    const pubKey = secp.getPublicKey(privBytes, true);

    const hash = crypto.createHash("sha256").update("test payload").digest();
    const sig = secp.sign(hash, privBytes);
    const recoverable = new Uint8Array(65);
    recoverable[0] = sig.recovery!;
    recoverable.set(sig.toCompactRawBytes(), 1);

    expect(hash.length).toBe(32);        // (buff 32) — message-hash
    expect(recoverable.length).toBe(65); // (buff 65) — signature
    expect(pubKey.length).toBe(33);      // (buff 33) — public-key
  });
});
