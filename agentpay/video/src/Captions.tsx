import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { INTER } from "./fonts";

const captions = [
  { start: 0.5, end: 8.5, text: "AI agents will transact billions of dollars. Today, they have no way to pay each other without a middleman." },
  { start: 10.5, end: 21, text: "Traditional payments need trusted intermediaries, API keys, and human approval. Paygent replaces all of that with trustless escrow on Stacks." },
  { start: 19, end: 33, text: "x402 protocol for pay-per-request APIs. SIP-010 escrow for any token, including sBTC. On-chain verification via Clarity." },
  { start: 31, end: 39, text: "Agent A requests yield advice and gets HTTP 402 \u2014 payment required." },
  { start: 42, end: 48.5, text: "Agent A locks 50 mock sBTC in a Clarity escrow contract on Stacks testnet." },
  { start: 52, end: 59, text: "Agent B verifies the escrow on-chain, then fetches live DeFi yield data from three protocols." },
  { start: 65, end: 72.5, text: "Agent B signs the recommendation with secp256k1 and submits the proof to the smart contract." },
  { start: 78, end: 86, text: "The contract verifies the signature on-chain and releases payment. Trustless settlement, no intermediaries." },
  { start: 104, end: 114, text: "Three lines to add x402 to any Stacks API. One config change for mainnet sBTC. This is Paygent." },
];

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  const active = captions.find(c => timeSec >= c.start && timeSec <= c.end);
  if (!active) return null;

  const fadeIn = interpolate(timeSec, [active.start, active.start + 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(timeSec, [active.end - 0.3, active.end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 200,
        opacity: fadeIn * fadeOut,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          padding: "10px 28px",
          borderRadius: 8,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: INTER,
            fontSize: 20,
            fontWeight: 500,
            color: "#fafafa",
            lineHeight: 1.5,
          }}
        >
          {active.text}
        </span>
      </div>
    </div>
  );
};
