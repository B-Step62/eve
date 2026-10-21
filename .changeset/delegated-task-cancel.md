---
"eve": patch
---

Cancelling an agent task now ends it immediately instead of leaving it available for another message; late notices and questions are discarded, and its run no longer delays the next turn. Late local children are asked to finalize their own work and resource cleanup independently, with bounded durable retries while their inbox boots; usage from the cancelled run still counts toward session limits as it arrives.
