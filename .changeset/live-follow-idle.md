---
"eve": patch
---

You can now change `followIdle` after `useEveAgent()` mounts, so the session stream stays open only while it matters, such as while someone is typing. React reads it on every render, Vue accepts a ref or getter, Svelte exposes a settable `followIdle` property, and `EveAgentStore` adds `setFollowIdle()`.
