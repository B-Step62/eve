---
"eve": minor
---

Frontend stores and React, Vue, and Svelte bindings can follow a same-session delivery receipt, including one accepted by another store. `followWhile(view)` replaces `followIdle` to control when the stream closes at committed boundaries without interrupting local delivery or resume obligations.
