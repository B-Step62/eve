import { describe, expect, it, vi } from "vitest";
const metadata = vi.hoisted(() => ({ attempt: 2 }));
vi.mock("#compiled/@workflow/core/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#compiled/@workflow/core/index.js")>()),
  getStepMetadata: () => ({ attempt: metadata.attempt }),
}));
import { dispatchProgramCallStep, recordProgramCallStartedStep } from "./program-step.js";

describe("started-call replay", () => {
  it("records a stable call marker as a separate durable step", async () => {
    expect(await recordProgramCallStartedStep("program:0")).toEqual({
      status: "started",
      callId: "program:0",
    });
  });
  it("never resolves or dispatches a call whose earlier step attempt lost its result", async () => {
    // Context is deliberately unusable: touching it would prove dispatch was retried.
    const context = {
      get serializedContext() {
        throw new Error("must not hydrate replay");
      },
    } as never;
    expect(
      await dispatchProgramCallStep(
        {} as never,
        context,
        { index: 0, input: {}, tool: "write" },
        { callId: "program:0", status: "started" },
        [],
      ),
    ).toEqual({
      index: 0,
      status: "unknown",
      error: expect.stringContaining("may or may not have happened"),
    });
  });
});
