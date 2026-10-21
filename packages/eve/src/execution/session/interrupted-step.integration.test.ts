import { expect, it, vi } from "vitest";
import { ContextContainer } from "#context/container.js";
import { SessionIdKey } from "#context/keys.js";
import { createCompactionConfig } from "#execution/session.js";
import {
  readInterruptedAttempt,
  recoverInterruptedStep,
} from "#execution/session/interrupted-step.js";
import { enterSessionProjection } from "#harness/session-machine/current.js";
import type { HarnessSession } from "#harness/types.js";
import { withPublished } from "#internal/testing/session-machine.js";

it.each([
  { outcome: "completed" as const, isError: false },
  { outcome: "failed" as const, isError: true },
])(
  "adopts a recorded $outcome session ending without restoring providers",
  async ({ outcome, isError }) => {
    const session: HarnessSession = {
      agent: { system: "", tools: [], dynamicModel: true },
      compaction: createCompactionConfig(),
      continuationToken: "test",
      history: [],
      sessionId: "ended-session",
    };
    const started = { type: "session.started" as const, data: {} };
    const ended = { type: "session.ended" as const, data: { outcome } };
    const recorded = withPublished(withPublished(session, [started]), [ended]);
    const ctx = new ContextContainer();
    ctx.set(SessionIdKey, session.sessionId);
    enterSessionProjection(ctx, recorded.state);
    const publish = vi.fn(async () => session);
    const at = "2026-10-21T00:00:00.000Z";
    const result = await recoverInterruptedStep({
      admission: [],
      attempt: readInterruptedAttempt(0, [
        { position: 0, line: { at, facts: [started] } },
        { position: 1, line: { at, facts: [ended] } },
      ]),
      ctx,
      failed: false,
      publish,
      session,
      stepInput: undefined,
    });
    expect(result).toMatchObject({ result: { action: "done", isError, output: "" } });
    expect(publish).not.toHaveBeenCalled();
  },
);
