---
"eve": patch
---

Recover durable session events at their original positions when a step retries without its checkpoint. Previously settled turns keep their outcome; open interrupted turns fail with `STEP_INTERRUPTED` without replaying model or tool work, while non-turn operations whose private state cannot be recovered stop the session rather than restoring incorrect history.
