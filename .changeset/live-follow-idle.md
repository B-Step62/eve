---
"eve": patch
---

React's `useEveAgent()` now reads `followIdle` on every render, so you can follow the session only while it matters, for example while someone is typing. Changing it to `true` opens the session stream from its cursor, and changing it to `false` closes the stream once the session is idle. `EveAgentStore` adds `setFollowIdle()` for the same control.
