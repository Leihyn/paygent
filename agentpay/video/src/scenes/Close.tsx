import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";
import { Logo } from "../Logo";

const CornerBracket: React.FC<{
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity: number;
}> = ({ position, opacity }) => {
  const size = 50;
  const thickness = 3;
  const offset = 60;

  const isTop = position.includes("top");
  const isLeft = position.includes("left");

  return (
    <div
      style={{
        position: "absolute",
        top: isTop ? offset : undefined,
        bottom: !isTop ? offset : undefined,
        left: isLeft ? offset : undefined,
        right: !isLeft ? offset : undefined,
        width: size,
        height: size,
        opacity,
        zIndex: 5,
      }}
    >
      {/* Horizontal line */}
      <div
        style={{
          position: "absolute",
          top: isTop ? 0 : undefined,
          bottom: !isTop ? 0 : undefined,
          left: isLeft ? 0 : undefined,
          right: !isLeft ? 0 : undefined,
          width: size,
          height: thickness,
          backgroundColor: COLORS.green,
        }}
      />
      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          top: isTop ? 0 : undefined,
          bottom: !isTop ? 0 : undefined,
          left: isLeft ? 0 : undefined,
          right: !isLeft ? 0 : undefined,
          width: thickness,
          height: size,
          backgroundColor: COLORS.green,
        }}
      />
    </div>
  );
};

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 entrance
  const mainSpring = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 160 },
  });
  const mainScale = interpolate(mainSpring, [0, 1], [0.93, 1]);

  // Corner brackets
  const bracketOpacity = interpolate(frame, [15, 40], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 entrance (frame 180+)
  const phase2Frame = Math.max(0, frame - 180);
  const phase2Spring = spring({
    frame: phase2Frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 150 },
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Corner brackets */}
      <CornerBracket position="top-left" opacity={bracketOpacity} />
      <CornerBracket position="top-right" opacity={bracketOpacity} />
      <CornerBracket position="bottom-left" opacity={bracketOpacity} />
      <CornerBracket position="bottom-right" opacity={bracketOpacity} />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: mainSpring,
          transform: `scale(${mainScale})`,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.green,
            letterSpacing: 8,
            marginBottom: 20,
          }}
        >
          PAYGENT
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 24,
            fontWeight: 500,
            color: COLORS.white,
            marginBottom: 12,
          }}
        >
          Trustless payments for the agent economy
        </div>
        <div
          style={{
            fontFamily: INTER,
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.muted,
            marginBottom: 50,
          }}
        >
          Built on Stacks. Secured by Bitcoin.
        </div>

        {/* Phase 2 additional text */}
        {frame >= 180 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              opacity: phase2Spring,
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: INTER,
                fontSize: 20,
                fontWeight: 500,
                color: COLORS.amber,
              }}
            >
              3 lines to add x402 to any Stacks API
            </div>
            <div
              style={{
                fontFamily: INTER,
                fontSize: 20,
                fontWeight: 500,
                color: COLORS.amber,
              }}
            >
              One env var change for mainnet sBTC
            </div>
          </div>
        )}
      </div>

      {/* Bottom hackathon text */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          fontFamily: INTER,
          fontSize: 14,
          fontWeight: 400,
          color: COLORS.muted,
          opacity: mainSpring * 0.7,
        }}
      >
        Stacks Hackathon 2026
      </div>
      <Logo />
    </AbsoluteFill>
  );
};
