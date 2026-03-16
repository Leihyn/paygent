// Verifies x402 payment proofs by checking the on-chain escrow.
//
// The X-PAYMENT header is a base64-encoded JSON object containing the
// escrow transaction ID, job ID, and payer address. This module decodes
// it and validates the escrow state against the required price.

import { getEscrow } from "../contract/escrow";
import { X402Payment, X402VerifyResult } from "./types";

export function createX402Verifier(config: {
  requiredPrice: number;
  payTo: string;
}): (paymentHeader: string) => Promise<X402VerifyResult> {
  return async (paymentHeader: string): Promise<X402VerifyResult> => {
    // Decode and parse the payment proof.
    let payment: X402Payment;
    try {
      const decoded = Buffer.from(paymentHeader, "base64").toString("utf-8");
      payment = JSON.parse(decoded);
    } catch {
      return { valid: false, error: "Malformed X-PAYMENT header: invalid base64 or JSON" };
    }

    if (payment.version !== "x402-v1") {
      return { valid: false, error: `Unsupported x402 version: ${payment.version}` };
    }

    if (typeof payment.jobId !== "number" || !payment.payer || !payment.escrowTxId) {
      return { valid: false, error: "Missing required fields: jobId, payer, escrowTxId" };
    }

    // Look up the escrow on-chain.
    let escrow;
    try {
      escrow = await getEscrow(payment.jobId);
    } catch (err: any) {
      return { valid: false, error: `Failed to fetch escrow: ${err.message}` };
    }

    if (!escrow) {
      return { valid: false, error: `Escrow #${payment.jobId} not found` };
    }

    if (escrow.status !== "pending") {
      return { valid: false, error: `Escrow #${payment.jobId} is ${escrow.status}, not pending` };
    }

    if (escrow.amountUstx < config.requiredPrice) {
      return {
        valid: false,
        error: `Escrow amount ${escrow.amountUstx} is less than required ${config.requiredPrice}`,
      };
    }

    if (escrow.requester !== payment.payer) {
      return {
        valid: false,
        error: `Payer mismatch: header says ${payment.payer}, escrow says ${escrow.requester}`,
      };
    }

    if (escrow.provider !== config.payTo) {
      return {
        valid: false,
        error: `Escrow provider ${escrow.provider} does not match payTo ${config.payTo}`,
      };
    }

    return {
      valid: true,
      payer: payment.payer,
      amount: escrow.amountUstx,
      txId: payment.escrowTxId,
    };
  };
}
