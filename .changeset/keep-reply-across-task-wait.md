---
"eve": patch
---

`send().result()`, `eve invoke`, eval `turn.message` and `finalMessage`, and workflow or MCP agent invocations now keep the reply a turn wrote before a task wait when the resumed turn writes no further reply; a reply written after the wait still replaces it. A `result()` that stops at a question, and an `agent_get` polled during any wait, now also report the reply written before the wait.
