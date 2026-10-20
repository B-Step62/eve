import type { SessionContext } from "#context/session-context.js";
import type { AuthorizationResult, AuthorizationSignal } from "#harness/authorization.js";

export type WorkflowStepAuthorizationResult = AuthorizationResult & {
  readonly attemptId: string;
  readonly name: string;
};

export interface WorkflowStepContext {
  readonly callId: string;
  readonly toolName: string;
  readonly session: SessionContext["session"];
  readonly abortSignal: AbortSignal;
  readonly baseUrl: string;
  readonly token: string;
  readonly authorizationResults: readonly WorkflowStepAuthorizationResult[];
}

export type WorkflowStepResult = { readonly authorized: readonly string[] } & (
  | { readonly kind: "result"; readonly output: unknown }
  | { readonly kind: "authorization-required"; readonly signal: AuthorizationSignal }
  /**
   * A `retryable: false` authorization failure, returned rather than thrown: a thrown error
   * reaches the workflow body without the `reason`, `retryable` and sign-in the session records.
   */
  | {
      readonly kind: "authorization-failed";
      readonly connectionName: string;
      readonly message: string;
      readonly reason?: string;
      /** The sign-in whose completion or token raised the failure. */
      readonly signIn?: string;
    }
);

/** Compiler-owned envelope; contextIndexes marks arguments replaced with step-local context. */
export interface WorkflowStepInvocation {
  readonly args: readonly unknown[];
  readonly context: WorkflowStepContext;
  readonly contextIndexes: readonly number[];
}
