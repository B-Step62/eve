import type { SessionTimeoutWorkflowInput } from "#execution/session/timeout-workflow.js";
import { getWorkflowMetadata } from "#compiled/@workflow/core/index.js";

import {
  cancelSessionTimeoutStep,
  startSessionTimeoutStep,
} from "#execution/session/timeout-steps.js";
import { sessionCommandHookToken } from "#execution/session-inbox/address.js";

/** Workflow-body handle that targets a durable deadline at the stable command inbox. */
export interface SessionTimeoutControl {
  adopt(runId: string): void;
  takeTurnInput(): SessionTimeoutWorkflowInput | undefined;
  dispose(): Promise<void>;
  start(): Promise<void>;
}

/** Creates a timer controller for one stable session command inbox. */
export function createSessionTimeoutControl(input: {
  readonly deadline: Date;
  readonly deferToTurn?: boolean;
  readonly sessionId: string;
}): SessionTimeoutControl {
  let active: { readonly runId: string } | undefined;
  let startup: Promise<void> | undefined;
  let issued = false;
  let pendingTurnInput: SessionTimeoutWorkflowInput | undefined;
  const timerInput = (): SessionTimeoutWorkflowInput => ({
    deadline: input.deadline,
    ownerRunId: getWorkflowMetadata().workflowRunId,
    token: sessionCommandHookToken(input.sessionId),
  });

  return {
    adopt(runId) {
      active = { runId };
    },

    takeTurnInput() {
      if (!input.deferToTurn || issued || active !== undefined) return undefined;
      issued = true;
      pendingTurnInput = timerInput();
      return pendingTurnInput;
    },

    async dispose(): Promise<void> {
      try {
        await startup;
      } catch {
        // A failed startup has no child run to cancel.
      }
      const current = active ?? pendingTurnInput;
      if (current === undefined) return;
      active = undefined;
      pendingTurnInput = undefined;
      await cancelSessionTimeoutStep(current);
    },

    async start(): Promise<void> {
      if (input.deferToTurn) return;
      startup ??= (async () => {
        active = await startSessionTimeoutStep(timerInput());
      })();
      await startup;
    },
  };
}
