---
"eve": patch
---

Keep a tool call's input in eval facts when the stream delivers its result before its request, so `t.calledTool(name, { input })` no longer misses the call.
