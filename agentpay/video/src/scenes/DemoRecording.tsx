import React from "react";
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  staticFile,
} from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";
import { Logo } from "../Logo";

interface CalloutProps {
  text: string;
  startFrame: number;
  borderColor: string;
  frame: number;
  fps: number;
}

const Callout: React.FC<CalloutProps> = ({
  text,
  startFrame,
  borderColor,
  frame,
  fps,
}) => {
  const duration = 150;
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const enterSpring = spring({
    frame: localFrame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 16, stiffness: 140 },
  });
  const exitOpacity = interpolate(localFrame, [duration - 25, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(enterSpring, [0, 1], [0.93, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 80,
        transform: `scale(${scale})`,
        opacity: enterSpring * exitOpacity,
        background: "rgba(9, 9, 11, 0.88)",
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        padding: "14px 24px",
        backdropFilter: "blur(8px)",
        zIndex: 20,
      }}
    >
      <div
        style={{
          fontFamily: INTER,
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.white,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const DemoRecording: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Full screen recording — plays from start */}
      <Video
        src={staticFile("demo-recording.mp4")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Top gradient for readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: `linear-gradient(to bottom, rgba(9,9,11,0.6), transparent)`,
          zIndex: 10,
        }}
      />

      {/* Bottom gradient */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: `linear-gradient(to top, rgba(9,9,11,0.6), transparent)`,
          zIndex: 10,
        }}
      />

      {/* Callouts at key moments */}
      <Callout
        text="HTTP 402 Payment Required"
        startFrame={180}
        borderColor={COLORS.amber}
        frame={frame}
        fps={fps}
      />
      <Callout
        text="SIP-010 Escrow Created"
        startFrame={480}
        borderColor={COLORS.cyan}
        frame={frame}
        fps={fps}
      />
      <Callout
        text="Agent B Verifying On-Chain"
        startFrame={750}
        borderColor={COLORS.green}
        frame={frame}
        fps={fps}
      />
      <Callout
        text="secp256k1-verify PASSED"
        startFrame={1200}
        borderColor={COLORS.green}
        frame={frame}
        fps={fps}
      />
      <Callout
        text="Payment Released"
        startFrame={1650}
        borderColor={COLORS.green}
        frame={frame}
        fps={fps}
      />

      {/* Bottom-left label */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          fontFamily: MONO,
          fontSize: 13,
          fontWeight: 500,
          color: COLORS.green,
          letterSpacing: 1,
          opacity: 0.8,
          zIndex: 15,
        }}
      >
        REAL TESTNET TRANSACTION
      </div>

      <Logo />
    </AbsoluteFill>
  );
};
