// x402 protocol types for HTTP 402 pay-per-request flows.

export interface X402PaymentRequired {
  version: "x402-v1";
  price: number;
  tokenSymbol: string;
  payTo: string;
  network: string;
  description: string;
  mimeType: string;
}

export interface X402Payment {
  version: "x402-v1";
  escrowTxId: string;
  jobId: number;
  payer: string;
  signature: string;
}

export interface X402VerifyResult {
  valid: boolean;
  payer?: string;
  amount?: number;
  txId?: string;
  error?: string;
}

export interface X402Config {
  price: number;
  tokenSymbol: string;
  payTo: string;
  network: string;
  description: string;
  verifyPayment: (paymentHeader: string) => Promise<X402VerifyResult>;
}

export interface X402ClientConfig {
  agentBPublicKey: string;
}
