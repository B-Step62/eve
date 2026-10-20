import { latestTaskResult } from "@eve-e2e/config/mock-script";
import type { MockModelRequest, MockModelResponse } from "eve/evals";

import { LEASE_DIRECTIVE, LEASE_STEP_INPUT_TOKENS } from "../../constants.js";

// The parent starts two workers in one step, and each reads three 15M pages.
// Worker a crosses its 40M window first and asks. Worker b is still on its slow
// second page when that prompt is approved. Without a tree-wide renewal, b
// then asks on its own, and the parent asks once a's spend reaches it.

const WORKERS = ["lease-worker-a", "lease-worker-b"] as const;

/** Whether a message is the fan-out request. */
export function isLeaseDirective(message: string): boolean {
  return message.startsWith(`${LEASE_DIRECTIVE} `);
}

/** The parent: starts both workers in one step, waits for both, and reports their answers. */
export function respondAsLeaseParent(request: MockModelRequest): MockModelResponse | string {
  const started = new Set(request.toolResults.map((result) => result.name));
  if (!WORKERS.every((worker) => started.has(worker))) {
    return {
      toolCalls: WORKERS.map((worker) => ({
        id: `lease-start-${worker}`,
        input: { message: "Read every survey page, then report." },
        name: worker,
      })),
    };
  }
  const results = WORKERS.map((worker) => latestTaskResult(request, worker));
  if (results.some((result) => result === undefined)) {
    const waits = request.toolResults.filter((result) => result.name === "eve__task_wait").length;
    return {
      toolCalls: [{ id: `lease-wait-${String(waits)}`, input: {}, name: "eve__task_wait" }],
    };
  }
  return { text: `LEASE-REPLY ${results.join(" | ")}`, usage: { inputTokens: 1, outputTokens: 1 } };
}

/** A worker: reads `pages` pages, each a model call with LEASE_STEP_INPUT_TOKENS of new input. */
export function respondAsLeaseWorker(name: string, pages: number) {
  return (request: MockModelRequest): MockModelResponse => {
    const read = request.toolResults.filter((result) => result.name === "lease-read-page").length;
    if (read < pages) {
      return {
        toolCalls: [
          { id: `${name}-page-${String(read)}`, input: { page: read }, name: "lease-read-page" },
        ],
        usage: { inputTokens: LEASE_STEP_INPUT_TOKENS, outputTokens: 10 },
      };
    }
    return {
      text: `${name} read ${String(read)} pages`,
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  };
}
