import * as dotenv from "dotenv";
import { StacksTestnet } from "@stacks/network";

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

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

export const isOfflineDemo = process.env.OFFLINE_DEMO === "true";

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
    publicKey: required("AGENT_B_PUBLIC_KEY"),
    // Private key: used only by Agent B for signing. Not accessed by Agent A code.
    privateKey: optional("AGENT_B_PRIVATE_KEY"),
    port: agentBPort,
  },
  contract: {
    address: required("CONTRACT_ADDRESS"),
    name: required("CONTRACT_NAME"),
  },
  // SIP-010 token used for escrow payments (sBTC, mock-sbtc, etc.)
  // If not set, falls back to STX-based escrow (v2 contract)
  token: {
    address: optional("TOKEN_CONTRACT_ADDRESS") || "",
    name: optional("TOKEN_CONTRACT_NAME") || "",
  },
  paymentAmount: paymentUstx,
  // Keep old name for backward compat
  paymentUstx,
};
