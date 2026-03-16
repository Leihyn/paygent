// Tests for escrow contract argument construction.
// Validates that TypeScript produces the correct buffer formats for Clarity.

import * as crypto from "crypto";

const secp = require("@noble/secp256k1");
const { hmac } = require("@noble/hashes/hmac");
const { sha256 } = require("@noble/hashes/sha256");

secp.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) => {
  const h = hmac.create(sha256, k);
  m.forEach((v: Uint8Array) => h.update(v));
  return h.digest();
};

describe("Escrow: contract argument construction", () => {
  it("builds a valid provider-pubkey buffer (33 bytes)", () => {
    const privKey = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
    const pubKey = secp.getPublicKey(secp.etc.hexToBytes(privKey), true);
    expect(Buffer.from(pubKey).length).toBe(33);
  });

  it("builds a valid request-hash buffer (32 bytes)", () => {
    const payload = { question: "best yield?", agentBAddress: "ST123" };
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto.createHash("sha256").update(json).digest();
    expect(hash.length).toBe(32);
  });

  it("builds a valid result-hash buffer (32 bytes)", () => {
    const payload = { jobId: 1, recommendation: { protocol: "Zest" }, timestamp: Date.now() };
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto.createHash("sha256").update(json).digest();
    expect(hash.length).toBe(32);
  });

  it("builds a valid signature buffer (65 bytes)", () => {
    const privKey = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
    const hash = crypto.createHash("sha256").update("test").digest();
    const sig = secp.sign(hash, secp.etc.hexToBytes(privKey));
    const recoverable = Buffer.alloc(65);
    recoverable[0] = sig.recovery!;
    Buffer.from(sig.toCompactRawBytes()).copy(recoverable, 1);
    expect(recoverable.length).toBe(65);
  });

  it("signature verifies against the matching public key", () => {
    const privKey = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
    const privBytes = secp.etc.hexToBytes(privKey);
    const pubKey = secp.getPublicKey(privBytes, true);
    const hash = crypto.createHash("sha256").update("test escrow").digest();
    const sig = secp.sign(hash, privBytes);

    expect(secp.verify(sig, hash, pubKey)).toBe(true);
  });

  it("signature does NOT verify against a different public key", () => {
    const privKey1 = "30c8093e80c6f9c039491dbfbb7a4c9c203c5744f9f2739712ac13a7fbaf91a1";
    const privKey2 = "0000000000000000000000000000000000000000000000000000000000000001";
    const wrongPubKey = secp.getPublicKey(secp.etc.hexToBytes(privKey2), true);

    const hash = crypto.createHash("sha256").update("test").digest();
    const sig = secp.sign(hash, secp.etc.hexToBytes(privKey1));

    expect(secp.verify(sig, hash, wrongPubKey)).toBe(false);
  });
});

describe("Escrow: on-chain integration", () => {
  const shouldRun = process.env.INTEGRATION === "true";

  (shouldRun ? it : it.skip)("should create an escrow job", async () => {
    const { createEscrow } = require("../src/contract/escrow");
    const { config } = require("../src/config");

    const requestHash = crypto.createHash("sha256").update("test request").digest("hex");
    const { txId, jobId } = await createEscrow(
      config.agentB.address,
      config.agentB.publicKey,
      50,
      requestHash
    );

    expect(txId).toBeTruthy();
    expect(jobId).toBeGreaterThan(0);
  }, 180000);

  (shouldRun ? it : it.skip)("should read escrow state", async () => {
    const { getEscrow } = require("../src/contract/escrow");
    const escrow = await getEscrow(1);

    expect(escrow).not.toBeNull();
    expect(escrow?.status).toBe("pending");
  }, 30000);
});
