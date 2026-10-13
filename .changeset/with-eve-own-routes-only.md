---
"eve": patch
---

`withEve` now writes only eve's own routes to `.vercel/output/config.json`. Routes from Next.js or an earlier build are no longer carried forward, so they can't be appended to the deployed route table a second time.
