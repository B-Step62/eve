---
"eve": patch
---

`send().result()`, `eve invoke`, eval `turn.message` and `finalMessage`, and workflow or MCP agent invocations now report every reply a turn wrote, in order and separated by a blank line. A turn that replies, waits on its tasks, and replies again reports both replies, matching what Slack posted; before, the text written before the wait was dropped.
