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

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: frames 0-150
  const phase1Spring = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 160 },
  });
  const phase1Scale = interpolate(phase1Spring, [0, 1], [0.93, 1]);
  const phase1Opacity = phase1Spring;
  const phase1FadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: frames 150-300
  const phase2Frame = Math.max(0, frame - 150);
  const phase2Spring = spring({
    frame: phase2Frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 18, stiffness: 160 },
  });
  const phase2Scale = interpolate(phase2Spring, [0, 1], [0.93, 1]);
  const phase2Opacity = phase2Spring;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, #18181b 0%, ${COLORS.bg} 70%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Logo />
      {/* Phase 1 */}
      {frame < 150 && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            opacity: phase1Opacity * phase1FadeOut,
            transform: `scale(${phase1Scale})`,
          }}
        >
          <p
            style={{
              fontFamily: INTER,
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.white,
              textAlign: "center",
              lineHeight: 1.3,
              padding: "0 60px",
              margin: 0,
            }}
          >
            AI agents will transact
            <br />
            billions of dollars.
          </p>
        </div>
      )}

      {/* Phase 2 */}
      {frame >= 150 && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            opacity: phase2Opacity,
            transform: `scale(${phase2Scale})`,
          }}
        >
          <p
            style={{
              fontFamily: INTER,
              fontSize: 44,
              fontWeight: 500,
              color: COLORS.muted,
              textAlign: "center",
              lineHeight: 1.4,
              padding: "0 60px",
              margin: 0,
            }}
          >
            Today, they have no way to pay
            <br />
            each other without a middleman.
          </p>
          <p
            style={{
              fontFamily: INTER,
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.green,
              textAlign: "center",
              marginTop: 30,
            }}
          >
            No API keys. No credit cards. No humans.
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
