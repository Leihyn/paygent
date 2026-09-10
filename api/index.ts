// Vercel serverless entry. vercel.json rewrites /api/* and /health here; the
// static page is served from public/ by the platform, not by this function.
//
// Both imports are static so Vercel's bundler follows the whole graph and
// inlines dependencies. @noble/secp256k1 v2 is ESM-only: a dynamic require()
// here left it to be resolved at runtime, where the platform's CommonJS loader
// rejects it with ERR_REQUIRE_ESM. Bundling transpiles it instead.
// Import order matters: _env sets OFFLINE_DEMO before src/config.ts reads it.
import "./_env";
import { app } from "../src/demo/app";

// The demo routes stream Server-Sent Events via res.write(); tell the Node
// runtime not to buffer the response. Offline runs finish in ~3s, well under
// maxDuration (60s is the Hobby-plan ceiling).
export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

export default app;
