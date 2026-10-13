import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDeploymentWebhook } from "./deployment-webhook.js";

vi.mock("#internal/model-auth/vercel-cli.js", () => ({
  readVercelCliToken: async () => "cli-test-token",
}));
vi.mock("#internal/vercel/project-link.js", () => ({
  readVercelProjectLink: async () => ({ projectId: "prj_test", orgId: "team_test" }),
}));
const callback = "https://test.vercel.app/eve/v1/deployment/promoted";
const hook = {
  id: "hook_test",
  secret: "signing-key",
  ownerId: "team_test",
  url: callback,
  projectIds: ["prj_test"],
  events: ["deployment.promoted"],
};
const config = {
  webhookId: hook.id,
  secret: hook.secret,
  projectId: "prj_test",
  ownerId: "team_test",
  url: callback,
};
let stored = false;
let persistFails = false;
let alias = true;
let protectedProject = false;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  stored = false;
  protectedProject = false;
  persistFails = false;
  alias = true;
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === "/v9/projects/prj_test")
      return Response.json({
        targets: alias ? { production: { alias: ["test.vercel.app"] } } : {},
        ssoProtection: protectedProject ? { deploymentType: "all" } : null,
      });
    if (pathname === "/v9/projects/prj_test/env")
      return Response.json({
        envs: stored
          ? [{ id: "env_test", key: "EVE_DEPLOYMENT_WEBHOOK_CONFIG", target: ["production"] }]
          : [],
      });
    if (pathname === "/v1/projects/prj_test/env/env_test")
      return Response.json({ value: JSON.stringify(config) });
    if (pathname === "/v1/projects/prj_test/protection-bypass")
      return Response.json({
        protectionBypass: {
          "dedicated-bypass": {
            scope: "automation-bypass",
            note: "eve deployment promotion webhook",
          },
        },
      });
    if (pathname === "/v1/webhooks")
      return Response.json(
        init.method === "POST"
          ? { ...hook, url: JSON.parse(init.body as string).url }
          : stored
            ? [hook]
            : [],
      );
    if (pathname === "/v10/projects/prj_test/env")
      return persistFails ? new Response(null, { status: 403 }) : Response.json({ id: "env_test" });
    if (pathname === "/v1/webhooks/hook_test" && init.method === "DELETE")
      return new Response(null, { status: 204 });
    throw new Error("Unexpected Vercel request.");
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("project promotion webhook provisioning", () => {
  it("persists the signing key encrypted for production and reuses the registered hook", async () => {
    expect(await ensureDeploymentWebhook("/test/project")).toBe("configured");
    const persisted = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(url).pathname === "/v10/projects/prj_test/env" && init?.method === "POST",
    )!;
    expect(JSON.parse(persisted[1]!.body as string)).toMatchObject({
      type: "encrypted",
      target: ["production"],
      value: JSON.stringify(config),
    });
    stored = true;
    fetchMock.mockClear();
    expect(await ensureDeploymentWebhook("/test/project")).toBe("configured");
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === undefined)).toBe(true);
  });
  it("removes only its newly created webhook if signing-key persistence fails", async () => {
    persistFails = true;
    await expect(ensureDeploymentWebhook("/test/project")).rejects.toThrow("HTTP 403");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          new URL(url).pathname === "/v1/webhooks/hook_test" && init?.method === "DELETE",
      ),
    ).toBe(true);
  });
  it("waits for a verified production alias rather than inventing a callback", async () => {
    alias = false;
    expect(await ensureDeploymentWebhook("/test/project")).toBe("awaiting-first-deployment");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("uses a dedicated automation bypass for the signed endpoint on protected projects", async () => {
    protectedProject = true;
    expect(await ensureDeploymentWebhook("/test/project")).toBe("configured");
    const registration = fetchMock.mock.calls.find(
      ([url, init]) => new URL(url).pathname === "/v1/webhooks" && init?.method === "POST",
    )!;
    expect(
      new URL(JSON.parse(registration[1]!.body as string).url).searchParams.get(
        "x-vercel-protection-bypass",
      ),
    ).toBe("dedicated-bypass");
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          new URL(url).pathname === "/v1/projects/prj_test/protection-bypass" &&
          init?.method === "PATCH",
      ),
    ).toBe(true);
  });
});
