---
"eve": minor
---

Delivery receipts now expose reusable `stream()` and `result()` reads, with cancellation limited to the reader. Session observations are opaque snapshots inspected through `eve/events`, and session operations live in `eve/sessions`.
