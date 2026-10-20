// TypeScript view of the kernel contract in crates/kernel/src/types.rs.

/** `never`: a local host does not run the effect again after a crash (R2). */
export type Replay = "safe" | "never";

/** eve's tool approval policies. */
export type Approval = "never" | "always" | "once" | "auto";

export interface ToolDescriptor {
  name: string;
  description: string;
  approval?: Approval;
  replay?: Replay;
}

export interface SessionConfig {
  system: string;
  tools: ToolDescriptor[];
  step_limit: number;
  /** Ask the host's session policy before each tool call (fx). */
  host_policy?: boolean;
  /** What a review's caution does: ask a person (eve) or hold the action (fx). */
  caution?: "ask" | "hold";
  review?: { model?: string; instructions?: string };
  compaction?: {
    context_window_tokens?: number;
    threshold_percent?: number;
    recent_messages?: number;
    records?: boolean;
  };
}

export type Input =
  | { type: "prompt"; id: string; text: string }
  | { type: "steer"; id: string; text: string }
  | { type: "cancel"; id: string }
  | { type: "effect_result"; key: string; result: EffectResult };

export type EffectResult =
  | { status: "completed"; output: unknown }
  | { status: "failed"; error: string; retryable?: boolean }
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
  tools: { name: string; description: string; input_schema?: unknown }[];
}

export type ModelPurpose = "agent" | "permission_review" | "compaction";

export type Effect =
  | { kind: "model_call"; purpose: ModelPurpose; model?: string | null; request: ModelRequest }
  | { kind: "tool_call"; call_id: string; name: string; input: Record<string, unknown> }
  | { kind: "policy_decide"; call_id: string; name: string; input: Record<string, unknown> }
  | {
      kind: "user_ask";
      request: {
        kind: "approval";
        call_id: string;
        name: string;
        input: Record<string, unknown>;
        reason: string;
      };
    }
  | { kind: "blob_put"; name: string; content: string }
  | { kind: "wait"; ms: number; reason: string };

export interface EffectRequest {
  key: string;
  replay: Replay;
  after: string[];
  effect: Effect;
}

export type Command = { type: "cancel"; key: string };

export type KernelEvent = { type: string; [field: string]: unknown };

/** One record of the session log. Every host stores the same records. */
export interface Entry {
  seq: number;
  input: Input;
}

export interface Output {
  effects: EffectRequest[];
  commands: Command[];
  events: KernelEvent[];
  /** The inputs this call consumed, numbered: what the host appends to its log. */
  entries: Entry[];
}

export interface KernelState {
  v: number;
  /** The `seq` of the last log entry folded into this state. */
  seq: number;
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
