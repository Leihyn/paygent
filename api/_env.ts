// Evaluated before ../src/demo/app so src/config.ts sees the default.
// With no Stacks keys configured the hosted demo runs in offline mode, which
// needs no secrets; src/config.ts then substitutes inert placeholders.
if (!process.env.OFFLINE_DEMO && !process.env.AGENT_B_PRIVATE_KEY) {
  process.env.OFFLINE_DEMO = "true";
}
export {};
