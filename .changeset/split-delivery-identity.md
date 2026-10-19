---
"eve": patch
---

A delivery from another caller that both answers the turn and carries a message no longer settles twice: its answers are taken now as a delivery of their own, and the message keeps the delivery's id until the caller's own turn takes it. A message from the turn's own caller that arrives with an answer a response policy weighs now steers the turn once the policy decides, instead of leaving the rest of the approvals waiting.
