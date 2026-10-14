---
"eve": patch
---

Add experimental Connect-managed event subscription actions, per-connection webhook receivers, and durable event/lifecycle callbacks for existing sessions. Subscription results expose eve's local retirement alongside Connect's status. OpenTelemetry spans link verified deliveries, durable callback attempts, and callback-created turns, and report discovery and subscription outcomes without recording event content. Uses the released AI SDK managed-events types and runtime; requires the matching Connect SDK and backend with authorized source URL support.

Keep the session deadline stable across workflow replay and compaction handoffs.

Return immediately from the durable sleep tool when steering has already interrupted its execution.
