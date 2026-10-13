import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleDeploymentPromotionRequest } from "./deployment-promotion.js";
import { PROMOTION_CHECK_HEADER, signPromotionCheck } from "#internal/promoted-deployment.js";

const { start, deployment } = vi.hoisted(() => ({ start: vi.fn(), deployment: vi.fn() }));
vi.mock("#execution/workflow-runtime.js", () => ({ startWorkflowOnCurrentDeployment: start }));
vi.mock("#internal/workflow/runtime.js", () => ({
  getWorld: async () => ({ getDeploymentId: deployment }),
}));

const config = {
  webhookId: "hook_test",
  secret: "webhook-test-secret",
  projectId: "prj_test",
  ownerId: "team_test",
  url: "https://test.vercel.app/eve/v1/deployment/promoted",
};
const input = { agentName: "promotion-test" };
function event(target = "dpl_B") {
  return {
    type: "deployment.promoted",
    id: "evt_test",
    createdAt: Date.now(),
    payload: {
      project: { id: config.projectId },
      team: { id: config.ownerId },
      deployment: { id: target },
    },
  };
}
function signed(body: string) {
  return new Request(config.url, {
    method: "POST",
    body,
    headers: { "x-vercel-signature": createHmac("sha1", config.secret).update(body).digest("hex") },
  });
}

beforeEach(() => {
  vi.stubEnv("EVE_DEPLOYMENT_WEBHOOK_CONFIG", JSON.stringify(config));
  deployment.mockResolvedValue("dpl_B");
  start.mockResolvedValue({ runId: "wrun_sweep" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ projectId: config.projectId, deploymentId: "dpl_B" })),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("deployment promotion receiver", () => {
  it("authenticates exact bytes and project scope before accepting control-plane work", async () => {
    const raw = JSON.stringify(event());
    const changed = signed(raw);
    expect(
      (
        await handleDeploymentPromotionRequest(
          input,
          new Request(changed, { method: "POST", body: raw + " " }),
        )
      ).status,
    ).toBe(401);
    const wrongProject = event();
    wrongProject.payload.project.id = "prj_other";
    expect(
      (await handleDeploymentPromotionRequest(input, signed(JSON.stringify(wrongProject)))).status,
    ).toBe(403);
    expect(start).not.toHaveBeenCalled();
    const accepted = await handleDeploymentPromotionRequest(input, signed(raw));
    expect(accepted.status).toBe(202);
    expect(await accepted.json()).toEqual({ status: "accepted", runId: "wrun_sweep" });
  });

  it("acknowledges stale promotions without moving sessions and retries propagation failures", async () => {
    expect(
      await (
        await handleDeploymentPromotionRequest(input, signed(JSON.stringify(event("dpl_A"))))
      ).json(),
    ).toEqual({ status: "superseded" });
    expect(start).not.toHaveBeenCalled();
    deployment.mockResolvedValue("dpl_A");
    expect(
      (await handleDeploymentPromotionRequest(input, signed(JSON.stringify(event())))).status,
    ).toBe(503);
    expect(start).not.toHaveBeenCalled();
  });

  it("does not acknowledge a promotion if durable acceptance fails", async () => {
    start.mockRejectedValue(new Error("acceptance unavailable"));
    expect(
      (await handleDeploymentPromotionRequest(input, signed(JSON.stringify(event())))).status,
    ).toBe(503);
  });

  it("bounds streamed bodies before parsing them", async () => {
    const request = signed("x".repeat(65537));
    expect((await handleDeploymentPromotionRequest(input, request)).status).toBe(413);
    expect(start).not.toHaveBeenCalled();
  });

  it("only exposes current deployment to a fresh authenticated production check", async () => {
    expect((await handleDeploymentPromotionRequest(input, new Request(config.url))).status).toBe(
      401,
    );
    const expired = signPromotionCheck(config.secret, String(Date.now() - 120000));
    expect(
      (
        await handleDeploymentPromotionRequest(
          input,
          new Request(config.url, { headers: { [PROMOTION_CHECK_HEADER]: expired } }),
        )
      ).status,
    ).toBe(401);
    const response = await handleDeploymentPromotionRequest(
      input,
      new Request(config.url, {
        headers: {
          [PROMOTION_CHECK_HEADER]: signPromotionCheck(config.secret, String(Date.now())),
        },
      }),
    );
    expect(await response.json()).toEqual({ projectId: config.projectId, deploymentId: "dpl_B" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(start).not.toHaveBeenCalled();
  });
});
