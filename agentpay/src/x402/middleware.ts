// Express middleware that gates endpoints behind HTTP 402 payment.
//
// Without a valid X-PAYMENT header, the server returns 402 with payment
// instructions. The client signs a payment, retries, and gets the resource.

import { Request, Response, NextFunction } from "express";
import { X402Config, X402PaymentRequired } from "./types";

export function x402Paywall(config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // No payment header — tell the client what to pay.
    if (!paymentHeader) {
      const instructions: X402PaymentRequired = {
        version: "x402-v1",
        price: config.price,
        tokenSymbol: config.tokenSymbol,
        payTo: config.payTo,
        network: config.network,
        description: config.description,
        mimeType: "application/json",
      };

      const encoded = Buffer.from(JSON.stringify(instructions)).toString("base64");
      res.setHeader("X-PAYMENT-REQUIRED", encoded);
      res.status(402).json(instructions);
      return;
    }

    // Payment header present — verify it.
    try {
      const result = await config.verifyPayment(paymentHeader);

      if (!result.valid) {
        const instructions: X402PaymentRequired = {
          version: "x402-v1",
          price: config.price,
          tokenSymbol: config.tokenSymbol,
          payTo: config.payTo,
          network: config.network,
          description: config.description,
          mimeType: "application/json",
        };

        const encoded = Buffer.from(JSON.stringify(instructions)).toString("base64");
        res.setHeader("X-PAYMENT-REQUIRED", encoded);
        res.status(402).json({
          error: result.error || "Payment verification failed",
          ...instructions,
        });
        return;
      }

      // Valid payment — attach proof to response and continue.
      res.setHeader(
        "X-PAYMENT-RESPONSE",
        Buffer.from(JSON.stringify({
          valid: true,
          payer: result.payer,
          txId: result.txId,
        })).toString("base64")
      );

      next();
    } catch (err: any) {
      res.status(500).json({ error: `Payment verification error: ${err.message}` });
    }
  };
}
