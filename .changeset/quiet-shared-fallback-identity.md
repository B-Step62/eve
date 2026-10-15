---
"eve": patch
---

Tools or connections that share a `toolResultFrom` fallback identity no longer log a warning on every cold start. eve now warns once, only when `toolResultFrom` receives a definition copy it did not load and cannot match it.
