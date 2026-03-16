// Escrow functions for the SIP-010 contract.
// Uses a fungible token (mock-sbtc) instead of native STX.

import {
  makeContractCall,
  broadcastTransaction,
  callReadOnlyFunction,
  standardPrincipalCV,
  contractPrincipalCV,
  uintCV,
  bufferCV,
  cvToValue,
  PostConditionMode,
  AnchorMode,
  FungibleConditionCode,
  makeStandardFungiblePostCondition,
  makeContractFungiblePostCondition,
  createAssetInfo,
} from "@stacks/transactions";
import { generateWallet } from "@stacks/wallet-sdk";
import { config, isOfflineDemo } from "../config";
import { EscrowJob } from "../types";

// Cache derived accounts so we don't re-derive from mnemonic on every call.
const accountCache = new Map<string, any>();

async function deriveAccount(mnemonic: string) {
  if (accountCache.has(mnemonic)) return accountCache.get(mnemonic)!;
  const wallet = await generateWallet({ secretKey: mnemonic, password: "" });
  const account = wallet.accounts[0];
  accountCache.set(mnemonic, account);
  return account;
}

// Agent A creates a SIP-010 escrow, locking fungible tokens on-chain.
// requestHashHex: SHA256 of the request payload -- commits to what Agent A is paying for.
export async function createEscrow(
  agentBAddress: string,
  agentBPublicKeyHex: string,
  amount: number,
  requestHashHex: string
): Promise<{ txId: string; jobId: number }> {
  if (isOfflineDemo) {
    console.log("[Paygent] OFFLINE MODE -- simulating escrow creation");
    return { txId: "offline-tx-create-" + Date.now(), jobId: 1 };
  }

  const account = await deriveAccount(config.agentA.mnemonic);

  const assetInfo = createAssetInfo(
    config.token.address,
    config.token.name,
    "mock-sbtc"
  );

  const postConditions = [
    makeStandardFungiblePostCondition(
      config.agentA.address,
      FungibleConditionCode.Equal,
      amount,
      assetInfo
    ),
  ];

  const txOptions = {
    contractAddress: config.contract.address,
    contractName: "agentpay-escrow",
    functionName: "create-escrow",
    functionArgs: [
      standardPrincipalCV(agentBAddress),
      uintCV(amount),
      bufferCV(Buffer.from(agentBPublicKeyHex, "hex")),
      bufferCV(Buffer.from(requestHashHex, "hex")),
      contractPrincipalCV(config.token.address, config.token.name),
    ],
    senderKey: account.stxPrivateKey,
    network: config.network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    postConditions,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, config.network);

  if ("error" in broadcastResponse) {
    throw new Error(`Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`);
  }

  console.log(`[Paygent] Escrow created. TxID: ${broadcastResponse.txid}`);
  const jobId = await pollForJobId(broadcastResponse.txid);
  return { txId: broadcastResponse.txid, jobId };
}

// Agent B claims payment after delivering the service (SIP-010 token transfer).
export async function completeEscrow(
  jobId: number,
  resultHashHex: string,
  signatureHex: string,
  expectedAmount: number
): Promise<string> {
  if (isOfflineDemo) {
    console.log("[Paygent] OFFLINE MODE -- simulating escrow completion");
    return "offline-tx-complete-" + Date.now();
  }

  const account = await deriveAccount(config.agentB.mnemonic);

  const assetInfo = createAssetInfo(
    config.token.address,
    config.token.name,
    "mock-sbtc"
  );

  const postConditions = [
    makeContractFungiblePostCondition(
      config.contract.address,
      "agentpay-escrow",
      FungibleConditionCode.Equal,
      expectedAmount,
      assetInfo
    ),
  ];

  const txOptions = {
    contractAddress: config.contract.address,
    contractName: "agentpay-escrow",
    functionName: "complete-escrow",
    functionArgs: [
      uintCV(jobId),
      bufferCV(Buffer.from(resultHashHex, "hex")),
      bufferCV(Buffer.from(signatureHex, "hex")),
      contractPrincipalCV(config.token.address, config.token.name),
    ],
    senderKey: account.stxPrivateKey,
    network: config.network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    postConditions,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, config.network);

  if ("error" in broadcastResponse) {
    throw new Error(`Complete escrow failed: ${broadcastResponse.error}`);
  }

  console.log(`[Paygent] Escrow completed. TxID: ${broadcastResponse.txid}`);
  return broadcastResponse.txid;
}

// Read-only: fetch escrow state from the contract.
export async function getEscrow(jobId: number): Promise<EscrowJob | null> {
  if (isOfflineDemo) {
    return {
      jobId,
      requester: config.agentA.address,
      provider: config.agentB.address,
      amountUstx: config.paymentAmount,
      status: "pending",
      requestHash: "0".repeat(64),
      resultHash: "0".repeat(64),
      createdAt: 0,
    };
  }

  const result = await callReadOnlyFunction({
    contractAddress: config.contract.address,
    contractName: "agentpay-escrow",
    functionName: "get-escrow",
    functionArgs: [uintCV(jobId)],
    senderAddress: config.agentA.address,
    network: config.network,
  });

  // cvToValue returns: { value: { value: { field: { value: ... } } } }
  // (response (optional (tuple ...))) -- need to unwrap response then optional
  const outer = cvToValue(result);
  if (!outer?.value?.value) return null;

  const escrow = outer.value.value;
  return {
    jobId,
    requester: escrow.requester.value,
    provider: escrow.provider.value,
    amountUstx: Number(escrow.amount.value),
    status: escrow.status.value,
    requestHash: String(escrow["request-hash"].value).replace(/^0x/, ""),
    resultHash: String(escrow["result-hash"].value).replace(/^0x/, ""),
    createdAt: Number(escrow["created-at"].value),
  };
}

// Poll the Stacks API for transaction confirmation, then extract the job ID
// from the contract's return value: (ok u<job-id>)
async function pollForJobId(txId: string): Promise<number> {
  const apiUrl = `${config.network.coreApiUrl}/extended/v1/tx/${txId}`;
  const maxAttempts = 30;
  const pollInterval = 5000;

  console.log(`[Paygent] Polling for tx confirmation: ${txId}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      const res = await fetch(apiUrl);
      const tx: any = await res.json();

      if (tx.tx_status === "success") {
        const match = tx.tx_result?.repr?.match(/\(ok u(\d+)\)/);
        if (match) {
          const jobId = parseInt(match[1], 10);
          console.log(`[Paygent] Tx confirmed in ${attempt * 5}s. Job ID: ${jobId}`);
          return jobId;
        }
        // Fallback: read job counter if repr format is unexpected
        console.log("[Paygent] Tx confirmed but couldn't parse job ID from result, reading job counter...");
        const result = await callReadOnlyFunction({
          contractAddress: config.contract.address,
          contractName: "agentpay-escrow",
          functionName: "get-job-count",
          functionArgs: [],
          senderAddress: config.agentA.address,
          network: config.network,
        });
        return Number(cvToValue(result).value);
      }

      if (tx.tx_status === "abort_by_response" || tx.tx_status === "abort_by_post_condition") {
        throw new Error(`Transaction failed: ${tx.tx_status} -- ${tx.tx_result?.repr}`);
      }

      console.log(`[Paygent] Waiting for confirmation... (${attempt * 5}s)`);
    } catch (err: any) {
      if (err.message?.startsWith("Transaction failed")) throw err;
    }
  }

  throw new Error(`Transaction ${txId} did not confirm within ${maxAttempts * pollInterval / 1000}s`);
}
