import { z } from "#compiled/zod/index.js";

export const DEPLOYMENT_WEBHOOK_CONFIG_ENV = "EVE_DEPLOYMENT_WEBHOOK_CONFIG";
export const DEPLOYMENT_WEBHOOK_EVENT = "deployment.promoted";

/** Kept in one encrypted project variable so identity and signing material cannot drift apart. */
export const DeploymentWebhookConfigSchema = z.object({
  webhookId: z.string().min(1),
  secret: z.string().min(1),
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  url: z.url(),
});
