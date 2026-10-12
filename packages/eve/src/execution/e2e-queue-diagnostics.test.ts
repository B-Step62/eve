import { afterEach, expect, it, vi } from "vitest";
import type { World } from "#compiled/@workflow/world/index.js";
import { captureE2EQueueAttempts } from "./e2e-queue-diagnostics.js";

afterEach(() => vi.unstubAllEnvs());

it("does not alter ordinary queue handlers", () => {
  vi.stubEnv("EVE_E2E_WORKFLOW_DIAGNOSTICS", "false");
  const createQueueHandler = vi.fn();
  const world = { createQueueHandler } as unknown as World;
  expect(captureE2EQueueAttempts(world).createQueueHandler).toBe(createQueueHandler);
});

it("persists only attempt metadata and never lets capture failure break delivery", async () => {
  vi.stubEnv("EVE_E2E_WORKFLOW_DIAGNOSTICS", "true");
  const write = vi.fn().mockRejectedValue(new Error("storage unavailable"));
  let captured!: (message: unknown, meta: unknown) => Promise<unknown>;
  const world = {
    streams: { write },
    createQueueHandler: vi.fn((_prefix, handler) => {
      captured = handler;
    }),
  } as unknown as World;
  const handler = vi.fn().mockResolvedValue("handled");
  captureE2EQueueAttempts(world).createQueueHandler("__wkf_", handler);
  const message = { runId: "wrun_test", secret: "never-retain" };
  const meta = { queueName: "__wkf_test", messageId: "msg_test", attempt: 2 };
  expect(await captured(message, meta)).toBe("handled");
  expect(handler).toHaveBeenCalledWith(message, meta);
  expect(write).toHaveBeenCalledWith("wrun_test", "e2e-queue-attempts", expect.any(String));
  expect(JSON.parse(write.mock.calls[0]![2])).toEqual({ at: expect.any(String), ...meta });
});
