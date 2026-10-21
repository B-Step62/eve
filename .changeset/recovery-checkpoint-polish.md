---
"eve": patch
---

After a lost turn checkpoint, keep typed answers out of reconstructed model history, retain history after a failed compaction, and consume an imported create-history seed only once. Restore completed structured replies to the next turn's history without carrying over the previous turn's output schema; avoid re-resolving dynamic connections for ordinary non-turn publications.
