// End-to-end demo runner.
// Starts Agent B, runs Agent A's request, then exits cleanly.
//
// Set OFFLINE_DEMO=true to skip all blockchain calls (runs in ~2 seconds).
// Useful for hackathon presentations where testnet latency is risky.

import { isOfflineDemo } from "../config";
import { startAgentB } from "../agents/agentB";
import { requestYieldAdvice } from "../agents/agentA";

async function runDemo() {
  console.log("=========================================================");
  console.log("  Paygent — Bitcoin-Native AI Agent Payments on Stacks");
  console.log("=========================================================");
  console.log("");
  if (isOfflineDemo) {
    console.log("  ** OFFLINE DEMO MODE — no blockchain calls **");
    console.log("");
  }
  console.log("  Agent A locks STX in escrow → requests yield advice");
  console.log("  Agent B verifies escrow → fetches DeFi data → signs response");
  console.log("  Clarity contract verifies signature → releases funds");
  console.log("");
  console.log("---------------------------------------------------------\n");

  const server = startAgentB();

  await new Promise(r => setTimeout(r, 1000));

  try {
    await requestYieldAdvice();

    console.log("---------------------------------------------------------");
    console.log("  Demo complete. Trustless payment verified on Stacks.");
    console.log("---------------------------------------------------------\n");
  } finally {
    server.close();
  }
}

runDemo().catch(err => {
  console.error("\nDemo failed:", err.message || err);
  process.exit(1);
});
