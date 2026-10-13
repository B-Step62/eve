---
"eve": patch
---

When a dynamic resolver adds a deferred tool or subagent mid-session, eve now appends a message naming it with its description and saying to call it with `eve__tool`, so the model knows it was added without searching for it.
