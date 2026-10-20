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
conversation into someone's direct messages, or a Slack thread into a code channel
([#5092](https://github.com/vercel/eve/pull/5092)): the model decides inside a tool call, and the
new session must live at a channel address, answer people there, and outlive the tool.

Routes and schedules already reach channels with `ctx.to(channel, target).send()`, which goes
through the target channel's `receive()` hook. This proposal:

1. Adds `ctx.to(channel, target).send()` to workflow tool bodies, run as a durable step.
2. Adds `history` to `to().send()`, so a handoff can carry prior conversation.

Stacked on [#4477](https://github.com/vercel/eve/pull/4477), which adds `history`.

## Authoring API

```ts title="agent/tools/fork_to_dm.ts"
import { defineWorkflowTool } from "eve/tools";
import type slack from "../channels/slack";
import { z } from "zod";

export default defineWorkflowTool({
  description: "Continue this conversation in the user's direct messages.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    "use workflow";
    const channelId = await openDirectMessage(ctx.session.auth.current); // "use step"
    const history = await readTranscript(ctx.session.id); // "use step"
    return await ctx.to<typeof slack>("slack", { channelId }).send("Continue here.", {
      auth: ctx.session.auth.current,
      history,
    });
  },
});
```

The workflow body names the channel by its path-derived name (`agent/channels/slack.ts` →
`"slack"`), as `ctx.agent()` names agents. Importing a channel module into a workflow body would
evaluate the channel in the workflow sandbox. A type-only import keeps the target typed.

`send()` starts a session seeded with `history` when the target address is free, and adds
`history` and the message to the owning session otherwise. In a workflow body it returns
`{ sessionId }`, since session handles cannot cross the step boundary.

## Semantics

### `history` through `receive()`

`receive(input, { from })` keeps deciding the address and state for a target. Its input gains
`history`, and eve adds it to the channel's `from(address).send()` when the channel passes no
`history` of its own. Existing `receive()` hooks need no changes. Routes and handler-form schedules
get `history` too, since they share the `to()` builder.

### Workflow tool steps

Each `send()` runs as one `"use step"`. The step loads the deployment's root channels, finds the
channel by name, and runs its `receive()` with root-agent channel operations, outside the calling
session's context. Replay reuses the recorded result.

- **Ownership.** The session belongs to the channel, not the run. It has no parent, reports nothing
  back to the run, and does not end when the run finishes. This is the difference from
  `ctx.agent()`.
- **Auth.** `auth` is required and explicit, as in routes. Pass `ctx.session.auth.current` to act
  as the caller.
- **Subagents.** Only workflow tools on the root agent can use `ctx.to()`; it throws in a subagent's
  tool. Channels belong to the root agent, so the session runs the root agent with all its tools, and
  a subagent must not reach tools its parent withheld from it.
- **Retries.** `send()` delivers at least once: a step that fails after delivering retries the
  delivery.
- **Errors.** An unknown channel name, or a channel without `receive()`, throws in the step with the
  channel names available.

`ctx.to()` exists only on workflow tool bodies. Ordinary tools run inside the turn's step, where a
retried call could deliver again with no recorded result to reuse.

## Non-goals

- `create()` on `to()` handles: starting a session only when the target is free, so a spawn never
  joins an existing conversation and is safe to retry. It can follow once a caller needs it.
- Lineage (`forkedFrom`) on the new session. #5092 proposes it separately.
- `ctx.to()` in ordinary tools, hooks, or channel events.
- Reading another session's history. Workflow tools use `sessions.attach()` with
  `transcriptReducer()` in a step.

## Open questions

1. **Name.** `ctx.to()` matches routes and schedules. `ctx.channel()` would read as a sibling of
   `ctx.agent()`.
