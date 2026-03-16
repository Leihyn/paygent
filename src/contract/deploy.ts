// Deploys the contract suite to Stacks testnet:
//   1. sip-010-trait (the SIP-010 fungible token trait)
//   2. mock-sbtc (mock sBTC for testing)
//   3. agentpay-escrow (SIP-010 escrow contract)
//
// Run: npx ts-node src/contract/deploy.ts

import {
  makeContractDeploy,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";
import { generateWallet } from "@stacks/wallet-sdk";
import { config } from "../config";
import * as fs from "fs";
import * as path from "path";

async function getNonce(address: string): Promise<number> {
  const url = `${config.network.coreApiUrl}/v2/accounts/${address}?proof=0`;
  const res = await fetch(url);
  const info: any = await res.json();
  return parseInt(info.nonce, 10);
}

async function deployContract(
  senderKey: string,
  contractName: string,
  filePath: string,
  nonce: number,
  fee: number = 200000
): Promise<string> {
  const code = fs.readFileSync(filePath, "utf8");
  console.log(`\n[Deploy] ${contractName} (${code.length} bytes, nonce ${nonce})`);

  const tx = await makeContractDeploy({
    contractName,
    codeBody: code,
    senderKey,
    network: config.network as any,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee,
    nonce,
  });

  const serialized = Buffer.from(tx.serialize());
  const res = await fetch(`${config.network.coreApiUrl}/v2/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: serialized,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Deploy ${contractName} failed (${res.status}): ${text}`);
  }

  const txid = text.replace(/"/g, "");
  console.log(`[Deploy] ${contractName} broadcast. TxID: ${txid}`);
  return txid;
}

async function waitForTx(txid: string, label: string): Promise<void> {
  const url = `${config.network.coreApiUrl}/extended/v1/tx/0x${txid}`;
  console.log(`[Deploy] Waiting for ${label} to confirm...`);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const res = await fetch(url);
      const tx: any = await res.json();
      if (tx.tx_status === "success") {
        console.log(`[Deploy] ${label} confirmed.`);
        return;
      }
      if (tx.tx_status?.startsWith("abort")) {
        throw new Error(`${label} failed: ${tx.tx_status} - ${tx.tx_result?.repr}`);
      }
    } catch (err: any) {
      if (err.message?.includes("failed:")) throw err;
    }
  }
  throw new Error(`${label} did not confirm in 5 minutes`);
}

async function main() {
  console.log("=========================================================");
  console.log("  Paygent Contract Deployment");
  console.log("  SIP-010 Token Escrow + Mock sBTC");
  console.log("=========================================================");

  const wallet = await generateWallet({ secretKey: config.agentA.mnemonic, password: "" });
  const account = wallet.accounts[0];
  const address = config.agentA.address;

  console.log(`\n[Deploy] Deployer: ${address}`);

  let nonce = await getNonce(address);
  console.log(`[Deploy] Starting nonce: ${nonce}`);

  const contractsDir = path.join(__dirname, "../../contracts");

  // Deploy in order: trait first, then token, then escrow (depends on trait)
  const txid1 = await deployContract(
    account.stxPrivateKey, "sip-010-trait",
    path.join(contractsDir, "sip-010-trait.clar"), nonce++
  );

  const txid2 = await deployContract(
    account.stxPrivateKey, "mock-sbtc",
    path.join(contractsDir, "mock-sbtc.clar"), nonce++
  );

  // Wait for trait to confirm before deploying escrow (escrow references trait)
  await waitForTx(txid1, "sip-010-trait");
  await waitForTx(txid2, "mock-sbtc");

  const txid3 = await deployContract(
    account.stxPrivateKey, "agentpay-escrow",
    path.join(contractsDir, "agentpay-escrow.clar"), nonce++
  );

  await waitForTx(txid3, "agentpay-escrow");

  console.log("\n=========================================================");
  console.log("  All contracts deployed successfully");
  console.log("=========================================================");
  console.log(`\n  Update your .env:\n`);
  console.log(`  CONTRACT_ADDRESS=${address}`);
  console.log(`  CONTRACT_NAME=agentpay-escrow`);
  console.log(`  TOKEN_CONTRACT_ADDRESS=${address}`);
  console.log(`  TOKEN_CONTRACT_NAME=mock-sbtc`);
  console.log(`\n  Trait: ${address}.sip-010-trait`);
  console.log(`  Token: ${address}.mock-sbtc`);
  console.log(`  Escrow: ${address}.agentpay-escrow\n`);
}

main().catch(err => {
  console.error("\nDeployment failed:", err.message);
  process.exit(1);
});
