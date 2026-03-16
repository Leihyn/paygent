// Deploys the agentpay-escrow.clar contract to Stacks testnet.
// Run once: npm run deploy
// Then paste the contract address into .env

import {
  makeContractDeploy,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";
import { generateWallet } from "@stacks/wallet-sdk";
import { config } from "../config";
import * as fs from "fs";
import * as path from "path";

async function deploy() {
  const mnemonic = config.agentA.mnemonic;
  const wallet = await generateWallet({ secretKey: mnemonic, password: "" });
  const account = wallet.accounts[0];

  // Fetch current nonce from the network
  const accountInfoUrl = `${config.network.coreApiUrl}/v2/accounts/${config.agentA.address}?proof=0`;
  const accountInfo: any = await fetch(accountInfoUrl).then(r => r.json());
  const currentNonce = parseInt(accountInfo.nonce, 10);
  console.log(`[Deploy] Using nonce: ${currentNonce}`);

  const contractCode = fs.readFileSync(
    path.join(__dirname, "../../contracts/agentpay-escrow.clar"),
    "utf8"
  );

  console.log("[Deploy] Deploying agentpay-escrow contract...");
  console.log(`[Deploy] Deployer address: ${config.agentA.address}`);

  const txOptions = {
    contractName: "agentpay-escrow",
    codeBody: contractCode,
    senderKey: account.stxPrivateKey,
    network: config.network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 200000,
    nonce: currentNonce,
  };

  const transaction = await makeContractDeploy(txOptions);

  console.log("[Deploy] Transaction size:", transaction.serialize().length, "bytes");
  console.log("[Deploy] Broadcasting...");

  const broadcastUrl = `${config.network.coreApiUrl}/v2/transactions`;
  const response = await fetch(broadcastUrl, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: transaction.serialize(),
  });

  const result: any = await response.json();

  if (!response.ok || result.error) {
    console.error("[Deploy] Failed:", result.error, result.reason);
    process.exit(1);
  }

  const txid = typeof result === "string" ? result : result.txid;
  if (!txid) {
    console.error("[Deploy] No txid in response");
    process.exit(1);
  }

  console.log(`[Deploy] Success! TxID: ${txid}`);
  console.log(`[Deploy] Contract address: ${config.agentA.address}.agentpay-escrow`);
  console.log(`[Deploy] Add to .env:`);
  console.log(`  CONTRACT_ADDRESS=${config.agentA.address}`);
  console.log(`  CONTRACT_NAME=agentpay-escrow`);
}

deploy().catch(console.error);
