// Vercel serverless entry. vercel.json rewrites /api/* and /health here; the
// static page is served from public/ by the platform, not by this function.
//
// With no Stacks keys configured the function defaults to OFFLINE_DEMO=true so
// the hosted "RUN DEMO" works with zero secrets (src/config.ts then substitutes
// inert placeholders). Set AGENT_B_PRIVATE_KEY (+ the other vars in
// .env.example) to enable the live testnet modes.
if (!process.env.OFFLINE_DEMO && !process.env.AGENT_B_PRIVATE_KEY) {
  process.env.OFFLINE_DEMO = "true";
}

// require() (not import) so the env default above runs before src/config.ts
// reads process.env at module load.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../src/demo/app") as typeof import("../src/demo/app");

// The demo routes stream Server-Sent Events via res.write(); tell the Node
// runtime not to buffer the response. Offline runs finish in ~3s, well under
// maxDuration (60s is the Hobby-plan ceiling).
export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

export default app;
