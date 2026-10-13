---
"eve": patch
---

`withEve({ agents })` now throws an actionable error when an agent root isn't an eve app root, for example an `agent/` directory without its own `package.json` that depends on eve. Previously `eve build` and `eve dev` quietly resolved such a root to a parent app and built the wrong agent.
