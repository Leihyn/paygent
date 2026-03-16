import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { COLORS } from "./constants";
import { Hook } from "./scenes/Hook";
import { Contrast } from "./scenes/Contrast";
import { Bridge } from "./scenes/Bridge";
import { DemoRecording } from "./scenes/DemoRecording";
import { Close } from "./scenes/Close";
import { Captions } from "./Captions";

//    0 -  300  ( 0:00 - 0:10)  Hook
//  300 -  540  ( 0:10 - 0:18)  Contrast
//  540 -  900  ( 0:18 - 0:30)  Bridge (value props)
//  900 - 3115  ( 0:30 - 1:43)  Demo Recording (73.8s = 2215 frames)
// 3115 - 3415  ( 1:43 - 1:53)  Close
// TOTAL: 3415 frames = 113.8 seconds

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg }}>
    {/* Scenes */}
    <Sequence from={0} durationInFrames={300}><Hook /></Sequence>
    <Sequence from={300} durationInFrames={240}><Contrast /></Sequence>
    <Sequence from={540} durationInFrames={360}><Bridge /></Sequence>
    <Sequence from={900} durationInFrames={2215}><DemoRecording /></Sequence>
    <Sequence from={3115} durationInFrames={300}><Close /></Sequence>

    {/* Voiceover narration — plays across entire video */}
    <Audio src={staticFile("voiceover.mp3")} volume={4} />

    {/* On-screen captions — renders on top of all scenes */}
    <Captions />
  </AbsoluteFill>
);
