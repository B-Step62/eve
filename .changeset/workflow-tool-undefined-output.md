---
"eve": patch
---

Workflow tools that return objects with `undefined` properties (such as a raw `ctx.ask()` answer) or return nothing no longer fail the calling turn. `undefined` properties are omitted and a missing result becomes `null`, matching native tools.
