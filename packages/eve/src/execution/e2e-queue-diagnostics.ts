import type { World } from "#compiled/@workflow/world/index.js";

/** Opt-in E2E metadata, retained durably for failure-only artifact collection. */
export function captureE2EQueueAttempts<T extends World>(world: T): T {
  if (process.env.EVE_E2E_WORKFLOW_DIAGNOSTICS !== "true") return world;
  const create = world.createQueueHandler.bind(world);
  world.createQueueHandler = (prefix, handler) =>
    create(prefix, async (message, meta) => {
      const runId =
        typeof message === "object" &&
        message !== null &&
        "runId" in message &&
        typeof message.runId === "string"
          ? message.runId
          : undefined;
      if (runId !== undefined) {
        // Never persist the queue payload, credentials, user content, or error text.
        await world.streams
          .write(
            runId,
            "e2e-queue-attempts",
            JSON.stringify({
              at: new Date().toISOString(),
              messageId: meta.messageId,
              requestId: meta.requestId,
              attempt: meta.attempt,
              queueName: meta.queueName,
            }),
          )
          .catch(() => {}); // Diagnostics must not fail delivery.
      }
      return await handler(message, meta);
    });
  return world;
}
