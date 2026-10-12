---
"eve": patch
---

The default message reducer now shows a question or approval relayed from a subagent or workflow run in the assistant message of the call it serves. Previously it opened an assistant message under the asking session's own `turnId`, which could put that message, and the turns after it, out of order in `messages`.
