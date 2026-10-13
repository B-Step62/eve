/** Only owners that understand this internal command may receive promotion notifications. */
export const EVE_PROACTIVE_HANDOFF_ATTRIBUTE = "$eve.proactive_handoff";
export const DEPLOYMENT_PROMOTION_WORKFLOW_NAME = "deploymentPromotionWorkflow";
export const PROACTIVE_HANDOFF_ACTIVITY_WINDOW_MS = 30 * 60 * 1_000;

/** Internal control-plane input, never accepted from a channel request body. */
export interface DeploymentPromotionPayload {
  readonly kind: "deployment-promotion";
  readonly targetDeploymentId: string;
}

export interface DeploymentPromotionInput {
  readonly eventId: string;
  readonly promotedAt: number;
  readonly targetDeploymentId: string;
  readonly queueNamespace: string;
}
