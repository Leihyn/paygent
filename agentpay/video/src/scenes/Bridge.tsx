import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../constants";
import { INTER } from "../fonts";
import { Logo } from "../Logo";

interface ValuePropProps {
  label: string;
  text: string;
  frame: number;
  fps: number;
  delay: number;
}

const ValueProp: React.FC<ValuePropProps> = ({
  label,
  text,
  frame,
  fps,
  delay,
}) => {
  const propFrame = Math.max(0, frame - delay);
  const s = spring({
    frame: propFrame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 150 },
  });
  const translateX = interpolate(s, [0, 1], [30, 0]);

  return (
    <div
      style={{
        opacity: s,
        transform: `translateX(${translateX}px)`,
        borderLeft: `4px solid ${COLORS.green}`,
        paddingLeft: 28,
        marginBottom: 60,
      }}
    >
      <div
        style={{
          fontFamily: INTER,
          fontSize: 14,
          fontWeight: 700,
          color: COLORS.green,
          letterSpacing: 2,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: INTER,
          fontSize: 32,
          fontWeight: 500,
          color: COLORS.white,
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Bridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        justifyContent: "center",
        padding: "0 160px",
      }}
    >
      <ValueProp
        label="x402 INTEGRATION"
        text="HTTP 402 Payment Required. Native on Stacks."
        frame={frame}
        fps={fps}
        delay={0}
      />
      <ValueProp
        label="sBTC ESCROW"
        text="Pay with any SIP-010 token. sBTC, USDCx, anything."
        frame={frame}
        fps={fps}
        delay={100}
      />
      <ValueProp
        label="ON-CHAIN VERIFICATION"
        text="Clarity smart contracts verify delivery with secp256k1."
        frame={frame}
        fps={fps}
        delay={200}
      />
      <Logo />
    </AbsoluteFill>
  );
};
