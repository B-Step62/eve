---
"eve": patch
---

Add experimental Connect-managed event subscriptions and per-connection webhook receivers. Durable event handlers run independently of conversation sessions; only an explicit `attachSession(...).send(...)` enters a session. Each watch is owned by its handler run, which subscribes after its hook exists and hands over to a fresh run as deliveries accumulate. Requires the matching Connect events bridge.

Return immediately from the durable sleep tool when steering has already interrupted its execution.
