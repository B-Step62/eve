import { expect, it } from "vitest";

import { sessionView } from "#harness/session-machine/commit.js";
import { completeEngineStep } from "#harness/session-machine/transitions.js";
import type { CallReceipt } from "#harness/session-machine/state.js";
import { initialSessionProjection } from "#protocol/session-projection.js";

it("acknowledges the read results with the engine checkpoint without dropping new results at the same coordinates", () => {
  const receipt = (callId: string): CallReceipt => ({
    event: { sequence: 0, stepIndex: 1, turnId: "turn_0" },
    results: [
      {
        type: "tool-result",
        toolCallId: callId,
        toolName: "record",
        output: { type: "text", value: callId },
      },
    ],
  });
  const read = receipt("deploy");
  const arrived = receipt("record");
  const view = sessionView(initialSessionProjection(), undefined);
  const before = {
    ...view,
    turn: { ...view.turn, receipts: [read, arrived], engineSnapshot: "opaque-before" },
  };

  const after = completeEngineStep(before, {
    read: [structuredClone(read)],
    engineSnapshot: "opaque-after",
  });

  expect(after.turn.receipts).toEqual([arrived]);
  expect(after.turn.engineSnapshot).toBe("opaque-after");
  expect(before.turn.receipts).toEqual([read, arrived]);
  expect(before.turn.engineSnapshot).toBe("opaque-before");
});
