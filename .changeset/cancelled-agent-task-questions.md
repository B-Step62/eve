---
"eve": patch
---

Cancelling a resumable agent task now withdraws the questions and session-limit prompts its agent had relayed to the session: the stream reports `input.resolved` with `outcome: "cancelled"`, so clients and channels stop showing them as open. Any request a subagent withdraws on its own, not only a tool approval, now closes in its parent session.
