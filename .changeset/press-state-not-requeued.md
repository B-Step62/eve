---
"eve": patch
---

When another person's button press settled the last approval of a turn, the session could fail after the turn ended with a session event contract error. The press's channel state is no longer queued as a separate delivery after its answer is taken.
