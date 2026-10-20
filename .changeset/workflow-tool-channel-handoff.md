---
"eve": patch
---

Workflow tools can start or reach sessions on the agent's channels with `ctx.to(channel, target)`, such as forking work into a new Slack channel. Cross-channel `to()` handles gain `create()`, which starts a session only when none owns the target, and both operations accept `history`. `create()` on channel addresses accepts a first `message` that runs only when the call starts the session.
