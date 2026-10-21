---
"eve": patch
---

Cancelling an agent task now ends it immediately instead of leaving it available for another message. Late child-open notices and questions are discarded, children opened after cancellation are stopped, and a cancelled task's run no longer delays the next turn.
