---
"eve": patch
---

Add the `open_code_channel` tool (`openCodeChannel()` from `eve/channels/slack/tools`), which moves a Slack conversation into a new Slack code channel and continues the work there with the conversation so far. Slack auth now carries the triggering message's `message_ts`.
