import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "#compiled/zod/index.js";
import {
  DEPLOYMENT_WEBHOOK_EVENT,
  DEPLOYMENT_WEBHOOK_CONFIG_ENV,
  DeploymentWebhookConfigSchema,
} from "#internal/deployment-webhook-config.js";
import { DEPLOYMENT_PROMOTION_WORKFLOW_NAME } from "#execution/deployment-promotion-protocol.js";
import { startWorkflowOnCurrentDeployment } from "#execution/workflow-runtime.js";
import { getWorld } from "#internal/workflow/runtime.js";
import { resolveInstalledPackageInfo } from "#internal/application/package.js";
import { installEveWorkflowQueueNamespace } from "#internal/workflow/queue-namespace.js";
import {
  PROMOTION_CHECK_HEADER,
  resolvePromotedDeploymentId,
  verifyPromotionCheck,
} from "#internal/promoted-deployment.js";
import { createLogger, logError } from "#internal/logging.js";

const MAX_BODY_BYTES = 64 * 1_024;
const log = createLogger("deployment-webhook");
const PromotionSchema = z.object({
  type: z.literal(DEPLOYMENT_WEBHOOK_EVENT),
  id: z.string().min(1).max(256),
  createdAt: z.number().int().positive(),
  payload: z.object({
    deployment: z.object({ id: z.string().regex(/^dpl_[A-Za-z0-9]+$/u) }),
    project: z.object({ id: z.string().min(1).max(256) }),
    team: z.object({ id: z.string().min(1).max(256) }).nullable(),
    user: z.object({ id: z.string().min(1).max(256) }).optional(),
  }),
});

/** Verify exact bytes before JSON parsing or any Workflow operation. */
export async function handleDeploymentPromotionRequest(
  input: { readonly agentName: string },
  request: Request,
): Promise<Response> {
  let config: z.infer<typeof DeploymentWebhookConfigSchema>;
  try {
    config = DeploymentWebhookConfigSchema.parse(
      JSON.parse(process.env[DEPLOYMENT_WEBHOOK_CONFIG_ENV] ?? "null"),
    );
  } catch {
    return new Response(null, { status: 404 });
  }
  const { secret, projectId, ownerId } = config;
  if (request.method === "GET") {
    if (!verifyPromotionCheck(secret, request.headers.get(PROMOTION_CHECK_HEADER)))
      return new Response(null, { status: 401 });
    return Response.json(
      { projectId, deploymentId: await (await getWorld()).getDeploymentId() },
      {
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const signature = request.headers.get("x-vercel-signature");
  if (signature === null || !/^[a-f0-9]{40}$/iu.test(signature))
    return new Response(null, { status: 401 });
  let bytes: Buffer;
  try {
    bytes = await readWebhookBytes(request);
  } catch {
    return new Response(null, { status: 413 });
  }
  const digest = createHmac("sha1", secret).update(bytes).digest();
  if (!timingSafeEqual(digest, Buffer.from(signature, "hex")))
    return new Response(null, { status: 401 });
  let event: z.infer<typeof PromotionSchema>;
  try {
    event = PromotionSchema.parse(JSON.parse(bytes.toString("utf8")));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (
    event.payload.project.id !== projectId ||
    (event.payload.team?.id ?? event.payload.user?.id) !== ownerId
  )
    return new Response(null, { status: 403 });
  try {
    const world = await getWorld();
    const targetDeploymentId = event.payload.deployment.id;
    if ((await resolvePromotedDeploymentId()) !== targetDeploymentId)
      return Response.json({ status: "superseded" }, { status: 202 });
    // Retry after alias propagation on the promoted receiver, which proves it supports this command.
    if ((await world.getDeploymentId()) !== targetDeploymentId)
      return new Response(null, { status: 503 });
    const queueNamespace = installEveWorkflowQueueNamespace(input.agentName);
    const run = await startWorkflowOnCurrentDeployment(
      {
        workflowId: `workflow//${resolveInstalledPackageInfo().name}//${DEPLOYMENT_PROMOTION_WORKFLOW_NAME}`,
      },
      [{ eventId: event.id, promotedAt: event.createdAt, queueNamespace, targetDeploymentId }],
    );
    return Response.json({ runId: run.runId, status: "accepted" }, { status: 202 });
  } catch (error) {
    logError(log, "could not accept deployment promotion", error);
    return new Response(null, { status: 503 });
  }
}

async function readWebhookBytes(request: Request): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    await request.body?.cancel();
    throw new Error("Webhook body exceeds the limit.");
  }
  if (request.body === null) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Webhook body exceeds the limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
