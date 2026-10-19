---
"eve": patch
---

`call.started` now carries `workflow: true` when a workflow tool's `execute` runs the call in a workflow run of its own. `waiting()` reads a turn waiting on such a call as waiting on work, where it used to read it as the session's own work.
