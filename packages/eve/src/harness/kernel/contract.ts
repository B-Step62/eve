// EXPERIMENTAL (kernel-spike): the Rust kernel's contract, as eve sees it.
// See packages/kernel-spike and research/fx-kernel-convergence.md. Nothing in
// eve uses this unless a session sets the `eve.kernelMode` context key.

/** Every effect may run again after a crash (eve's rule). */
export type KernelReplay = "safe";

/** `host`: an eve policy function decides, through `policy_decide`. */
export type KernelApproval = "never" | "always" | "once" | "auto" | "host";

export interface KernelToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly approval: KernelApproval;
}

export interface KernelSessionConfig {
  readonly system: string;
  readonly tools: readonly KernelToolDescriptor[];
  readonly step_limit: number;
  readonly compaction?: {
    readonly context_window_tokens: number;
    readonly threshold_percent: number;
    readonly recent_messages: number;
  };
}

export type KernelEffectResult =
  | { readonly status: "completed"; readonly output: unknown }
  | { readonly status: "failed"; readonly error: string; readonly retryable?: boolean }
  | {
      readonly status: "interrupted";
      readonly reason: "cancelled" | "crashed";
      readonly partial?: unknown;
    };

export type KernelInput =
  | { readonly type: "prompt"; readonly id: string; readonly text: string }
  | { readonly type: "effect_result"; readonly key: string; readonly result: KernelEffectResult };

export type KernelMessage =
  | { readonly role: "user" | "steering"; readonly text: string }
  | {
      readonly role: "assistant";
      readonly text: string;
      readonly tool_calls: readonly KernelToolCall[];
      readonly partial: boolean;
    }
  | {
      readonly role: "tool";
      readonly call_id: string;
      readonly name: string;
      readonly content: string;
      readonly is_error: boolean;
    };

export interface KernelToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export type KernelModelPurpose = "agent" | "permission_review" | "compaction";

export interface KernelToolInvocation {
  readonly call_id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export type KernelEffect =
  | {
      readonly kind: "model_call";
      readonly purpose: KernelModelPurpose;
      readonly model?: string | null;
      readonly request: {
        readonly system: string;
        readonly messages: readonly KernelMessage[];
        readonly tools: readonly { readonly name: string; readonly description: string }[];
      };
    }
  | ({ readonly kind: "tool_call" } & KernelToolInvocation)
  | ({ readonly kind: "policy_decide" } & KernelToolInvocation)
  | {
      readonly kind: "user_ask";
      readonly request: {
        readonly kind: "approval";
        readonly reason: string;
      } & KernelToolInvocation;
    }
  | { readonly kind: "blob_put"; readonly name: string; readonly content: string }
  | { readonly kind: "wait"; readonly ms: number };

export interface KernelEffectRequest {
  readonly key: string;
  readonly replay: KernelReplay;
  readonly after: readonly string[];
  readonly effect: KernelEffect;
}

export interface KernelEvent {
  readonly type: string;
  readonly [field: string]: unknown;
}

export interface KernelState {
  readonly turn: unknown;
  readonly queued: readonly unknown[];
  readonly [field: string]: unknown;
}

export interface KernelAdvanced {
  readonly state: KernelState;
  readonly effects: readonly KernelEffectRequest[];
  readonly events: readonly KernelEvent[];
}

/** Either build of the kernel: JSON in, JSON out. */
export interface KernelBinding {
  open(config: KernelSessionConfig): KernelState;
  advance(state: KernelState, inputs: readonly KernelInput[]): KernelAdvanced;
}

export type KernelMode = "native" | "wasm";

/** What the workflow sends one turn step in `wasm` mode. */
export interface KernelStepInput {
  /** The workflow has no kernel config yet: report it, run nothing. */
  readonly describe?: boolean;
  readonly effects?: readonly KernelEffectRequest[];
  /** The kernel ended the turn with this reply. */
  readonly finish?: { readonly text: string };
}

/** What one turn step reports back in `wasm` mode. */
export interface KernelStepOutput {
  readonly config?: KernelSessionConfig;
  readonly results: readonly { readonly key: string; readonly result: KernelEffectResult }[];
}

export function kernelTurnEnded(events: readonly KernelEvent[]): KernelEvent | undefined {
  return events.find((e) => e.type === "turn_ended");
}

/** Effects that may start now: their `after` keys are no longer open. */
export function readyEffects(open: readonly KernelEffectRequest[]): KernelEffectRequest[] {
  const keys = new Set(open.map((e) => e.key));
  return open.filter((e) => e.after.every((k) => !keys.has(k)));
}

export function lastAssistantText(state: KernelState): string {
  const history = (state.history ?? []) as readonly { role: string; text?: string }[];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]!;
    if (m.role === "assistant") return m.text ?? "";
  }
  return "";
}
