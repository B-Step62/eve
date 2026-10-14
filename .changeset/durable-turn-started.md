---
"eve": patch
---

A turn now waits for its `turn.started` event to be durable on the session stream before running hooks or calling the model, and does no work if that append fails. A client that treats `turn.started` as the record that its delivery was accepted can stop resending once it sees the event.
