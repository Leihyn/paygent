// Agent A using the x402 protocol for pay-per-request yield intelligence.
//
// Flow:
// 1. POST to Agent B's /x402/yield-advice (gets 402 back)
// 2. Parse payment instructions from the 402 response
// 3. Create SIP-010 escrow via v3 contract
// 4. Retry with X-PAYMENT header containing escrow proof
// 5. Display the recommendation

import axios from "axios";
import { config } from "../config";
import { createEscrowV3 } from "../contract/escrow-v3";
import { hashPayload } from "../contract/verify";
import { X402Payment, X402PaymentRequired } from "../x402/types";
import { YieldRecommendation } from "../types";

export async function requestYieldAdviceX402(): Promise<YieldRecommendation> {
  const agentBUrl = `http://localhost:${config.agentB.port}/x402/yield-advice`;

  console.log("\n[Agent A/x402] === Starting x402 yield intelligence request ===");
  console.log(`[Agent A/x402] Address: ${config.agentA.address}`);
  console.log(`[Agent A/x402] Target: ${agentBUrl}`);

  // Step 1: Make initial request -- expect 402 Payment Required
  console.log("\n[Agent A/x402] POST /x402/yield-advice");

  let firstResponse;
  try {
    firstResponse = await axios({
      url: agentBUrl,
      method: "POST",
      data: { question: "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?" },
      timeout: 120000,
      validateStatus: () => true,
    });
  } catch (err: any) {
    throw new Error(`[Agent A/x402] Initial request failed: ${err.message}`);
  }

  if (firstResponse.status !== 402) {
    // If not 402, we got the response directly (shouldn't happen with paywall)
    console.log(`[Agent A/x402] Got ${firstResponse.status} instead of 402, returning data`);
    return firstResponse.data?.data;
  }

  // Step 2: Parse payment instructions
  let instructions: X402PaymentRequired;
  try {
    const headerVal = firstResponse.headers["x-payment-required"];
    if (headerVal) {
      instructions = JSON.parse(Buffer.from(headerVal, "base64").toString("utf-8"));
    } else {
      instructions = firstResponse.data as X402PaymentRequired;
    }
  } catch {
    throw new Error("[Agent A/x402] Could not parse payment instructions from 402 response");
  }

  console.log(`[Agent A/x402] Received HTTP 402 Payment Required`);
  console.log(`[Agent A/x402] Price: ${instructions.price} ${instructions.tokenSymbol}`);
  console.log(`[Agent A/x402] Pay to: ${instructions.payTo}`);
  console.log(`[Agent A/x402] Network: ${instructions.network}`);
  console.log(`[Agent A/x402] Description: ${instructions.description}`);

  // Step 3: Create SIP-010 escrow
  console.log("\n[Agent A/x402] Creating SIP-010 escrow (mock sBTC)...");

  const requestPayload = {
    url: agentBUrl,
    method: "POST",
    data: { question: "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?" },
  };
  const requestHashHex = hashPayload(requestPayload).toString("hex");

  const { txId, jobId } = await createEscrowV3(
    instructions.payTo,
    config.agentB.publicKey,
    instructions.price,
    requestHashHex
  );

  console.log(`[Agent A/x402] Escrow created. Job ID: ${jobId}, TxID: ${txId}`);

  // Step 4: Build X-PAYMENT header and retry
  const payment: X402Payment = {
    version: "x402-v1",
    escrowTxId: txId,
    jobId,
    payer: config.agentA.address,
    signature: requestHashHex,
  };

  const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");

  console.log("[Agent A/x402] Retrying POST /x402/yield-advice with X-PAYMENT header...");

  let secondResponse;
  try {
    secondResponse = await axios({
      url: agentBUrl,
      method: "POST",
      data: { question: "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?" },
      timeout: 120000,
      headers: { "X-PAYMENT": paymentHeader },
      validateStatus: () => true,
    });
  } catch (err: any) {
    throw new Error(`[Agent A/x402] Paid request failed: ${err.message}`);
  }

  if (secondResponse.status === 402) {
    throw new Error("[Agent A/x402] Payment was rejected after retry");
  }

  if (!secondResponse.data?.success) {
    throw new Error(`[Agent A/x402] Agent B returned error: ${secondResponse.data?.error}`);
  }

  const recommendation: YieldRecommendation = secondResponse.data.data;

  // Step 5: Display result
  console.log("\n[Agent A/x402] === YIELD RECOMMENDATION RECEIVED (x402) ===");
  console.log(`Protocol:    ${recommendation.recommendation.protocol}`);
  console.log(`Asset:       ${recommendation.recommendation.asset}`);
  console.log(`APY:         ${(recommendation.recommendation.apy * 100).toFixed(2)}%`);
  console.log(`TVL:         $${(recommendation.recommendation.tvl / 1_000_000).toFixed(1)}M`);
  console.log(`Risk:        ${recommendation.recommendation.riskLevel}`);
  console.log(`Reasoning:   ${recommendation.reasoning}`);
  console.log(`\nResult Hash: ${recommendation.resultHash}`);
  console.log(`Signature:   ${recommendation.signature}`);
  console.log(`Complete TX: ${secondResponse.data.completeTxId}`);
  console.log(`\n[Agent A/x402] Payment of ${instructions.price} ${instructions.tokenSymbol} released to Agent B via SIP-010 escrow.`);
  console.log("[Agent A/x402] === Done ===\n");

  return recommendation;
}
