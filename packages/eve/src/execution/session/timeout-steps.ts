import { createHash } from "node:crypto";

import {
  EntityConflictError,
  HookNotFoundError,
  RunExpiredError,
  WorkflowRunNotFoundError,
} from "#compiled/@workflow/errors/index.js";

import {
  startWorkflowOnCurrentDeployment,
  sessionTimeoutWorkflowReference,
} from "#execution/workflow-runtime.js";
import type { SessionTimeoutWorkflowInput } from "#execution/session/timeout-workflow.js";
import { resumeSessionInbox } from "#execution/session-inbox/resume.js";
import { endStrandedSession } from "#execution/session-inbox/end-stranded-session.js";
import { StrandedSessionOwnerError } from "#execution/session-inbox/owner.js";
import { cancelRun, getWorld } from "#internal/workflow/runtime.js";
import { walkCauseChain } from "#shared/errors.js";

/** Starts the durable timer that signals one session deadline. */
export async function startSessionTimeoutStep(
  input: SessionTimeoutWorkflowInput,
): Promise<{ readonly runId: string }> {
  "use step";

  const run = await startWorkflowOnCurrentDeployment(sessionTimeoutWorkflowReference, [input]);
  return { runId: run.runId };
}

/** Starts a timer inside a turn step without creating another durable step. */
export async function startSessionTimeoutRun(
  input: SessionTimeoutWorkflowInput,
): Promise<{ readonly runId: string }> {
  const world = await getWorld();
  const timerWorld = new Proxy(world, {
    get(target, property) {
      if (property === "createRunId") return () => timeoutChildId(input);
      // Custom Worlds can use private fields in getters and instance methods.
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const run = await startWorkflowOnCurrentDeployment(sessionTimeoutWorkflowReference, [input], {
    world: timerWorld,
  });
  return { runId: run.runId };
}

/** Retries timer startup without repeating a successfully committed agent step. */
export async function retrySessionTimeoutStep(
  input: SessionTimeoutWorkflowInput,
): Promise<{ readonly runId: string }> {
  "use step";

  return await startSessionTimeoutRun(input);
}

function timeoutChildId(input: SessionTimeoutWorkflowInput): string {
  // Keep the timestamp and routing bits; retries replace only the random suffix.
  // A retry of the containing turn must target the same child run.
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const digest = createHash("sha256")
    .update(`${input.ownerRunId}:timeout:${input.deadline.toISOString()}`)
    .digest();
  let bits = BigInt(`0x${digest.subarray(0, 9).toString("hex")}`) & ((1n << 65n) - 1n);
  let suffix = "";
  for (let index = 0; index < 13; index++) {
    suffix = alphabet[Number(bits & 31n)] + suffix;
    bits >>= 5n;
  }
  return input.ownerRunId.slice(5, 18) + suffix;
}

/** Resumes the owning session when its durable timer elapses. */
export async function signalSessionTimeoutStep(input: {
  readonly ownerRunId: string;
  readonly token: string;
}): Promise<void> {
  "use step";

  try {
    await resumeSessionInbox(input.token, {
      kind: "session-timeout",
      ownerRunId: input.ownerRunId,
    });
  } catch (error) {
    if (error instanceof StrandedSessionOwnerError) {
      // A stranded owner another timer armed is that timer's to end.
      if (error.ownerRunId !== input.ownerRunId) return;
      // An owner whose deployment was retired cannot finish itself, so the
      // timer ends it instead. This bounds a retired session's lifetime: the
      // timer is its own run, which the stranded replay guard does not skip,
      // and a timer still sleeping has recorded no step, so it replays on this
      // build and runs this step.
      await endStrandedSession(error, input.token, "timeout");
      return;
    }
    if (!isInactiveTimeoutTarget(error)) {
      throw error;
    }
  }
}

/** Cancels a timer whose session reached another terminal outcome first. */
export async function cancelSessionTimeoutStep(
  input: { readonly runId: string } | SessionTimeoutWorkflowInput,
): Promise<void> {
  "use step";

  // A failed turn may have created its child without returning its ID.
  const runId = "runId" in input ? input.runId : `wrun_${timeoutChildId(input)}`;
  try {
    await cancelRun(await getWorld(), runId, {
      cancelReason: "Session ended before its timeout",
    });
  } catch (error) {
    if (!isInactiveTimeoutTarget(error)) {
      throw error;
    }
  }
}

function isInactiveTimeoutTarget(error: unknown): boolean {
  for (const candidate of walkCauseChain(error)) {
    if (
      HookNotFoundError.is(candidate) ||
      WorkflowRunNotFoundError.is(candidate) ||
      RunExpiredError.is(candidate) ||
      EntityConflictError.is(candidate)
    ) {
      return true;
    }
  }
  return false;
}
