// Agent A: the requester agent.
// Creates escrow on Stacks, sends request to Agent B, displays the result.

import axios from "axios";
import { config } from "../config";
import { createEscrow } from "../contract/escrow";
import { hashPayload } from "../contract/verify";
import { AgentRequest, YieldRecommendation } from "../types";

export async function requestYieldAdvice(): Promise<YieldRecommendation> {
  console.log("\n[Agent A] === Starting yield intelligence request ===");
  console.log(`[Agent A] Address: ${config.agentA.address}`);
  console.log(`[Agent A] Will pay ${config.paymentUstx} microSTX to Agent B`);

  // Build the request so we can hash it before creating escrow
  const question = "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?";
  const requestPayload = { question, agentBAddress: config.agentB.address };
  const requestHashHex = hashPayload(requestPayload).toString("hex");

  // Step 1: Create escrow — locks STX and commits to the request hash on-chain
  console.log("\n[Agent A] Creating escrow on Stacks testnet...");
  console.log(`[Agent A] Agent B public key: ${config.agentB.publicKey}`);
  console.log(`[Agent A] Request hash: ${requestHashHex}`);

  const { txId, jobId } = await createEscrow(
    config.agentB.address,
    config.agentB.publicKey,
    config.paymentUstx,
    requestHashHex
  );
  console.log(`[Agent A] Escrow created. Job ID: ${jobId}, TxID: ${txId}`);

  // Step 2: Send request to Agent B
  const request: AgentRequest = {
    jobId,
    question,
    agentAAddress: config.agentA.address,
    agentBAddress: config.agentB.address,
    paymentTxId: txId,
  };

  console.log(`\n[Agent A] Requesting yield advice from Agent B (job #${jobId})...`);
  const response = await axios.post(
    `http://localhost:${config.agentB.port}/request-yield-advice`,
    request,
    { timeout: 120000 }
  );

  if (!response.data.success) {
    throw new Error(`Agent B returned error: ${response.data.error}`);
  }

  const recommendation: YieldRecommendation = response.data.data;

  // Step 3: Display result
  console.log("\n[Agent A] === YIELD RECOMMENDATION RECEIVED ===");
  console.log(`Protocol:    ${recommendation.recommendation.protocol}`);
  console.log(`Asset:       ${recommendation.recommendation.asset}`);
  console.log(`APY:         ${(recommendation.recommendation.apy * 100).toFixed(2)}%`);
  console.log(`TVL:         $${(recommendation.recommendation.tvl / 1_000_000).toFixed(1)}M`);
  console.log(`Risk:        ${recommendation.recommendation.riskLevel}`);
  console.log(`Reasoning:   ${recommendation.reasoning}`);
  console.log(`\nResult Hash: ${recommendation.resultHash}`);
  console.log(`Signature:   ${recommendation.signature}`);
  console.log(`Complete TX: ${response.data.completeTxId}`);
  console.log(`\n[Agent A] Payment of ${config.paymentUstx} microSTX released to Agent B via Clarity contract.`);
  console.log("[Agent A] === Done ===\n");

  return recommendation;
}
