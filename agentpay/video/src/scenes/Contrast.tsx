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

const leftItems = [
  "Trusted intermediaries",
  "API keys + credit cards",
  "Human approval required",
  "Hours to settle",
];

const rightItems = [
  "Trustless escrow",
  "HTTP 402 + secp256k1",
  "Fully autonomous",
  "Seconds to settle",
];

const ListItem: React.FC<{
  text: string;
  frame: number;
  fps: number;
  delay: number;
  color: string;
}> = ({ text, frame, fps, delay, color }) => {
  const itemFrame = Math.max(0, frame - delay);
  const s = spring({
    frame: itemFrame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 160 },
  });
  const scale = interpolate(s, [0, 1], [0.93, 1]);

  return (
    <div
      style={{
        opacity: s,
        transform: `scale(${scale}) translateY(${interpolate(s, [0, 1], [15, 0])}px)`,
        fontFamily: INTER,
        fontSize: 28,
        fontWeight: 500,
        color,
        marginBottom: 28,
      }}
    >
      {text}
    </div>
  );
};

export const Contrast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dividerOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 120px",
      }}
    >
      {/* Left side: TODAY */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          paddingRight: 60,
        }}
      >
        <div
          style={{
            fontFamily: INTER,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.red,
            letterSpacing: 3,
            marginBottom: 40,
            opacity: interpolate(frame, [0, 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          TODAY
        </div>
        {leftItems.map((item, i) => (
          <ListItem
            key={item}
            text={item}
            frame={frame}
            fps={fps}
            delay={20 + i * 8}
            color={COLORS.offWhite}
          />
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          width: 2,
          height: 320,
          backgroundColor: COLORS.green,
          opacity: dividerOpacity,
          boxShadow: `0 0 20px ${COLORS.greenGlow}`,
        }}
      />

      {/* Right side: PAYGENT */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          paddingLeft: 60,
        }}
      >
        <div
          style={{
            fontFamily: INTER,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.green,
            letterSpacing: 3,
            marginBottom: 40,
            opacity: interpolate(frame, [0, 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          PAYGENT
        </div>
        {rightItems.map((item, i) => (
          <ListItem
            key={item}
            text={item}
            frame={frame}
            fps={fps}
            delay={60 + i * 8}
            color={COLORS.green}
          />
        ))}
      </div>
      <Logo />
    </AbsoluteFill>
  );
};
