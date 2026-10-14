import { describe, expect, it, vi } from "vitest";
import { ThrottleError } from "#compiled/@workflow/errors/index.js";
import type { MessageStreamEvent } from "#protocol/message.js";
import { dispatchChannelRequest } from "#internal/nitro/routes/channel-dispatch.js";
import { eveChannel } from "#public/channels/eve.js";
import { httpBasic } from "#public/channels/auth.js";
import { getRun, getWorld } from "#internal/workflow/runtime.js";
import { captureTurnEvents } from "#internal/testing/events.js";
import { createTestRuntime } from "#internal/testing/app-harness.js";

/** A fresh workflow run id the caller reserves for a new session. */
function reserveSessionId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let timestamp = Date.now();
  let encoded = "";
  for (let i = 0; i < 10; i++) {
    encoded = alphabet[timestamp % 32] + encoded;
    timestamp = Math.floor(timestamp / 32);
  }
  const random = Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) => alphabet[v % 32]);
  return `wrun_${encoded}${random.join("")}`;
}

async function post(path: string, body: Record<string, unknown>) {
  const sessionId = path.split("/")[4];
  const response = await dispatchChannelRequest(
    {
      req: new Request(`https://example.com${path}`, {
        method: "POST",
        headers: {
          authorization: `Basic ${btoa("ops:secret")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      context: { params: sessionId === undefined ? {} : { sessionId } },
      waitUntil: () => {},
    } as never,
    path === "/eve/v1/session" ? "POST /eve/v1/session" : "POST /eve/v1/session/:sessionId",
    { kind: "production", sandboxScope: "test" },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** The user messages a turn answered, read from its completed message. */
function answered(turn: readonly MessageStreamEvent[]): string {
  return turn
    .flatMap((event) =>
      event.type === "message.completed" && typeof event.data.message === "string"
        ? [event.data.message]
        : [],
    )
    .join("");
}

async function runCreatedCount(sessionId: string): Promise<number> {
  const events = await (
    await getWorld()
  ).events.list({
    runId: sessionId,
    resolveData: "none",
    pagination: { limit: 1000 },
  });
  return events.data.filter((event) => event.eventType === "run_created").length;
}

function httpAgent(name: string) {
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_inline");
  return createTestRuntime({
    agent: { name, limits: { sessionTimeoutMs: false } },
    modules: [
      {
        logicalPath: "channels/eve.ts",
        loadNamespace: async () => ({
          default: eveChannel({
            auth: [httpBasic({ username: "ops", password: "secret" })],
            turnPolicy: "queue",
          }),
        }),
      },
    ],
  });
}

describe("session create with reserved ids over HTTP", () => {
  it("accepts overlapping identical creates and runs one turn", async () => {
    const runtime = await httpAgent("session-create-identical");
    await runtime.run(async () => {
      const sessionId = reserveSessionId();
      const create = { message: "hello", sessionId, deliveryId: "dlv_first" };
      const results = await Promise.all([
        post("/eve/v1/session", create),
        post("/eve/v1/session", create),
      ]);
      expect(results.map((result) => result.status)).toEqual([202, 202]);
      expect(results.map((result) => result.body.deliveryId)).toEqual(["dlv_first", "dlv_first"]);

      const stream = captureTurnEvents(getRun(sessionId));
      try {
        expect(answered(await stream.nextTurn())).toContain("hello");
        await expect(
          post(`/eve/v1/session/${sessionId}`, {
            message: "next message",
            deliveryId: "dlv_next",
          }),
        ).resolves.toMatchObject({ status: 202 });
        const next = answered(await stream.nextTurn());
        expect(next).toContain("next message");
        expect(next).not.toContain("hello");
        expect(await runCreatedCount(sessionId)).toBe(1);
      } finally {
        stream.dispose();
        await getRun(sessionId).cancel();
      }
    });
  });

  it("rejects a reserved session create without a delivery id", async () => {
    const runtime = await httpAgent("session-create-no-delivery");
    await runtime.run(async () => {
      const sessionId = reserveSessionId();
      const results = await Promise.all([
        post("/eve/v1/session", { message: "Same", sessionId }),
        post("/eve/v1/session", { message: "Same", sessionId }),
      ]);
      expect(results.map((result) => result.status)).toEqual([400, 400]);
      expect(await runCreatedCount(sessionId)).toBe(0);
    });
  });

  it("rejects a reserved session create that also carries an operation id", async () => {
    const runtime = await httpAgent("session-create-operation-and-reserved");
    await runtime.run(async () => {
      const sessionIds = [reserveSessionId(), reserveSessionId()];
      const results = await Promise.all(
        sessionIds.map((sessionId, index) =>
          post("/eve/v1/session", {
            message: `from ${index}`,
            sessionId,
            deliveryId: `dlv_${index}`,
            operationId: "op_shared",
          }),
        ),
      );
      expect(results.map((result) => result.status)).toEqual([400, 400]);
      for (const sessionId of sessionIds) expect(await runCreatedCount(sessionId)).toBe(0);
    });
  });

  it("keeps operation-only creates idempotent", async () => {
    const runtime = await httpAgent("session-create-operation-only");
    await runtime.run(async () => {
      const first = await post("/eve/v1/session", { message: "hello", operationId: "op_only" });
      expect(first.status).toBe(202);
      const sessionId = first.body.sessionId as string;
      const stream = captureTurnEvents(getRun(sessionId));
      try {
        const turn = await stream.nextTurn();
        expect(answered(turn)).toContain("hello");
        const second = await post("/eve/v1/session", { message: "hello", operationId: "op_only" });
        expect(second.status).toBe(202);
        expect(second.body.sessionId).toBe(sessionId);
      } finally {
        stream.dispose();
        await getRun(sessionId).cancel();
      }
    });
  });

  it("rejects a create whose reserved session is recorded for another delivery", async () => {
    const runtime = await httpAgent("session-create-conflict");
    await runtime.run(async () => {
      const sessionId = reserveSessionId();
      const results = await Promise.all([
        post("/eve/v1/session", { message: "from a", sessionId, deliveryId: "dlv_a" }),
        post("/eve/v1/session", { message: "from b", sessionId, deliveryId: "dlv_b" }),
      ]);
      const accepted = results.filter((result) => result.status === 202);
      const rejected = results.filter((result) => result.status === 409);
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.body.code).toBe("session_exists");

      const run = await (await getWorld()).runs.get(sessionId, { resolveData: "none" });
      expect(run.attributes["eve.channel.initialDeliveryId"]).toBe(accepted[0]!.body.deliveryId);
      await getRun(sessionId).cancel();
    });
  });

  it("does not acknowledge a create until run storage records the session", async () => {
    const runtime = await httpAgent("session-create-throttled");
    await runtime.run(async () => {
      const world = await getWorld();
      const originalCreate = world.events.create;
      const sessionId = reserveSessionId();
      let throttled = 0;
      // Resolves when the queued start records the run (`run_started` carries
      // the queued input and creates the missing run).
      const { promise: recorded, resolve: markRecorded } = Promise.withResolvers<void>();
      world.events.create = (async (
        runId: string,
        event: { eventType: string },
        params?: unknown,
      ) => {
        if (event.eventType === "run_created" && throttled === 0) {
          throttled += 1;
          throw new ThrottleError("run_created throttled");
        }
        const result = await originalCreate.call(
          world.events,
          runId,
          event as never,
          params as never,
        );
        if (runId === sessionId && event.eventType === "run_started") markRecorded();
        return result;
      }) as typeof originalCreate;
      const create = { message: "hello", sessionId, deliveryId: "dlv_first" };
      try {
        // The queue accepted the run, but run storage has no record of it.
        await expect(post("/eve/v1/session", create)).resolves.toMatchObject({
          status: 503,
          body: { code: "session_not_recorded" },
        });
        expect(throttled).toBe(1);

        // The queued start records the run from its queued input; the re-send
        // with the same ids is then acknowledged, and only one turn runs.
        await recorded;
        const stream = captureTurnEvents(getRun(sessionId));
        try {
          expect(answered(await stream.nextTurn())).toContain("hello");
          await expect(post("/eve/v1/session", create)).resolves.toMatchObject({
            status: 202,
            body: { deliveryId: "dlv_first" },
          });
          await post(`/eve/v1/session/${sessionId}`, {
            message: "next message",
            deliveryId: "dlv_next",
          });
          const next = answered(await stream.nextTurn());
          expect(next).toContain("next message");
          expect(next).not.toContain("hello");
        } finally {
          stream.dispose();
          await getRun(sessionId).cancel();
        }
      } finally {
        world.events.create = originalCreate;
      }
    });
  });
});
