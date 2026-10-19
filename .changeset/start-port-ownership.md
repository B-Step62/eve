---
"eve": patch
---

`eve start` now fails with `Port N on H is already in use.` and exits non-zero when another process holds the requested port, instead of reporting that process as its ready server.
