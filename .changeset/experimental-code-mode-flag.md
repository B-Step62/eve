---
"eve": patch
---

Add `experimental.codeMode` to the agent config and replace the experimental `Workflow` model tool with one synchronous `code_mode` surface. Setting it to `"eager"` or `"lazy"` moves eligible executable tools behind a generated JavaScript program that calls them as `tools.name(input)`. `"eager"` inlines every claimed input and output signature; `"lazy"` provides in-program catalog discovery for the same schemas. The AI SDK code-mode executor runs the program in isolated QuickJS and returns its JSON result as an ordinary tool result. Tools with no approval policy or explicit `never()` enter code mode; subagents, dynamically approval-gated tools, background tools, provider-managed tools, and control-plane tools remain direct. `experimental_workflow()` and the separate `Workflow` tool are removed.
