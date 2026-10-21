---
"eve": patch
---

Keep typed human answers out of reconstructed model history after a lost turn checkpoint, and retain the previous history when a failed manual compaction loses its checkpoint. Avoid re-resolving dynamic connections for ordinary non-turn publications without uncheckpointed events; document why an uncheckpointed connection selection still ends the session.
