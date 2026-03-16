// Agent B: the provider agent.
// Express HTTP server that receives job requests from Agent A:
//   1. Validates the escrow exists and is legitimate
//   2. Fetches live yield data
//   3. Signs the recommendation
//   4. Claims payment via the Clarity contract
//   5. Returns the recommendation to Agent A

import express from "express";
import { config } from "../config";
import { fetchAllYields, generateReasoning } from "../yield/fetcher";
import { signPayload } from "../contract/verify";
import { completeEscrow, getEscrow } from "../contract/escrow";
import { AgentRequest, YieldRecommendation } from "../types";

const app = express();
app.use(express.json());

app.post("/request-yield-advice", async (req, res) => {
  try {
    const body = req.body;

    // Input validation
    if (!body || typeof body.jobId !== "number" || !body.agentAAddress || !body.question) {
      res.status(400).json({ success: false, error: "Missing required fields: jobId, agentAAddress, question" });
      return;
    }

    const agentRequest: AgentRequest = body;
    console.log(`\n[Agent B] Received job #${agentRequest.jobId} from ${agentRequest.agentAAddress}`);
    console.log(`[Agent B] Question: "${agentRequest.question}"`);

    // Step 0: Verify the escrow exists, is pending, and lists us as provider
    console.log("[Agent B] Verifying escrow on-chain...");
    const escrow = await getEscrow(agentRequest.jobId);

    if (!escrow) {
      res.status(400).json({ success: false, error: `Escrow #${agentRequest.jobId} not found` });
      return;
    }
    if (escrow.status !== "pending") {
      res.status(400).json({ success: false, error: `Escrow #${agentRequest.jobId} is ${escrow.status}, not pending` });
      return;
    }
    if (escrow.provider !== config.agentB.address) {
      res.status(403).json({ success: false, error: "This escrow is not assigned to this agent" });
      return;
    }
    if (escrow.amountUstx < config.paymentUstx) {
      res.status(400).json({ success: false, error: `Payment too low: ${escrow.amountUstx} < ${config.paymentUstx} microSTX` });
      return;
    }

    console.log(`[Agent B] Escrow verified: ${escrow.amountUstx} microSTX locked, status: ${escrow.status}`);

    // Step 1: Fetch live yields
    console.log("[Agent B] Fetching live yield data...");
    const allYields = await fetchAllYields();
    const top = allYields[0];
    const alternatives = allYields.slice(1);
    const reasoning = generateReasoning(top, allYields);

    // Step 2: Build the response payload (this is what gets hashed and signed)
    const payloadToSign = {
      jobId: agentRequest.jobId,
      recommendation: top,
      alternatives,
      reasoning,
      timestamp: Date.now(),
    };

    // Step 3: Sign the payload
    if (!config.agentB.privateKey) {
      throw new Error("AGENT_B_PRIVATE_KEY not configured");
    }
    console.log("[Agent B] Signing recommendation...");
    const { resultHashHex, signatureHex } = signPayload(payloadToSign, config.agentB.privateKey);
    console.log(`[Agent B] Result hash: ${resultHashHex}`);
    console.log(`[Agent B] Signature:   ${signatureHex}`);

    // Step 4: Submit to Stacks contract to claim payment
    console.log("[Agent B] Submitting to Stacks contract to claim payment...");
    const completeTxId = await completeEscrow(
      agentRequest.jobId,
      resultHashHex,
      signatureHex,
      escrow.amountUstx
    );
    console.log(`[Agent B] Payment claimed! TxID: ${completeTxId}`);

    // Step 5: Return recommendation to Agent A
    const recommendation: YieldRecommendation = {
      jobId: agentRequest.jobId,
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
    console.error("[Agent B] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", agent: "B", address: config.agentB.address }));

export function startAgentB() {
  const server = app.listen(config.agentB.port, () => {
    console.log(`[Agent B] Listening on port ${config.agentB.port}`);
    console.log(`[Agent B] Address: ${config.agentB.address}`);
  });
  return server;
}
