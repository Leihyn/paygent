// Wallet Generator for AgentPay
// Generates two testnet wallets and outputs the public key needed for .env
// Usage: npx ts-node generate-wallets.ts

import { generateWallet, generateSecretKey } from "@stacks/wallet-sdk";
import { getPublicKey, etc } from "@noble/secp256k1";

const { bytesToHex } = etc;

async function generateAgentPayWallets() {
  console.log("=========================================================");
  console.log("  AgentPay Wallet Generator");
  console.log("=========================================================\n");

  const secretKeyA = generateSecretKey(256);
  const secretKeyB = generateSecretKey(256);

  const walletA = await generateWallet({ secretKey: secretKeyA, password: "" });
  const walletB = await generateWallet({ secretKey: secretKeyB, password: "" });

  const accountA = walletA.accounts[0];
  const accountB = walletB.accounts[0];

  // Derive compressed public key for Agent B
  const privKeyB = accountB.stxPrivateKey.slice(0, 64);
  const pubKeyB = getPublicKey(etc.hexToBytes(privKeyB), true);
  const pubKeyBHex = bytesToHex(pubKeyB);

  console.log("== AGENT A (Requester) ==\n");
  console.log(`Mnemonic:    ${secretKeyA}`);
  console.log(`Private Key: ${accountA.stxPrivateKey.slice(0, 64)}\n`);

  console.log("== AGENT B (Provider) ==\n");
  console.log(`Mnemonic:    ${secretKeyB}`);
  console.log(`Private Key: ${privKeyB}`);
  console.log(`Public Key:  ${pubKeyBHex}\n`);

  console.log("== NEXT STEPS ==\n");
  console.log("1. Import mnemonics into Hiro Wallet: https://wallet.hiro.so/");
  console.log("   Copy the Stacks addresses shown in the wallet.\n");
  console.log("2. Get testnet STX: https://explorer.hiro.so/sandbox/faucet?chain=testnet\n");
  console.log("3. Fill in .env with the values above plus addresses from Hiro Wallet.\n");
  console.log("4. Deploy: npm run deploy\n");
  console.log("5. Demo:   npm run demo\n");
}

generateAgentPayWallets().catch(console.error);
