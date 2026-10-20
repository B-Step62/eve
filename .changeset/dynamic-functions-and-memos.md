---
"eve": minor
---

Replace lifecycle-based dynamic capabilities with `defineDynamic(fn)` and `ctx.memo(key, fn)`; callbacks and schemas rebuild as ordinary code without durable-callback helpers, and a delegated session reads its lineage as `ctx.session.parent`. Hooks keep event handlers, gain committed session context and stable occurrence keys, and fail the active turn on unhandled errors. A call waiting for approval or sign-in fails if its dynamic tool, connection, or subagent changed, and dynamic-capability extensions must be rebuilt.
