---
"eve": patch
---

`send().result()`, `eve invoke`, eval `turn.message` and `finalMessage`, and workflow or MCP agent invocations now keep the reply a turn wrote before a task wait or a question when the resumed turn writes no further reply. A reply written after the wait still replaces it.
