---
issue: TBD
status: in-progress
last_updated: "2026-10-20"
---

# Channel sessions from workflow tools

> **AI status:** Written entirely by AI; human review pending.

## Summary

A workflow tool can open a session with another agent through `ctx.agent()`, but it cannot start
or reach a session that belongs to a channel. That blocks model-driven handoffs such as forking a
Slack thread into a code channel ([#5092](https://github.com/vercel/eve/pull/5092)): the model
decides to fork inside a tool call, and the new session must live at a Slack address, answer
people there, and outlive the tool.

Routes and schedules already reach channels with `ctx.to(channel, target).send()`, which goes
through the target channel's `receive()` hook. This proposal:

1. Adds `ctx.to(channel, target)` to workflow tool bodies, with each operation run as a durable
   step.
2. Adds `.create()` next to `.send()` on every `to()` handle. `create()` starts a session only when
   the target address is free, so a spawn never takes over an existing conversation and is safe
   to retry.
3. Adds `history` to both operations, and an optional first `message` to `create()` on channel
   addresses, so a spawn can seed prior conversation and start working in one atomic call.

Stacked on [#4477](https://github.com/vercel/eve/pull/4477), which adds `history` and
`from(address).create()`.

## Authoring API

```ts title="agent/tools/open_code_channel.ts"
import { defineWorkflowTool } from "eve/tools";
import type slack from "../channels/slack";
import { z } from "zod";

export default defineWorkflowTool({
  description: "Move multi-step work into a dedicated Slack code channel.",
  inputSchema: z.object({ name: z.string(), message: z.string() }),
  async task({ name, message }, ctx) {
    "use workflow";
    const channelId = await createCodeChannel(name); // "use step"
    const history = await readTranscript(ctx.session.id); // "use step"
    const { created, sessionId } = await ctx.to<typeof slack>("slack", { channelId }).create({
      auth: ctx.session.auth.current,
      history,
      message,
    });
    return { channelId, created, sessionId };
  },
});
```

The workflow body names the channel by its path-derived name (`agent/channels/slack.ts` →
`"slack"`), as `ctx.agent()` names agents. Importing a channel module into a workflow body would
evaluate the channel in the workflow sandbox. A type-only import keeps the target typed.

### Two verbs

| Operation                               | Address free                                                            | Address owned                       | Step retried after it succeeded     |
| --------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| `.send(message, { auth, history? })`    | starts a session seeded with `history`, runs the turn                   | continues that session              | message may be delivered twice      |
| `.create({ auth, history?, message? })` | starts a session seeded with `history`; runs a turn only with `message` | `created: false`, nothing delivered | `created: false`, nothing delivered |

`send()` hands work to a conversation that may already exist, such as posting a long workflow's
result into the user's thread. `create()` spawns. In a workflow body, `send()` returns
`{ sessionId }` and `create()` returns `{ created, sessionId }`, since session handles cannot cross
the step boundary.

The same handle gains `.create()` and `history` in routes and handler-form schedules, which share
the `to()` builder. Schedule subscription callbacks keep their send-only `to()`.

### `message` on `create()`

`from(address).create({ auth, history?, message? })` gains an optional first message. With the
address free, eve starts the session with the history and the message together, the same start a
`send()` to a free address performs. With the address owned, or claimed concurrently, nothing is
delivered and `created` is `false`. Without `message`, `create()` behaves as in #4477: the session
waits for its first message.

Following `create()` with `send()` instead would reintroduce both failure modes this avoids: a
retried step that sends twice, and a message that continues a session someone else started.

## Semantics

### `receive()` stays send-shaped

`receive(input, { from })` keeps deciding the address and state for a target. Its input gains
`history`. eve decides the verb by wrapping the `from()` it passes:

- In a `send()` handoff, `from(address).send()` behaves as today.
- In a `create()` handoff, `from(address).send(message, options)` performs
  `create({ ...options, message })` and returns the session. eve reports `created` to the caller.

In both, eve adds the handoff's `history` to the channel's `send()` when the channel did not pass
its own. Existing `receive()` hooks need no changes, and the create guarantee does not depend on
each channel implementing it. Side effects a `receive()` performs before delivering, such as
posting a seed message, still run when the address turns out to be owned.

A `create()` handoff whose `receive()` delivers nothing through `from().send()` fails with an error
naming the channel.

### Workflow tool steps

Each `ctx.to()` operation runs as one `"use step"`. The step loads the deployment's root channels,
finds the channel by name, and runs its `receive()` with root-agent channel operations, outside the
calling session's context. Replay reuses the recorded result.

- **Ownership.** The new session belongs to the channel, not the run. It has no parent, reports
  nothing back to the run, and does not end when the run finishes. This is the difference from
  `ctx.agent()`.
- **Auth.** `auth` is required and explicit, as in routes. Pass `ctx.session.auth.current` to act
  as the caller.
- **Subagents.** Workflow tools in subagents can use `ctx.to()`. Channels belong to the root agent,
  so the session runs the root agent.
- **Retries.** `create()` is retry-safe. `send()` delivers at least once: a step that fails after
  delivering retries the delivery.
- **Errors.** An unknown channel name, or a channel without `receive()`, throws in the step with the
  channel names available.

`ctx.to()` exists only on workflow tool bodies. Ordinary tools run inside the turn's step, where a
retried call could deliver again with no recorded result to reuse.

## Non-goals

- Lineage (`forkedFrom`) on the new session. #5092 proposes it separately.
- Idempotency keys for `send()`.
- `ctx.to()` in ordinary tools, hooks, or channel events.
- Reading another session's history. Workflow tools use `sessions.attach()` with
  `transcriptReducer()` in a step.

## Open questions

1. **Name.** `ctx.to()` matches routes and schedules. `ctx.channel()` would read as a sibling of
   `ctx.agent()`.
2. **Seed side effects.** Whether `receive()` should learn that a handoff is a `create()`, so a
   channel can skip work such as posting a seed message when the address is owned.
