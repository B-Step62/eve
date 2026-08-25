import { expect, it, vi } from "vitest";

import { executeCodeModeProgramStep } from "#execution/code-mode-run/execute-step.js";

vi.mock("#compiled/@workflow/core/index.js", () => ({
  getStepMetadata: () => ({ attempt: 2 }),
}));

it("disables Workflow retries for generated program execution", () => {
  expect(
    (executeCodeModeProgramStep as typeof executeCodeModeProgramStep & { maxRetries?: number })
      .maxRetries,
  ).toBe(0);
});

it("fails an abandoned execution without entering the program again", async () => {
  await expect(
    executeCodeModeProgramStep({ run: {} as never, sessionState: {} as never }),
  ).resolves.toEqual({
    outcome: {
      code: "CODE_MODE_EXECUTION_LOST",
      message: "The code-mode execution was abandoned after it began and was not replayed.",
      partialEffectsPossible: true,
      retryable: false,
      status: "failed",
    },
    sessionState: {},
  });
});
