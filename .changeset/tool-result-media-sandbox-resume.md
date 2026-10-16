---
"eve": patch
---

A file returned by a tool now becomes a "could not be stored" note when the session's sandbox fails to open or take the write, instead of failing the step and replaying its model call and tools.
