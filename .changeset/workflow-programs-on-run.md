---
"eve": patch
---

The `workflow` tool now runs generated programs on the bundled `run` runtime directly instead of through `@ai-sdk/code-mode`. Programs behave the same, but sandbox error codes and messages now come from `run`, and stack traces reference `run.js` instead of `code-mode.js`. Each start or resume of a program may now spend 30 seconds running JavaScript and 5 minutes in total, instead of 30 seconds in total; time spent waiting for child agents counts toward neither. A program paused by an earlier eve version cannot resume on this one and fails with `WORKFLOW_PROGRAM_CONTINUATION_UNSUPPORTED`.
