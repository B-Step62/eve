---
"eve": patch
---

A durable step interrupted after publishing but before checkpointing now ends its session with `STEP_INTERRUPTED` instead of guessing private history or replaying work. Existing facts retain their positions and outcomes, orphaned hooks are not replayed, and a step that published nothing can still retry normally.
