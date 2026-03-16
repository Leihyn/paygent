# Paygent

**Trustless machine-to-machine payments for AI agents, settled on Bitcoin via Stacks.**

## The Problem

AI agents are about to transact billions of dollars autonomously. But today, every agent-to-agent payment requires a trusted intermediary — a centralized API key, a credit card on file, or a human approving each transaction.

Paygent eliminates the middleman. Agent A locks Bitcoin-backed funds in a Clarity smart contract. Agent B delivers a service and proves it cryptographically. The contract verifies the proof and releases payment. No humans in the loop. No trust required.

## How It Works

```
Agent A                    Stacks Contract                Agent B
  │                              │                           │
  │── create-escrow ───────────▶│                           │
  │   (50 uSTX + request hash)  │  funds locked             │
  │                              │                           │
  │── HTTP request (job #1) ────────────────────────────────▶│
  │                              │                           │
  │                              │      verifies escrow      │
  │                              │      fetches DeFi yields  │
  │                              │      signs recommendation │
  │                              │                           │
  │                              │◀── complete-escrow ───────│
  │                              │  secp256k1-verify ✓       │
  │                              │  payment released         │
  │                              │                           │
  │◀──────────────── signed recommendation ──────────────────│
```

**In the demo:** Agent A pays 50 microSTX for DeFi yield intelligence. Agent B verifies the escrow exists, fetches live data from Zest Protocol, Bitflow, and StackingDAO, signs its recommendation with secp256k1, and claims payment through the Clarity contract — all autonomously.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your wallet details (see Setup below)
npm run deploy       # Deploy contract to testnet
npm run demo         # Run full Agent A → Agent B flow (live on testnet)
npm run demo:offline # Run without blockchain calls (~2 seconds)
```

## Setup

### 1. Generate Wallets

```bash
npx ts-node generate-wallets.ts
```

Outputs mnemonics, private keys, and the compressed public key for Agent B. Import mnemonics into [Hiro Wallet](https://wallet.hiro.so/) and copy addresses into `.env`.

### 2. Fund Wallets

Get testnet STX from the [Hiro Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet). Agent A needs STX for escrow + gas. Agent B needs STX for gas only.

### 3. Deploy Contract

```bash
npm run deploy
```

Paste the output contract address into `.env`.

### 4. Run Demo

```bash
npm run demo          # Live on Stacks testnet (~60s)
npm run demo:offline  # No blockchain, instant (~2s)
```

## Architecture

```
src/
├── agents/
│   ├── agentA.ts          # Locks escrow, commits request hash, sends request
│   └── agentB.ts          # Validates escrow, fetches yields, signs, claims payment
├── contract/
│   ├── deploy.ts          # One-time contract deployment
│   ├── escrow.ts          # create/complete/refund + tx polling + post conditions
│   └── verify.ts          # Canonical hashing, secp256k1 signing, pubkey recovery
├── yield/
│   └── fetcher.ts         # DefiLlama API + mock fallback
├── config.ts              # Env var loader with validation
└── types.ts               # TypeScript interfaces

contracts/
└── agentpay-escrow.clar   # Clarity smart contract
```

### Smart Contract

The Clarity contract implements three operations:

- **`create-escrow`** — Agent A locks STX, registers Agent B's public key, and commits a request hash (SHA256 of the question) on-chain
- **`complete-escrow`** — Agent B submits a result hash + secp256k1 signature; the contract verifies on-chain with `secp256k1-verify` and releases funds atomically via `try!`
- **`refund-escrow`** — Agent A reclaims funds after 144 blocks (~24h) if Agent B never delivers

All STX transfers are wrapped with `try!` so payment failures abort the transaction rather than silently succeeding. Post conditions enforce exact amounts on the TypeScript side.

### Trust Model

- **Agent A never sees Agent B's private key.** Agent A only knows Agent B's compressed public key (33 bytes), which is registered in the escrow at creation time.
- **Agent B validates the escrow before doing work.** It checks on-chain that the escrow exists, is pending, lists Agent B as provider, and has sufficient payment.
- **The request hash commits to what Agent A is paying for.** Agent A hashes its question before creating the escrow, so there's on-chain evidence of the agreement.
- **Signature verification is on-chain.** The Clarity contract uses `secp256k1-verify` to confirm Agent B's signature — not an off-chain check.

### Yield Data

Live DeFi yields from [DefiLlama](https://defillama.com/)'s yield aggregator API, covering Stacks-native protocols. Mock fallback keeps the demo running if the API is unreachable.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run demo` | Full end-to-end flow on testnet |
| `npm run demo:offline` | Full flow without blockchain (~2s) |
| `npm run deploy` | Deploy contract to testnet |
| `npm run agent-b` | Start Agent B server standalone |
| `npm run agent-a` | Run Agent A request standalone |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests (24 tests) |
| `INTEGRATION=true npm test` | Include on-chain integration tests |

## Tech Stack

- **Smart Contracts:** Clarity on Stacks
- **Language:** TypeScript
- **Crypto:** @noble/secp256k1, @noble/hashes
- **Stacks SDK:** @stacks/transactions, @stacks/wallet-sdk, @stacks/network
- **Yield Data:** DefiLlama API
- **Agent Communication:** Express + Axios

## x402 Protocol Integration

Paygent implements the [x402 protocol](https://www.x402.org/) natively on Stacks. Agent B's API returns HTTP 402 with payment instructions. Agent A pays via SIP-010 escrow. The Clarity contract verifies delivery and releases payment.

**Server side (3 lines):**

```typescript
import { x402Paywall } from "agentpay/x402";

app.post("/api/data", x402Paywall({
  price: 50,
  tokenSymbol: "sBTC",
  payTo: "SP...your-address",
  network: "stacks-mainnet",
}), yourHandler);
```

**Client side (1 line):**

```typescript
const result = await x402Fetch("https://api.example.com/data");
// Handles 402 automatically: creates escrow, pays, retries, returns data
```

No Coinbase SDK needed. No EVM dependency. Settles directly on Stacks via Clarity.

## Mainnet Deployment

The testnet demo uses a mock sBTC token (`mock-sbtc`). On mainnet, change two env vars:

```env
TOKEN_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4
TOKEN_CONTRACT_NAME=sbtc-token
```

The escrow contract accepts any SIP-010 token via trait parameter. Zero code changes needed. The same contract that works with mock sBTC on testnet works with real sBTC on mainnet.

**Supported tokens:** sBTC, USDCx, or any SIP-010 fungible token deployed on Stacks.

## Contracts

| Contract | Testnet Address | Purpose |
|----------|----------------|---------|
| `sip-010-trait` | `ST2V4QE2...JPEJ` | SIP-010 fungible token trait |
| `mock-sbtc` | `ST2V4QE2...JPEJ` | Mock sBTC for testnet testing |
| `agentpay-escrow-v3` | `ST2V4QE2...JPEJ` | SIP-010 escrow with secp256k1 verification |
| `agentpay-escrow-v2` | `ST2V4QE2...JPEJ` | Original STX escrow (still works) |

## Troubleshooting

**"Broadcast failed: ConflictingNonceInMempool"**
A pending transaction has the same nonce. Wait for it to confirm or increase the fee.

**Transaction doesn't confirm**
Stacks testnet blocks take 10-40 seconds. Polling waits up to 2.5 minutes. If it times out, check [Stacks Explorer](https://explorer.hiro.so/?chain=testnet). For presentations, use `npm run demo:offline`.

**Yield data shows mock values**
DefiLlama API may be temporarily unreachable. Mock data is realistic — the demo still works. Check with `curl https://yields.llama.fi/pools | head`.

**"Missing required env var"**
Copy `.env.example` to `.env` and fill in all fields. Run `npx ts-node generate-wallets.ts` to generate new wallets.

**"AGENT_B_PRIVATE_KEY not configured"**
Agent B needs its private key to sign recommendations. Add it to `.env`.

## License

MIT
