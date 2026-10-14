---
"eve": patch
---

Add experimental Connect-managed event subscriptions and per-connection webhook receivers. Durable event handlers run independently of conversation sessions; only an explicit `attachSession(...).send(...)` enters a session. Creator-scoped bindings use a durable document backend, defaulting to private Vercel Blob. Requires the matching Connect events bridge.

Return immediately from the durable sleep tool when steering has already interrupted its execution.
