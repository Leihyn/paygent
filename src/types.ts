export interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;               // decimal, e.g. 0.087 = 8.7%
  tvl: number;               // total value locked in USD
  riskLevel: "low" | "medium" | "high";
  depositAddress: string;    // Stacks principal
  url: string;               // protocol URL
}

export interface YieldRecommendation {
  jobId: number;
  agentBAddress: string;
  recommendation: YieldOpportunity;
  alternatives: YieldOpportunity[];
  reasoning: string;
  timestamp: number;          // unix ms
  resultHash: string;         // hex: sha256 of the signed payload
  signature: string;          // hex: 65-byte secp256k1 recoverable signature
}

export interface EscrowJob {
  jobId: number;
  requester: string;
  provider: string;
  amountUstx: number;
  status: "pending" | "completed" | "refunded";
  requestHash: string;
  resultHash: string;
  createdAt: number;
}

export interface AgentRequest {
  jobId: number;
  question: string;
  agentAAddress: string;
  agentBAddress: string;
  paymentTxId: string;
}
