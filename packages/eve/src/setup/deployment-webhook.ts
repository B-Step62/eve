import { z } from "#compiled/zod/index.js";
import { readVercelCliToken } from "#internal/model-auth/vercel-cli.js";
import { readVercelProjectLink } from "#internal/vercel/project-link.js";
import {
  DEPLOYMENT_WEBHOOK_CONFIG_ENV,
  DEPLOYMENT_WEBHOOK_EVENT,
  DeploymentWebhookConfigSchema,
} from "#internal/deployment-webhook-config.js";
import { EVE_DEPLOYMENT_PROMOTION_ROUTE_PATH } from "#protocol/routes.js";

const WebhookSchema = z.object({
  id: z.string().min(1),
  url: z.url(),
  ownerId: z.string().min(1),
  projectIds: z.array(z.string()).optional(),
  events: z.array(z.string()),
});
const BypassSchema = z.record(
  z.string(),
  z.object({ scope: z.string(), note: z.string().optional() }),
);
const BYPASS_NOTE = "eve deployment promotion webhook";
const EnvSchema = z.object({
  id: z.string(),
  key: z.string(),
  target: z.union([z.string(), z.array(z.string())]),
});

export type DeploymentWebhookSetupResult = "configured" | "awaiting-first-deployment";

/** Uses the developer's existing CLI identity once; runtime verification needs no API token. */
export async function ensureDeploymentWebhook(
  projectPath: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DeploymentWebhookSetupResult> {
  const link = await readVercelProjectLink(projectPath);
  if (link === undefined)
    throw new Error("Promotion webhook setup requires a linked Vercel project.");
  const token = await readVercelCliToken();
  if (token === undefined)
    throw new Error("Promotion webhook setup requires Vercel CLI login. Run `vercel login`.");
  const query = new URLSearchParams({ teamId: link.orgId });
  const request = async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const response = await fetch(
      `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}${query}`,
      {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        redirect: "error",
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
          : AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Vercel rejected promotion webhook setup (HTTP ${response.status}). Check project environment and webhook permissions, then retry.`,
      );
    return response.status === 204 ? undefined : await response.json();
  };
  const projectPathApi = `/v9/projects/${encodeURIComponent(link.projectId)}`;
  const project = z
    .object({
      ssoProtection: z.unknown().optional(),
      passwordProtection: z.unknown().optional(),
      protectionBypass: BypassSchema.optional(),
      targets: z
        .object({ production: z.object({ alias: z.array(z.string()).optional() }).optional() })
        .optional(),
    })
    .parse(await request(projectPathApi));
  const alias = project.targets?.production?.alias?.slice().sort((a, b) => a.length - b.length)[0];
  if (alias === undefined) return "awaiting-first-deployment";
  // Aliases came from the verified project, but reject malformed/nonpublic hosts before registering a callback.
  if (
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/iu.test(alias) ||
    /(?:^|\.)(?:localhost|local|internal)$/iu.test(alias) ||
    /^[\d.]+$/u.test(alias)
  )
    throw new Error("The production alias cannot be used as a public promotion webhook URL.");
  const callback = new URL(`https://${alias}${EVE_DEPLOYMENT_PROMOTION_ROUTE_PATH}`);
  if (project.ssoProtection != null || project.passwordProtection != null) {
    let bypass = Object.entries(project.protectionBypass ?? {}).find(
      ([, value]) => value.scope === "automation-bypass" && value.note === BYPASS_NOTE,
    )?.[0];
    if (bypass === undefined) {
      const updated = z.object({ protectionBypass: BypassSchema }).parse(
        await request(`/v1/projects/${encodeURIComponent(link.projectId)}/protection-bypass`, {
          method: "PATCH",
          body: JSON.stringify({ generate: { note: BYPASS_NOTE } }),
        }),
      );
      bypass = Object.entries(updated.protectionBypass).find(
        ([, value]) => value.scope === "automation-bypass" && value.note === BYPASS_NOTE,
      )?.[0];
      if (bypass === undefined)
        throw new Error("Vercel did not provide the promotion webhook automation bypass.");
    }
    callback.searchParams.set("x-vercel-protection-bypass", bypass);
  }
  const url = callback.href;
  const envs = z
    .object({ envs: z.array(EnvSchema) })
    .parse(await request(`${projectPathApi}/env`)).envs;
  const stored = envs.find(
    (env) =>
      env.key === DEPLOYMENT_WEBHOOK_CONFIG_ENV &&
      (Array.isArray(env.target) ? env.target.includes("production") : env.target === "production"),
  );
  let config: z.infer<typeof DeploymentWebhookConfigSchema> | undefined;
  if (stored !== undefined) {
    const env = z
      .object({ value: z.string() })
      .parse(
        await request(
          `/v1/projects/${encodeURIComponent(link.projectId)}/env/${encodeURIComponent(stored.id)}`,
        ),
      );
    config = DeploymentWebhookConfigSchema.parse(JSON.parse(env.value));
    if (config.projectId !== link.projectId || config.ownerId !== link.orgId)
      throw new Error(
        "Stored promotion webhook belongs to another project. Refusing to reuse its signing key.",
      );
  }
  const hooks = z.array(WebhookSchema).parse(await request("/v1/webhooks"));
  if (config !== undefined) {
    const existing = hooks.find((hook) => hook.id === config?.webhookId);
    if (
      existing !== undefined &&
      existing.url === config.url &&
      existing.ownerId === link.orgId &&
      existing.events.includes(DEPLOYMENT_WEBHOOK_EVENT) &&
      existing.projectIds?.length === 1 &&
      existing.projectIds[0] === link.projectId
    )
      return "configured";
    if (existing !== undefined)
      throw new Error(
        "The eve promotion webhook was changed outside eve. Restore its project scope and URL, or remove it before running `eve deploy` again.",
      );
  }
  if (hooks.some((hook) => hook.url === url && hook.projectIds?.includes(link.projectId)))
    throw new Error(
      "A promotion webhook already uses this endpoint, but eve has no matching signing key. Restore EVE_DEPLOYMENT_WEBHOOK_CONFIG or remove that webhook before retrying.",
    );
  const created = WebhookSchema.extend({ secret: z.string().min(1) }).parse(
    await request("/v1/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url,
        projectIds: [link.projectId],
        events: [DEPLOYMENT_WEBHOOK_EVENT],
      }),
    }),
  );
  const value = JSON.stringify({
    webhookId: created.id,
    secret: created.secret,
    projectId: link.projectId,
    ownerId: link.orgId,
    url,
  });
  try {
    await request(`/v10/projects/${encodeURIComponent(link.projectId)}/env?upsert=true`, {
      method: "POST",
      body: JSON.stringify({
        key: DEPLOYMENT_WEBHOOK_CONFIG_ENV,
        type: "encrypted",
        target: ["production"],
        value,
      }),
    });
  } catch (error) {
    // This webhook was just created by this invocation; it is unusable without its persisted key.
    await request(`/v1/webhooks/${encodeURIComponent(created.id)}`, { method: "DELETE" }).catch(
      () => {},
    );
    throw error;
  }
  return "configured";
}
