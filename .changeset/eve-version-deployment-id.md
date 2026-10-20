---
"eve": patch
---

The self-hosted build deployment id now derives from the eve version and the agent name instead of the whole build output, so every build of an agent on one eve version shares a `WORKFLOW_DEPLOYMENT_ID`, and only an eve upgrade changes it.
