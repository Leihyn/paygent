import React from "react";
import { staticFile } from "remotion";

export const Logo: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 28,
      left: 28,
      width: 52,
      height: 52,
      borderRadius: 10,
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      overflow: "hidden",
    }}
  >
    <img
      src={staticFile("logo.png")}
      style={{
        width: 44,
        height: 44,
        objectFit: "contain",
      }}
    />
  </div>
);
