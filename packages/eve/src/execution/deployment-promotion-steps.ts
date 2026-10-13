import { HookNotFoundError, WorkflowRunNotFoundError } from "#compiled/@workflow/errors/index.js";
import {
  EVE_PROACTIVE_HANDOFF_ATTRIBUTE,
  PROACTIVE_HANDOFF_ACTIVITY_WINDOW_MS,
  type DeploymentPromotionInput,
} from "#execution/deployment-promotion-protocol.js";
import { EVE_SESSION_ATTRIBUTE, EVE_TYPE_ATTRIBUTE } from "#execution/eve-workflow-attributes.js";
import {
  sessionCommandHookToken,
  sessionInboxHookToken,
} from "#execution/session-inbox/address.js";
import { resumeRunnableHook } from "#execution/session-inbox/owner.js";
import { getHookByToken, getWorld } from "#internal/workflow/runtime.js";
import { createLogger, logError } from "#internal/logging.js";
import { resolvePromotedDeploymentId } from "#internal/promoted-deployment.js";
import { mapConcurrent } from "#shared/map-concurrent.js";

const log = createLogger("execution.deployment-promotion");

export interface PromotionCandidate {
  readonly ownerRunId: string;
  readonly sessionId: string;
}

/** Recheck at the old owner, since a newer promotion may overtake a queued notification. */
export async function isPromotedDeploymentCurrentStep(input: {
  readonly targetDeploymentId: string;
}): Promise<boolean> {
  "use step";
  try {
    return (await resolvePromotedDeploymentId()) === input.targetDeploymentId;
  } catch (error) {
    // A failed background check must not end a conversation. Message-triggered handoff remains available.
    logError(log, "could not verify the promoted deployment; retaining the session", error);
    return false;
  }
}

/** Uses existing Workflow records instead of a separate session index. */
export async function listPromotionCandidatesStep(
  input: DeploymentPromotionInput & {
    readonly cursor?: string;
  },
): Promise<{ readonly candidates: PromotionCandidate[]; readonly cursor?: string }> {
  "use step";
  const page = await (
    await getWorld()
  ).runs.list({
    pagination: { cursor: input.cursor, limit: 100 },
    resolveData: "none",
    status: "running",
  });
  const candidates: PromotionCandidate[] = [];
  for (const run of page.data) {
    if (
      run.attributes[EVE_PROACTIVE_HANDOFF_ATTRIBUTE] !== input.queueNamespace ||
      run.deploymentId === input.targetDeploymentId ||
      run.createdAt.getTime() > input.promotedAt ||
      run.updatedAt.getTime() < input.promotedAt - PROACTIVE_HANDOFF_ACTIVITY_WINDOW_MS
    )
      continue;
    const sessionId =
      run.attributes[EVE_SESSION_ATTRIBUTE] ??
      (run.attributes[EVE_TYPE_ATTRIBUTE] === "session" ? run.runId : undefined);
    if (sessionId !== undefined) candidates.push({ ownerRunId: run.runId, sessionId });
  }
  return { candidates, cursor: page.hasMore && page.cursor !== null ? page.cursor : undefined };
}

/** Anchors stay running after handoff; notify only the run currently holding the inbox. */
export async function notifyPromotionCandidatesStep(input: {
  readonly candidates: readonly PromotionCandidate[];
  readonly targetDeploymentId: string;
}): Promise<number> {
  "use step";
  const accepted = await mapConcurrent(input.candidates, async (candidate) => {
    const token = sessionInboxHookToken(sessionCommandHookToken(candidate.sessionId));
    try {
      const hook = await getHookByToken(token);
      if (hook.runId !== candidate.ownerRunId) return 0;
      await resumeRunnableHook(token, {
        kind: "deployment-promotion",
        targetDeploymentId: input.targetDeploymentId,
      });
      return 1;
    } catch (error) {
      if (HookNotFoundError.is(error) || WorkflowRunNotFoundError.is(error)) return 0;
      throw error;
    }
  });
  return accepted.reduce<number>((total, count) => total + count, 0);
}

export async function reportDeploymentPromotionStep(input: {
  readonly eventId: string;
  readonly notified: number;
  readonly targetDeploymentId: string;
}): Promise<void> {
  "use step";
  log.info("notified session owners of a production promotion", input);
}
