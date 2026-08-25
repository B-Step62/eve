import type { JsonObject, JsonValue } from "#shared/json.js";
import type { DurableSessionState } from "#execution/durable-session-store.js";
import type { RuntimeToolResultActionResult } from "#shared/action-types.js";

export interface CodeModeRunInput {
  readonly callId: string;
  readonly hookToken: string;
  readonly input: JsonObject;
  readonly mode: "eager" | "lazy";
  readonly nodeId?: string;
  readonly parentInboxToken: string;
  readonly parentSessionId: string;
  readonly parentTurnId: string;
  readonly serializedContext: Record<string, unknown>;
  readonly stepIndex: number;
  readonly toolNames: readonly string[];
}

export type CodeModeRunOutcome =
  | { readonly status: "completed"; readonly output: JsonValue }
  | {
      readonly status: "failed";
      readonly code: "CODE_MODE_EXECUTION_FAILED" | "CODE_MODE_EXECUTION_LOST";
      readonly message: string;
      readonly partialEffectsPossible: boolean;
      readonly retryable: false;
    };

export interface CodeModeRunMessage {
  readonly callId: string;
  readonly kind: "code-mode-outcome";
  readonly outcome: CodeModeRunOutcome;
  readonly runId: string;
}

export interface CodeModeRunReady {
  readonly kind: "ready";
  readonly sessionState: DurableSessionState;
}

export interface CodeModeRunResultPayload {
  readonly kind: "code-mode-result";
  readonly result: RuntimeToolResultActionResult;
  readonly sessionState: DurableSessionState;
}
