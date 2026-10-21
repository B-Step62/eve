import { HookNotFoundError, WorkflowRunNotFoundError } from "#compiled/@workflow/errors/index.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";
import { getRun, resumeHook } from "#internal/workflow/runtime.js";
import { createLogger, logError } from "#internal/logging.js";

const log = createLogger("execution.agent-sessions.late-retirement");

export interface LateRetirementInput {
  readonly sessionId: string;
  readonly reason: string;
  readonly deliveryId: string;
}

export async function tryRetireLateAgentSessionStep(input: LateRetirementInput): Promise<boolean> {
  "use step";

  try {
    const status = await getRun(input.sessionId).status;
    if (status !== "pending" && status !== "running") return true;
    await resumeHook(sessionInboxHookToken(sessionCommandHookToken(input.sessionId)), {
      kind: "reset",
      reason: input.reason,
      deliveryId: input.deliveryId,
    });
    return true;
  } catch (error) {
    // A just-started run can precede its persisted record; absence is not terminality.
    if (WorkflowRunNotFoundError.is(error)) return false;
    if (HookNotFoundError.is(error)) return false;
    logError(log, "could not probe late child for retirement; retrying", error, {
      sessionId: input.sessionId,
    });
    return false;
  }
}

export async function reportLateAgentSessionRetirementFailureStep(
  sessionId: string,
): Promise<void> {
  "use step";
  log.error(
    "late child could not be retired after 60 durable attempts; inspect its run and session inbox",
    {
      sessionId,
    },
  );
}
