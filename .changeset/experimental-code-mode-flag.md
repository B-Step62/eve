---
"eve": patch
---

Add `experimental.codeMode` to the agent config and replace the experimental `Workflow` model tool with one workflow-backed `code_mode` surface. Setting it to `"eager"` or `"lazy"` moves eligible executable tools behind a generated JavaScript program that calls them as `tools.name(input)`. `"eager"` inlines every claimed signature; `"lazy"` provides in-program catalog discovery. Each outer call starts one dedicated Workflow run. The generated program enters at most once: normal errors return `CODE_MODE_EXECUTION_FAILED`, while an abandoned/crashed execution returns non-retryable `CODE_MODE_EXECUTION_LOST` with partial effects possible. Tools with no approval policy or explicit `never()` enter code mode; subagents, dynamically approval-gated tools, background tools, provider-managed tools, and control-plane tools remain direct. `experimental_workflow()` and the separate `Workflow` tool are removed.
