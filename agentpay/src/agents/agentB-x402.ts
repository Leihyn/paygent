// Agent B with x402 middleware: SIP-010 pay-per-request yield intelligence.
//
// Express server that gates /x402/yield-advice behind HTTP 402.
// Payment is verified on-chain via the v3 SIP-010 escrow contract.

import express from "express";
import { config } from "../config";
import { fetchAllYields, generateReasoning } from "../yield/fetcher";
import { signPayload } from "../contract/verify";
import { completeEscrowV3, getEscrowV3 } from "../contract/escrow-v3";
import { x402Paywall } from "../x402/middleware";
import { createX402Verifier } from "../x402/verify";
import { X402Payment } from "../x402/types";
import { YieldRecommendation } from "../types";

const app = express();
app.use(express.json());

// x402 paywall configuration for yield endpoint
const paywallConfig = {
  price: config.paymentAmount,
  tokenSymbol: "msBTC",
  payTo: config.agentB.address,
  network: "stacks-testnet",
  description: "sBTC yield intelligence from 3 DeFi protocols",
  verifyPayment: createX402Verifier({
    requiredPrice: config.paymentAmount,
    payTo: config.agentB.address,
  }),
};

app.post("/x402/yield-advice", x402Paywall(paywallConfig), async (req, res) => {
  try {
    // Extract jobId from the X-PAYMENT header (payment already verified by middleware)
    const paymentHeader = req.headers["x-payment"] as string;
    let payment: X402Payment;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      payment = JSON.parse(decoded);
    } catch {
      res.status(400).json({ success: false, error: "Could not parse X-PAYMENT header" });
      return;
    }

    const jobId = payment.jobId;
    console.log(`\n[Agent B/x402] Payment verified for job #${jobId} from ${payment.payer}`);

    // Verify escrow on-chain
    console.log("[Agent B/x402] Verifying escrow on-chain...");
    const escrow = await getEscrowV3(jobId);

    if (!escrow) {
      res.status(400).json({ success: false, error: `Escrow #${jobId} not found` });
      return;
    }
    if (escrow.status !== "pending") {
      res.status(400).json({ success: false, error: `Escrow #${jobId} is ${escrow.status}, not pending` });
      return;
    }

    console.log(`[Agent B/x402] Escrow verified: ${escrow.amountUstx} msBTC locked`);

    // Fetch live yield data
    console.log("[Agent B/x402] Fetching live yield data...");
    const allYields = await fetchAllYields();
    const top = allYields[0];
    const alternatives = allYields.slice(1);
    const reasoning = generateReasoning(top, allYields);

    // Sign the recommendation
    const payloadToSign = {
      jobId,
      recommendation: top,
      alternatives,
      reasoning,
      timestamp: Date.now(),
    };

    if (!config.agentB.privateKey) {
      throw new Error("AGENT_B_PRIVATE_KEY not configured");
    }

    console.log("[Agent B/x402] Signing recommendation...");
    const { resultHashHex, signatureHex } = signPayload(payloadToSign, config.agentB.privateKey);
    console.log(`[Agent B/x402] Result hash: ${resultHashHex}`);
    console.log(`[Agent B/x402] Signature:   ${signatureHex}`);

    // Complete escrow to claim payment (SIP-010 transfer)
    console.log("[Agent B/x402] Completing v3 escrow to claim payment...");
    const completeTxId = await completeEscrowV3(
      jobId,
      resultHashHex,
      signatureHex,
      escrow.amountUstx
    );
    console.log(`[Agent B/x402] Payment claimed! TxID: ${completeTxId}`);

    // Return recommendation
    const recommendation: YieldRecommendation = {
      jobId,
      agentBAddress: config.agentB.address,
      recommendation: top,
      alternatives,
      reasoning,
      timestamp: payloadToSign.timestamp,
      resultHash: resultHashHex,
      signature: signatureHex,
    };

    res.json({ success: true, data: recommendation, completeTxId });
  } catch (err: any) {
    console.error("[Agent B/x402] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: "B-x402", address: config.agentB.address });
});

export function startAgentBx402() {
  const server = app.listen(config.agentB.port, () => {
    console.log(`[Agent B/x402] Listening on port ${config.agentB.port}`);
    console.log(`[Agent B/x402] Address: ${config.agentB.address}`);
    console.log(`[Agent B/x402] x402 paywall active on POST /x402/yield-advice`);
  });
  return server;
}
