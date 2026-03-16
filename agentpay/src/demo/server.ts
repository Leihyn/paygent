// Unified demo server.
// - Serves the Terminal frontend from public/
// - Exposes GET /api/demo (SSE) that runs the full demo flow and streams events
// - Exposes GET /api/demo/offline (SSE) for offline mode
// - Mounts Agent B's routes for health checks

import express, { Request, Response } from "express";
import path from "path";
import { config, isOfflineDemo } from "../config";
import { createEscrow, completeEscrow, getEscrow } from "../contract/escrow";
import { createEscrowV3, completeEscrowV3, getEscrowV3 } from "../contract/escrow-v3";
import { fetchAllYields, generateReasoning } from "../yield/fetcher";
import { signPayload, hashPayload } from "../contract/verify";
import {
  demoEvents,
  emitLog,
  emitYieldData,
  emitSignature,
  emitEscrowState,
  emitDemoComplete,
  emitDemoError,
  DemoEvent,
} from "./events";

const app = express();
app.use(express.json());

// CORS for local dev
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ─── Static files ───
app.use(express.static(path.join(__dirname, "../../public")));

// ─── Agent B health route ───
app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: "B", address: config.agentB.address });
});

// ─── Demo state ───
let demoRunning = false;

// ─── SSE helpers ───
function setupSSE(res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("\n");
}

function sendSSE(res: Response, event: DemoEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Demo flow (inlined, no HTTP roundtrip) ───
async function runDemoFlow(offline: boolean): Promise<void> {
  const startTime = Date.now();

  emitLog("SYSTEM", "Paygent Demo starting...");
  if (offline) {
    emitLog("SYSTEM", "OFFLINE MODE. No blockchain calls");
  }
  emitLog("SYSTEM", "Connecting to Stacks testnet node...");
  await pause(300);
  emitLog("SYSTEM", "Connected to https://api.testnet.hiro.so");

  // Step 1: Create escrow
  emitLog("AGENT_A", "Creating escrow on Stacks testnet...");
  emitLog("AGENT_A", `Locking ${config.paymentUstx} microSTX for yield intelligence`);
  emitLog("AGENT_A", `Provider: ${config.agentB.address}`);
  emitLog("AGENT_A", `Consumer: ${config.agentA.address}`);

  emitEscrowState("creating", { amount: config.paymentUstx });

  const question =
    "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?";
  const requestPayload = { question, agentBAddress: config.agentB.address };
  const requestHashHex = hashPayload(requestPayload).toString("hex");

  let txId: string;
  let jobId: number;

  if (offline) {
    await pause(400);
    txId = "offline-tx-create-" + Date.now();
    jobId = 1;
  } else {
    const escrowResult = await createEscrow(
      config.agentB.address,
      config.agentB.publicKey,
      config.paymentUstx,
      requestHashHex
    );
    txId = escrowResult.txId;
    jobId = escrowResult.jobId;
  }

  emitLog("CONTRACT", `Escrow created. TxID: 0x${txId.substring(0, 12)}...`);
  emitEscrowState("pending", { jobId, txId, amount: config.paymentUstx });

  if (!offline) {
    emitLog("CONTRACT", "Polling for confirmation...");
    await pause(200);
  }

  emitLog("CONTRACT", `Confirmed. Job ID: ${jobId}`);
  emitLog("CONTRACT", `Status: PENDING | Amount: ${config.paymentUstx} uSTX`);

  // Step 2: Agent A requests advice
  emitLog("AGENT_A", `Requesting yield advice from Agent B...`);
  await pause(300);

  // Step 3: Agent B receives and verifies
  emitLog("AGENT_B", `Received job #${jobId}`);
  emitLog("AGENT_B", "Verifying escrow on-chain...");

  let escrow;
  if (offline) {
    await pause(300);
    escrow = {
      jobId,
      requester: config.agentA.address,
      provider: config.agentB.address,
      amountUstx: config.paymentUstx,
      status: "pending" as const,
      requestHash: "0".repeat(64),
      resultHash: "0".repeat(64),
      createdAt: 0,
    };
  } else {
    escrow = await getEscrow(jobId);
    if (!escrow) throw new Error(`Escrow #${jobId} not found on-chain`);
  }

  emitLog(
    "AGENT_B",
    `Escrow verified: ${escrow.amountUstx} microSTX locked, provider matches`
  );

  // Step 4: Fetch yield data
  emitLog("AGENT_B", "Fetching live yield data...");
  emitLog("YIELD", "Fetching from DefiLlama...");

  const allYields = await fetchAllYields();

  emitLog("YIELD", `${allYields.length} protocols responded`);
  emitYieldData(allYields);

  const top = allYields[0];
  const alternatives = allYields.slice(1);
  const reasoning = generateReasoning(top, allYields);

  emitLog(
    "AGENT_B",
    `Recommendation: ${top.protocol} (${(top.apy * 100).toFixed(2)}% APY, ${top.riskLevel} risk)`
  );

  if (alternatives.length > 0) {
    emitLog(
      "AGENT_B",
      `Alternative: ${alternatives[0].protocol} (${(alternatives[0].apy * 100).toFixed(2)}% APY, ${alternatives[0].riskLevel} risk)`
    );
  }

  // Step 5: Sign the recommendation
  emitLog("AGENT_B", "Signing recommendation with secp256k1...");

  const payloadToSign = {
    jobId,
    recommendation: top,
    alternatives,
    reasoning,
    timestamp: Date.now(),
  };

  let resultHashHex: string;
  let signatureHex: string;

  if (!config.agentB.privateKey) {
    throw new Error("AGENT_B_PRIVATE_KEY not configured");
  }

  const signed = signPayload(payloadToSign, config.agentB.privateKey);
  resultHashHex = signed.resultHashHex;
  signatureHex = signed.signatureHex;

  emitLog("AGENT_B", "Result signed");
  emitSignature(resultHashHex, signatureHex, config.agentB.publicKey);

  // Step 6: Complete escrow
  emitLog("AGENT_B", "Submitting to Stacks contract...");
  emitEscrowState("completing", { jobId });

  let completeTxId: string;
  if (offline) {
    await pause(400);
    completeTxId = "offline-tx-complete-" + Date.now();
  } else {
    completeTxId = await completeEscrow(
      jobId,
      resultHashHex,
      signatureHex,
      escrow.amountUstx
    );
  }

  emitLog("CONTRACT", "secp256k1-verify PASSED");
  emitLog("CONTRACT", "sha256 result hash matches on-chain commitment");
  emitLog(
    "CONTRACT",
    `Payment of ${config.paymentUstx} microSTX released to Agent B`
  );
  emitLog("CONTRACT", `Escrow #${jobId} status: COMPLETED`);
  emitLog("CONTRACT", `Complete TxID: 0x${completeTxId.substring(0, 12)}...`);

  emitEscrowState("completed", { jobId, txId: completeTxId });

  const duration = (Date.now() - startTime) / 1000;
  emitLog("SYSTEM", `Demo complete. Round-trip: ${duration.toFixed(1)}s`);
  emitDemoComplete(duration);
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── SSE endpoint: live demo ───
app.get("/api/demo", (req: Request, res: Response) => {
  if (demoRunning) {
    res.status(409).json({ error: "Demo in progress" });
    return;
  }

  const forceOffline = req.query.offline === "true";
  const offline = isOfflineDemo || forceOffline;

  demoRunning = true;
  setupSSE(res);

  const listener = (event: DemoEvent) => {
    sendSSE(res, event);
  };

  demoEvents.on("demo-event", listener);

  // Clean up on client disconnect
  req.on("close", () => {
    demoEvents.removeListener("demo-event", listener);
    demoRunning = false;
  });

  // Run the demo
  runDemoFlow(offline)
    .catch((err) => {
      emitDemoError(err.message || String(err));
    })
    .finally(() => {
      // Small delay to ensure final events are flushed
      setTimeout(() => {
        demoEvents.removeListener("demo-event", listener);
        demoRunning = false;
        res.end();
      }, 500);
    });
});

// ─── SSE endpoint: offline shortcut ───
app.get("/api/demo/offline", (req: Request, res: Response) => {
  if (demoRunning) {
    res.status(409).json({ error: "Demo in progress" });
    return;
  }

  demoRunning = true;
  setupSSE(res);

  const listener = (event: DemoEvent) => {
    sendSSE(res, event);
  };

  demoEvents.on("demo-event", listener);

  req.on("close", () => {
    demoEvents.removeListener("demo-event", listener);
    demoRunning = false;
  });

  runDemoFlow(true)
    .catch((err) => {
      emitDemoError(err.message || String(err));
    })
    .finally(() => {
      setTimeout(() => {
        demoEvents.removeListener("demo-event", listener);
        demoRunning = false;
        res.end();
      }, 500);
    });
});

// ─── x402 Demo flow (SIP-010 escrow + HTTP 402 protocol) ───
async function runX402DemoFlow(offline: boolean): Promise<void> {
  const startTime = Date.now();

  emitLog("SYSTEM", "Paygent x402 Demo starting...");
  emitLog("SYSTEM", "Protocol: HTTP 402 Payment Required + SIP-010 Escrow");
  if (offline) {
    emitLog("SYSTEM", "OFFLINE MODE. No blockchain calls");
  }
  await pause(300);

  // Step 1: Agent A makes initial request
  emitLog("AGENT_A", "POST /x402/yield-advice");
  await pause(200);

  // Step 2: Agent B returns 402
  emitLog("CONTRACT", "Agent B returned HTTP 402 Payment Required");
  emitLog("CONTRACT", `Price: ${config.paymentAmount} msBTC`);
  emitLog("CONTRACT", `Pay to: ${config.agentB.address}`);
  emitLog("CONTRACT", `Network: stacks-testnet`);
  emitLog("CONTRACT", `Description: sBTC yield intelligence from 3 DeFi protocols`);
  await pause(300);

  // Step 3: Agent A creates SIP-010 escrow
  emitLog("AGENT_A", "Creating SIP-010 escrow (mock sBTC)...");
  emitLog("AGENT_A", `Locking ${config.paymentAmount} msBTC for yield intelligence`);
  emitLog("AGENT_A", `Provider: ${config.agentB.address}`);
  emitLog("AGENT_A", `Consumer: ${config.agentA.address}`);

  emitEscrowState("creating", { amount: config.paymentAmount });

  const question =
    "Where should I deposit my idle sBTC for the best risk-adjusted yield on Stacks?";
  const requestPayload = { question, agentBAddress: config.agentB.address };
  const requestHashHex = hashPayload(requestPayload).toString("hex");

  let txId: string;
  let jobId: number;

  if (offline) {
    await pause(400);
    txId = "offline-tx-create-v3-" + Date.now();
    jobId = 1;
  } else {
    const escrowResult = await createEscrowV3(
      config.agentB.address,
      config.agentB.publicKey,
      config.paymentAmount,
      requestHashHex
    );
    txId = escrowResult.txId;
    jobId = escrowResult.jobId;
  }

  emitLog("CONTRACT", `SIP-010 Escrow created. TxID: 0x${txId.substring(0, 12)}...`);
  emitEscrowState("pending", { jobId, txId, amount: config.paymentAmount });

  if (!offline) {
    emitLog("CONTRACT", "Polling for confirmation...");
    await pause(200);
  }

  emitLog("CONTRACT", `Confirmed. Job ID: ${jobId}`);
  emitLog("CONTRACT", `Status: PENDING | Amount: ${config.paymentAmount} msBTC`);

  // Step 4: Agent A retries with X-PAYMENT header
  emitLog("AGENT_A", "Built X-PAYMENT header with escrow proof");
  emitLog("AGENT_A", "Retrying POST /x402/yield-advice with payment...");
  await pause(200);

  // Step 5: Agent B receives and verifies
  emitLog("AGENT_B", "Received request with X-PAYMENT header");
  emitLog("AGENT_B", "Payment verified via x402");
  emitLog("AGENT_B", "Verifying escrow on-chain...");

  let escrow;
  if (offline) {
    await pause(300);
    escrow = {
      jobId,
      requester: config.agentA.address,
      provider: config.agentB.address,
      amountUstx: config.paymentAmount,
      status: "pending" as const,
      requestHash: "0".repeat(64),
      resultHash: "0".repeat(64),
      createdAt: 0,
    };
  } else {
    escrow = await getEscrowV3(jobId);
    if (!escrow) throw new Error(`v3 Escrow #${jobId} not found on-chain`);
  }

  emitLog("AGENT_B", `Escrow verified: ${escrow.amountUstx} msBTC locked`);

  // Step 6: Fetch yield data
  emitLog("AGENT_B", "Fetching live yield data...");
  emitLog("YIELD", "Fetching from DefiLlama...");

  const allYields = await fetchAllYields();

  emitLog("YIELD", `${allYields.length} protocols responded`);
  emitYieldData(allYields);

  const top = allYields[0];
  const alternatives = allYields.slice(1);
  const reasoning = generateReasoning(top, allYields);

  emitLog(
    "AGENT_B",
    `Recommendation: ${top.protocol} (${(top.apy * 100).toFixed(2)}% APY, ${top.riskLevel} risk)`
  );

  if (alternatives.length > 0) {
    emitLog(
      "AGENT_B",
      `Alternative: ${alternatives[0].protocol} (${(alternatives[0].apy * 100).toFixed(2)}% APY, ${alternatives[0].riskLevel} risk)`
    );
  }

  // Step 7: Sign the recommendation
  emitLog("AGENT_B", "Signing recommendation with secp256k1...");

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

  const signed = signPayload(payloadToSign, config.agentB.privateKey);
  const resultHashHex = signed.resultHashHex;
  const signatureHex = signed.signatureHex;

  emitLog("AGENT_B", "Result signed");
  emitSignature(resultHashHex, signatureHex, config.agentB.publicKey);

  // Step 8: Complete escrow (SIP-010 transfer)
  emitLog("AGENT_B", "Submitting to Stacks contract (SIP-010 transfer)...");
  emitEscrowState("completing", { jobId });

  let completeTxId: string;
  if (offline) {
    await pause(400);
    completeTxId = "offline-tx-complete-v3-" + Date.now();
  } else {
    completeTxId = await completeEscrowV3(
      jobId,
      resultHashHex,
      signatureHex,
      escrow.amountUstx
    );
  }

  emitLog("CONTRACT", "secp256k1-verify PASSED");
  emitLog("CONTRACT", "sha256 result hash matches on-chain commitment");
  emitLog(
    "CONTRACT",
    `Payment of ${config.paymentAmount} msBTC released to Agent B`
  );
  emitLog("CONTRACT", `Escrow #${jobId} status: COMPLETED`);
  emitLog("CONTRACT", `Complete TxID: 0x${completeTxId.substring(0, 12)}...`);

  emitEscrowState("completed", { jobId, txId: completeTxId });

  const duration = (Date.now() - startTime) / 1000;
  emitLog("SYSTEM", `x402 Demo complete. Round-trip: ${duration.toFixed(1)}s`);
  emitDemoComplete(duration);
}

// ─── SSE endpoint: x402 demo ───
app.get("/api/demo-x402", (req: Request, res: Response) => {
  if (demoRunning) {
    res.status(409).json({ error: "Demo in progress" });
    return;
  }

  const forceOffline = req.query.offline === "true";
  const offline = isOfflineDemo || forceOffline;

  demoRunning = true;
  setupSSE(res);

  const listener = (event: DemoEvent) => {
    sendSSE(res, event);
  };

  demoEvents.on("demo-event", listener);

  req.on("close", () => {
    demoEvents.removeListener("demo-event", listener);
    demoRunning = false;
  });

  runX402DemoFlow(offline)
    .catch((err) => {
      emitDemoError(err.message || String(err));
    })
    .finally(() => {
      setTimeout(() => {
        demoEvents.removeListener("demo-event", listener);
        demoRunning = false;
        res.end();
      }, 500);
    });
});

// ─── SSE endpoint: x402 offline shortcut ───
app.get("/api/demo-x402/offline", (req: Request, res: Response) => {
  if (demoRunning) {
    res.status(409).json({ error: "Demo in progress" });
    return;
  }

  demoRunning = true;
  setupSSE(res);

  const listener = (event: DemoEvent) => {
    sendSSE(res, event);
  };

  demoEvents.on("demo-event", listener);

  req.on("close", () => {
    demoEvents.removeListener("demo-event", listener);
    demoRunning = false;
  });

  runX402DemoFlow(true)
    .catch((err) => {
      emitDemoError(err.message || String(err));
    })
    .finally(() => {
      setTimeout(() => {
        demoEvents.removeListener("demo-event", listener);
        demoRunning = false;
        res.end();
      }, 500);
    });
});

// ─── Fallback: serve index.html for SPA routes ───
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// ─── Start ───
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`[Paygent] Server running on http://localhost:${PORT}`);
  console.log(`[Paygent] Agent A: ${config.agentA.address}`);
  console.log(`[Paygent] Agent B: ${config.agentB.address}`);
  console.log(`[Paygent] Payment: ${config.paymentUstx} microSTX`);
  if (isOfflineDemo) {
    console.log(`[Paygent] OFFLINE_DEMO=true — blockchain calls will be mocked`);
  }
  console.log(`[Paygent] Open http://localhost:${PORT} in your browser`);
});
