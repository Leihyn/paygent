import * as dotenv from "dotenv";
import { StacksTestnet } from "@stacks/network";
import { etc, getPublicKey, utils } from "@noble/secp256k1";

dotenv.config();

export const isOfflineDemo = process.env.OFFLINE_DEMO === "true";

// Offline demo (OFFLINE_DEMO=true) never touches Stacks, so missing env vars
// fall back to inert placeholders instead of throwing at import time. This is
// what lets a hosted deployment (Vercel) run the demo with no secrets configured.
// With OFFLINE_DEMO unset, behaviour is unchanged: every var below is required.
const OFFLINE_PLACEHOLDERS: Record<string, string> = {
  AGENT_A_MNEMONIC: "offline demo placeholder mnemonic (not a wallet)",
  AGENT_A_ADDRESS: "ST-DEMO-AGENT-A",
  AGENT_B_MNEMONIC: "offline demo placeholder mnemonic (not a wallet)",
  AGENT_B_ADDRESS: "ST-DEMO-AGENT-B",
  CONTRACT_ADDRESS: "ST-DEMO-CONTRACT",
  CONTRACT_NAME: "agentpay-escrow",
};

function required(key: string): string {
  const val = process.env[key];
  if (val) return val;
  if (isOfflineDemo && key in OFFLINE_PLACEHOLDERS) return OFFLINE_PLACEHOLDERS[key];
  throw new Error(`Missing required env var: ${key}`);
}

// Offline demo still signs the recommendation (secp256k1). Without a configured
// key, mint a throwaway keypair per process so the signature box is populated.
function offlineKeypair(): { privateKey: string; publicKey: string } {
  const priv = utils.randomPrivateKey();
  return {
    privateKey: etc.bytesToHex(priv),
    publicKey: etc.bytesToHex(getPublicKey(priv, true)),
  };
}
const throwawayKeys =
  isOfflineDemo && !process.env.AGENT_B_PRIVATE_KEY ? offlineKeypair() : undefined;

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

const paymentUstx = parseInt(process.env.PAYMENT_USTX || process.env.PAYMENT_SATS || "50", 10);
if (isNaN(paymentUstx) || paymentUstx <= 0) {
  throw new Error("PAYMENT_USTX must be a positive integer");
}

const agentBPort = parseInt(process.env.AGENT_B_PORT || "3001", 10);
if (isNaN(agentBPort)) {
  throw new Error("AGENT_B_PORT must be a valid port number");
}

export const config = {
  network: new StacksTestnet({ url: "https://api.testnet.hiro.so" }),
  agentA: {
    mnemonic: required("AGENT_A_MNEMONIC"),
    address: required("AGENT_A_ADDRESS"),
  },
  agentB: {
    mnemonic: required("AGENT_B_MNEMONIC"),
    address: required("AGENT_B_ADDRESS"),
    // Public key: used by Agent A to register in escrow. No private key needed.
    publicKey: throwawayKeys ? throwawayKeys.publicKey : required("AGENT_B_PUBLIC_KEY"),
    // Private key: used only by Agent B for signing. Not accessed by Agent A code.
    privateKey: throwawayKeys ? throwawayKeys.privateKey : optional("AGENT_B_PRIVATE_KEY"),
    port: agentBPort,
  },
  contract: {
    address: required("CONTRACT_ADDRESS"),
    name: required("CONTRACT_NAME"),
  },
  // SIP-010 token used for escrow payments (sBTC, mock-sbtc, etc.)
  token: {
    address: optional("TOKEN_CONTRACT_ADDRESS") || "",
    name: optional("TOKEN_CONTRACT_NAME") || "",
  },
  paymentAmount: paymentUstx,
  paymentUstx,
};
