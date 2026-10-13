---
"eve": patch
---

Admit each session delivery ID once. A re-sent delivery, including one that arrives after a deployment handoff, starts no second turn and does not interrupt the running one.

A create with a reserved `sessionId` returns `202` only once run storage records the session for that delivery. It returns `409 session_exists` when the session is recorded for a different delivery, and `503 session_not_recorded` when run storage has not recorded it yet. The create response no longer carries `existing`.
