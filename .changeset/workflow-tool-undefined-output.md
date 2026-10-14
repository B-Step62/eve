---
"eve": patch
---

Workflow tools that return objects with `undefined` properties (such as a raw `ctx.ask()` answer) or return nothing no longer fail the calling turn. `undefined` properties are omitted and a missing result becomes `null`, matching native tools. Workflow tools that return values that aren't plain JSON, such as a `Date` or `Map`, now fail the tool call with a serialization error instead of passing a lossy result to the model.
