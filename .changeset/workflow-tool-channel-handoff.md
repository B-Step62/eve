---
"eve": patch
---

Workflow tools can start or reach sessions on the agent's channels with `ctx.to(channel, target).send(...)`, such as forking a conversation into someone's direct messages. Cross-channel `to().send()` also accepts `history`, which eve adds to the destination session.
