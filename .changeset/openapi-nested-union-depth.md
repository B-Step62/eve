---
"eve": patch
---

Fix OpenAPI connection tools rejecting valid deeply nested union input. Schema depth now counts subschema levels instead of every JSON level, and a `oneOf` whose branch had to be truncated becomes `anyOf`.
