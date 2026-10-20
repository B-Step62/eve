// TypeScript view of the kernel contract in crates/kernel/src/types.rs.

export type Replay = "safe" | "never";

export interface ToolDescriptor {
  name: string;
  description: string;
  read_only: boolean;
  replay: Replay;
}

export interface SessionConfig {
  system: string;
  tools: ToolDescriptor[];
  step_limit: number;
}

export type Input =
  | { type: "prompt"; id: string; text: string }
  | { type: "steer"; id: string; text: string }
  | { type: "cancel"; id: string }
  | { type: "effect_result"; key: string; result: EffectResult };

export type EffectResult =
  | { status: "completed"; output: unknown }
  | { status: "failed"; error: string; evidence?: unknown }
  | { status: "interrupted"; reason: "cancelled" | "crashed"; partial?: unknown };

export type Message =
  | { role: "user"; text: string }
  | { role: "steering"; text: string }
  | { role: "assistant"; text: string; tool_calls: ToolCall[]; partial: boolean }
  | { role: "tool"; call_id: string; name: string; content: string; is_error: boolean };

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ModelRequest {
  system: string;
  messages: Message[];
  tools: { name: string; description: string }[];
}

export type Effect =
  | { kind: "model_call"; purpose: "agent"; request: ModelRequest }
  | { kind: "tool_call"; call_id: string; name: string; input: Record<string, unknown> }
  | { kind: "wait"; ms: number; reason: string };

export interface EffectRequest {
  key: string;
  replay: Replay;
  after: string[];
  effect: Effect;
}

export type Command = { type: "cancel"; key: string };

export type KernelEvent = { type: string; [field: string]: unknown };

export interface Output {
  effects: EffectRequest[];
  commands: Command[];
  events: KernelEvent[];
}

export interface KernelState {
  v: number;
  history: Message[];
  turn: unknown;
  queued: unknown[];
  [field: string]: unknown;
}

export interface Advanced extends Output {
  state: KernelState;
}

export function isIdle(state: KernelState): boolean {
  return state.turn === null && state.queued.length === 0;
}
