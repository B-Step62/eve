import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "#compiled/zod/index.js";
import {
  DEPLOYMENT_WEBHOOK_CONFIG_ENV,
  DeploymentWebhookConfigSchema,
} from "#internal/deployment-webhook-config.js";

export const PROMOTION_CHECK_HEADER = "x-eve-promotion-check";

export function readDeploymentWebhookConfig() {
  return DeploymentWebhookConfigSchema.parse(
    JSON.parse(process.env[DEPLOYMENT_WEBHOOK_CONFIG_ENV] ?? "null"),
  );
}

export function signPromotionCheck(secret: string, timestamp: string): string {
  return `${timestamp}.${createHmac("sha256", secret).update(`eve-promotion-check:${timestamp}`).digest("hex")}`;
}

export function verifyPromotionCheck(secret: string, value: string | null): boolean {
  if (value === null || !/^\d{13}\.[a-f0-9]{64}$/u.test(value)) return false;
  const timestamp = value.slice(0, 13);
  if (Math.abs(Date.now() - Number(timestamp)) > 60_000) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(signPromotionCheck(secret, timestamp)));
}

/** Resolve the deployment actually serving production, including explicit promotions and rollbacks. */
export async function resolvePromotedDeploymentId(): Promise<string> {
  const config = readDeploymentWebhookConfig();
  const response = await fetch(config.url, {
    headers: { [PROMOTION_CHECK_HEADER]: signPromotionCheck(config.secret, String(Date.now())) },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Production deployment verification failed (HTTP ${response.status}).`);
  return z
    .object({ deploymentId: z.string().min(1), projectId: z.literal(config.projectId) })
    .parse(await response.json()).deploymentId;
}
