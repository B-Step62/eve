import { resumeHook } from "#internal/workflow/runtime.js";
import type { DurableSessionState } from "#execution/durable-session-store.js";

export async function acknowledgeCodeModeRunsStep(
  runs: readonly { readonly hookToken: string }[],
  sessionState: DurableSessionState,
): Promise<void> {
  "use step";

  await Promise.all(runs.map((run) => resumeHook(run.hookToken, { kind: "ready", sessionState })));
}
