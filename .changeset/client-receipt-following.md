---
"eve": minor
---

Frontend stores and React, Vue, and Svelte bindings can follow another store's same-session receipts; `followWhile(view)` replaces `followIdle` without interrupting local delivery or resume obligations. Historical catch-up never invokes `onFinish` or replays execution-error callbacks, including for locally submitted work.
