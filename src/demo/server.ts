// Local entry point: `npm start` (ts-node src/demo/server.ts).
// The Express app lives in ./app so the same routes can be mounted as a
// Vercel serverless function (see api/index.ts) without a listening socket.

import { app } from "./app";
import { config, isOfflineDemo } from "../config";

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
