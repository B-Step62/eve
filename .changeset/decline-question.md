---
"eve": minor
---

A person can decline a question instead of answering it: send `{ requestId, decline: true }` in `inputResponses`. The session reports `input.resolved` with `outcome: "declined"`, `ctx.ask()` resolves as `{ status: "declined" }`, and `ask_question` returns `{ status: "declined" }`, which tells the model to continue without the answer and not to ask again.
