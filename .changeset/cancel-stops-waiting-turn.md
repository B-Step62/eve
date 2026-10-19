---
"eve": patch
---

A cancel that arrives while a turn waits on its calls now stops that turn as its cause, and its delivery settles as `applied`. Before, the turn could stop first and the cancel then settled as `ignored`, as if it had found nothing to stop.
