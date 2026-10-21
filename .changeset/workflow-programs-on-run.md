---
"eve": patch
---

The `workflow` tool now runs generated programs on the bundled `run` runtime directly instead of through `@ai-sdk/code-mode`. Programs behave the same, but sandbox error codes and messages now come from `run`, and stack traces reference `run.js` instead of `code-mode.js`. Each start or resume of a program may now run JavaScript for up to 30 seconds and take up to 5 minutes in total. Before, `run` 2.1.2 stopped busy programs after a fixed number of interrupt checks, roughly 0.3 to 2.5 seconds of JavaScript depending on the code, and reported it as a 30 second timeout. Time spent waiting for child agents counts toward neither limit. A program paused by an earlier eve version cannot resume on this one and fails with `WORKFLOW_PROGRAM_CONTINUATION_UNSUPPORTED`.
