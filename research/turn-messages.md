---
issue: https://github.com/vercel/eve/issues/4754
status: proposed
last_updated: "2026-10-14"
---

# Turn messages

## Summary

A turn can send the person more than one reply. In a root session, the model can reply, wait on
its tasks, and reply again, and Slack posts both replies. The turn result reports only one of them.
`send().result()`, eval turns, and MCP `agent_get` reduce a turn to one `message` string: the
reply written before a task wait is cleared, and the last reply wins. When the resumed turn writes
nothing more, for example after a `no_reply` tool call, the result has no reply at all, although
the person read one (#4754).

Evals must judge what the agent sent. This proposal replaces the single `message` string with
`messages`: every reply, in order, as a record that keeps the reply's text and why it ended.

## Current behavior

| Surface                      | Field                          | Holds                                      |
| ---------------------------- | ------------------------------ | ------------------------------------------ |
| `send().result()`            | `message: string \| undefined` | last reply after the latest `turn.waiting` |
| eval turn                    | `message: string \| undefined` | same                                       |
| eval task result             | `finalMessage: string \| null` | last turn's `message`                      |
| `eve invoke` JSON            | `outcome.message`              | same                                       |
| MCP `agent_start/get/update` | `result?: JsonValue`           | same, always a string                      |

A reply is a `message.completed` whose `finishReason` is not `"tool-calls"`. Child and schedule
sessions report text written before a task wait as `"tool-calls"`, so it is narration there. Root
sessions report it as a reply, and channels post it.

## Proposed API

```ts
/** One reply the agent sent in a turn. Tool-call narration is not a reply. */
export interface TurnMessage {
  readonly text: string;
  /** Why the reply ended. `"length"` and `"content-filter"` mark a cut-off reply. */
  readonly finishReason: "stop" | "length" | "content-filter" | "error" | "other";
}
```

| Surface                        | Field                                   |
| ------------------------------ | --------------------------------------- |
| `send().result()`, `respond()` | `messages: readonly TurnMessage[]`      |
| eval turn                      | `messages: readonly TurnMessage[]`      |
| eval task result               | `finalMessages: readonly TurnMessage[]` |
| `eve invoke` JSON              | `outcome.messages`                      |
| MCP `agent_start/get/update`   | `messages: TurnMessage[]`               |

`message`, `finalMessage`, and MCP `result` are removed. No surface joins replies into one
string: a join loses the boundary between replies, and any separator is arbitrary. A caller that
needs one string joins the texts itself.

The eval task result's `output` falls back to `finalMessages` when the turn has no structured
`data`.

## Semantics

- **Order.** `messages` lists replies in the order their `message.completed` events were emitted.
- **Scope.** `messages` holds the replies of the events one response read, not the whole turn.
  `result()` that stops at a question carries the replies written before it. `respond()` carries
  only the replies written after the answer.
- **Silent turns.** A turn that writes no reply reports `messages: []`. Replies never carry over
  from an earlier turn.
- **In progress.** MCP `working`, `input_required`, and `authorization_required` carry the replies
  written so far.
- **Cut-off replies.** A reply ended by the output limit or the content filter stays in
  `messages` with its `finishReason`, so an eval can fail a truncated answer.
- **Structured output.** `data` stays separate. `messages` never holds schema-validated output.

## Eval authoring

```ts
const turn = await t.send("What's the weather in Paris?");

turn.messageIncludes("Sunny"); // any reply's text
t.check(
  turn.messages.map((message) => message.text),
  equals(["Checking the forecast.", "Sunny, 72F"]),
);
t.check(turn.messages.at(-1)?.finishReason, equals("stop"));

const response = turn.messages.map((message) => message.text).join("\n\n");
t.judge({ state: { response, reference }, questions });
```

`messageIncludes` reads the turn's `messages`. Today it reads every `message.completed`, including
tool-call narration. Exact checks compare the list, so a test fails when the agent splits or
merges replies.

## Prior art

- [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents) return
  `result["messages"]`, a list of typed messages. Each AI message carries its content and a
  `finish_reason` in `response_metadata`.
- [AI SDK `generateText`](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) returns
  `steps`, each with its text and `finishReason`. Its top-level `text` is the final step only.

## Scope

- `ctx.agent(...).result().message` is unchanged. A child's reply reaches the parent as task
  output, a single string without a finish reason. Carrying records there needs the task transport
  to change and is a separate proposal.
- Stream events, channel delivery, and Slack rendering are unchanged.

## Open questions

- Name: `TurnMessage` or `Reply`.
- Whether `"error"` and `"other"` replies belong in `messages`, or only in the event stream.
