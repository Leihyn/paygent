// x402 client: wraps HTTP requests with automatic 402 payment handling.
//
// 1. Makes the initial request
// 2. If the server returns 402, parses payment instructions
// 3. Creates an escrow on Stacks with the required amount
// 4. Retries with the X-PAYMENT header containing the payment proof

import axios from "axios";
import { createEscrow } from "../contract/escrow";
import { hashPayload } from "../contract/verify";
import { config } from "../config";
import { X402ClientConfig, X402Payment, X402PaymentRequired } from "./types";

export async function x402Fetch(
  url: string,
  options: { method?: string; data?: any; timeout?: number },
  clientConfig: X402ClientConfig
): Promise<{ status: number; data: any; paymentTxId?: string }> {
  const method = (options.method || "GET").toUpperCase();
  const timeout = options.timeout || 120000;

  // First request — may succeed or return 402.
  let firstResponse;
  try {
    firstResponse = await axios({
      url,
      method,
      data: options.data,
      timeout,
      validateStatus: () => true, // don't throw on non-2xx
    });
  } catch (err: any) {
    throw new Error(`x402 initial request failed: ${err.message}`);
  }

  // If not 402, return as-is.
  if (firstResponse.status !== 402) {
    return { status: firstResponse.status, data: firstResponse.data };
  }

  // Parse payment instructions from body or X-PAYMENT-REQUIRED header.
  let instructions: X402PaymentRequired;
  try {
    const headerVal = firstResponse.headers["x-payment-required"];
    if (headerVal) {
      instructions = JSON.parse(Buffer.from(headerVal, "base64").toString("utf-8"));
    } else {
      instructions = firstResponse.data as X402PaymentRequired;
    }
  } catch {
    throw new Error("x402: could not parse payment instructions from 402 response");
  }

  if (instructions.version !== "x402-v1") {
    throw new Error(`x402: unsupported version ${instructions.version}`);
  }

  console.log(
    `[x402] Payment required: ${instructions.price} ${instructions.tokenSymbol} to ${instructions.payTo}`
  );
  console.log(`[x402] Description: ${instructions.description}`);

  // Create escrow on Stacks.
  const requestPayload = { url, method, data: options.data };
  const requestHashHex = hashPayload(requestPayload).toString("hex");

  console.log("[x402] Creating escrow on Stacks...");
  const { txId, jobId } = await createEscrow(
    instructions.payTo,
    clientConfig.agentBPublicKey,
    instructions.price,
    requestHashHex
  );
  console.log(`[x402] Escrow created. Job ID: ${jobId}, TxID: ${txId}`);

  // Build payment proof.
  const payment: X402Payment = {
    version: "x402-v1",
    escrowTxId: txId,
    jobId,
    payer: config.agentA.address,
    signature: requestHashHex, // request hash as proof of intent
  };

  const paymentHeader = Buffer.from(JSON.stringify(payment)).toString("base64");

  // Retry with payment.
  console.log("[x402] Retrying request with payment proof...");
  let secondResponse;
  try {
    secondResponse = await axios({
      url,
      method,
      data: options.data,
      timeout,
      headers: { "X-PAYMENT": paymentHeader },
      validateStatus: () => true,
    });
  } catch (err: any) {
    throw new Error(`x402 paid request failed: ${err.message}`);
  }

  if (secondResponse.status === 402) {
    throw new Error("x402: payment was rejected after retry");
  }

  return {
    status: secondResponse.status,
    data: secondResponse.data,
    paymentTxId: txId,
  };
}
