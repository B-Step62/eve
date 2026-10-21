import { sleep } from "#compiled/@workflow/core/index.js";
import {
  reportLateAgentSessionRetirementFailureStep,
  tryRetireLateAgentSessionStep,
  type LateRetirementInput,
} from "#execution/agent-sessions/late-retirement-steps.js";

const RETIREMENT_ATTEMPTS = 60;
const RETIREMENT_INTERVAL_MS = 1_000;

/** Independently retires a late child without holding the parent's next turn. */
export async function lateAgentSessionRetirementWorkflow(
  input: LateRetirementInput,
): Promise<void> {
  "use workflow";

  for (let attempt = 0; attempt < RETIREMENT_ATTEMPTS; attempt++) {
    if (await tryRetireLateAgentSessionStep(input)) return;
    if (attempt + 1 < RETIREMENT_ATTEMPTS) await sleep(RETIREMENT_INTERVAL_MS);
  }
  await reportLateAgentSessionRetirementFailureStep(input.sessionId);
}
