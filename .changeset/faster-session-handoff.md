---
"eve": patch
---

Reduce session handoff waits by validating idle state inside the workflow and registering coordination hooks together. Preserve inbox ownership until all registrations succeed and clean up partial registrations on failure.
