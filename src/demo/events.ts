// Event bus for the demo frontend.
// The demo flow emits structured events here; the SSE endpoint forwards them to the browser.

import { EventEmitter } from "events";
import { YieldOpportunity } from "../types";

// ─── Event types ───

export interface LogEvent {
  type: "log";
  source: "AGENT_A" | "AGENT_B" | "CONTRACT" | "YIELD" | "SYSTEM";
  message: string;
  timestamp: number;
}

export interface YieldDataEvent {
  type: "yield-data";
  yields: YieldOpportunity[];
  timestamp: number;
}

export interface SignatureEvent {
  type: "signature";
  resultHash: string;
  signature: string;
  publicKey: string;
  timestamp: number;
}

export interface EscrowStateEvent {
  type: "escrow-state";
  status: string;
  jobId?: number;
  txId?: string;
  amount?: number;
  timestamp: number;
}

export interface DemoCompleteEvent {
  type: "demo-complete";
  duration: number;
  timestamp: number;
}

export interface DemoErrorEvent {
  type: "demo-error";
  message: string;
  timestamp: number;
}

export type DemoEvent =
  | LogEvent
  | YieldDataEvent
  | SignatureEvent
  | EscrowStateEvent
  | DemoCompleteEvent
  | DemoErrorEvent;

// ─── Singleton event bus ───

export const demoEvents = new EventEmitter();
demoEvents.setMaxListeners(50);

export function emitLog(
  source: LogEvent["source"],
  message: string
): void {
  const event: LogEvent = {
    type: "log",
    source,
    message,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}

export function emitYieldData(yields: YieldOpportunity[]): void {
  const event: YieldDataEvent = {
    type: "yield-data",
    yields,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}

export function emitSignature(
  resultHash: string,
  signature: string,
  publicKey: string
): void {
  const event: SignatureEvent = {
    type: "signature",
    resultHash,
    signature,
    publicKey,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}

export function emitEscrowState(
  status: string,
  extra?: { jobId?: number; txId?: string; amount?: number }
): void {
  const event: EscrowStateEvent = {
    type: "escrow-state",
    status,
    ...extra,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}

export function emitDemoComplete(duration: number): void {
  const event: DemoCompleteEvent = {
    type: "demo-complete",
    duration,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}

export function emitDemoError(message: string): void {
  const event: DemoErrorEvent = {
    type: "demo-error",
    message,
    timestamp: Date.now(),
  };
  demoEvents.emit("demo-event", event);
}
