---
"eve": patch
---

Cancelling a task while it waits on a person's answer now runs the cancel in the same turn. Previously the turn paused on the task's open question and the `eve__task_cancel` call never ran.
