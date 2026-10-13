import type { DeploymentPromotionInput } from "#execution/deployment-promotion-protocol.js";
import {
  isPromotedDeploymentCurrentStep,
  listPromotionCandidatesStep,
  notifyPromotionCandidatesStep,
  reportDeploymentPromotionStep,
  type PromotionCandidate,
} from "#execution/deployment-promotion-steps.js";

/** A durable sweep keeps webhook acknowledgment independent of the number of sessions. */
export async function deploymentPromotionWorkflow(input: DeploymentPromotionInput): Promise<void> {
  "use workflow";
  if (!(await isPromotedDeploymentCurrentStep(input))) return;
  const candidates: PromotionCandidate[] = [];
  let cursor: string | undefined;
  // Snapshot candidates before transfers change the live run listing.
  for (let page = 0; ; page++) {
    if (page >= 100) throw new Error("Promotion sweep exceeded 10,000 live Workflow runs.");
    const result = await listPromotionCandidatesStep({ ...input, cursor });
    candidates.push(...result.candidates);
    cursor = result.cursor;
    if (cursor === undefined) break;
  }
  let notified = 0;
  for (let offset = 0; offset < candidates.length; offset += 100) {
    if (!(await isPromotedDeploymentCurrentStep(input))) return;
    notified += await notifyPromotionCandidatesStep({
      candidates: candidates.slice(offset, offset + 100),
      targetDeploymentId: input.targetDeploymentId,
    });
  }
  await reportDeploymentPromotionStep({
    eventId: input.eventId,
    notified,
    targetDeploymentId: input.targetDeploymentId,
  });
}
