---
title: "Fork Conversations into Slack DMs"
description: "Copy a conversation into a new session in someone's Slack direct messages from a workflow tool, so each conversation continues on its own."
---

Forking copies a conversation into a new session somewhere else, such as moving a thread into
someone's Slack direct messages. The new session starts with the conversation so far. After the
fork, each conversation continues on its own: a later message in one never reaches the other.

Build the fork as a [workflow tool](../tools/workflows) so the model decides when to call it. The
tool reads the current conversation and starts a session on the Slack channel with
[`ctx.to(...).create(...)`](../tools/workflows#start-channel-sessions-ctxto).

## Define the tool

This tool lets someone in a Slack thread say "move this to my DMs":

```ts title="agent/tools/fork_to_slack_dm.ts"
import { transcriptReducer } from "eve/client";
import { callSlackApi } from "eve/channels/slack";
import { sessions } from "eve/server";
import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import type slack from "../channels/slack";

export default defineWorkflowTool({
  description: "Continue this conversation in the user's Slack direct messages.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    "use workflow";
    const userId = ctx.session.auth.current?.attributes.user_id;
    if (typeof userId !== "string")
      return { forked: false, reason: "Only Slack users can fork to DMs." };

    const channelId = await openDirectMessage(userId);
    const history = await readTranscript(ctx.session.id);
    const { sessionId } = await ctx.to<typeof slack>("slack", { channelId }).create({
      auth: ctx.session.auth.current,
      history,
      message: "Continue this conversation here.",
    });
    return { forked: true, sessionId };
  },
});

async function openDirectMessage(userId: string) {
  "use step";
  const response = await callSlackApi({
    botToken: process.env.SLACK_BOT_TOKEN,
    operation: "conversations.open",
    body: { users: userId },
  });
  if (!response.ok) throw new Error(`conversations.open failed: ${String(response.error)}`);
  return (response.channel as { id: string }).id;
}

async function readTranscript(sessionId: string) {
  "use step";
  const reducer = transcriptReducer();
  let transcript = reducer.initial();
  for await (const event of sessions.attach(sessionId).stream({ follow: false })) {
    transcript = reducer.reduce(transcript, event);
  }
  return transcript.messages;
}
```

The tool:

1. Reads the caller's Slack user id. `user_id` is set on the auth of calls that come from Slack, so
   the tool declines calls from other channels.
2. Opens a direct message with `conversations.open`, which needs the `im:write` scope. The example
   reads `SLACK_BOT_TOKEN`. If your channel uses Vercel Connect, pass the connector's `botToken`
   resolver to `callSlackApi` instead.
3. Reads the conversation from the session's stream with `transcriptReducer()`.
4. Starts a session in the DM from that transcript with `create`, which runs the first turn with
   `message`.

Each Slack call and the transcript read run in a `"use step"` helper, so a replayed workflow reuses
their results instead of calling Slack again.

## What the new session sees

The new session's first model call sees the transcript as earlier user and assistant turns,
followed by `message`. The transcript keeps user messages and finished assistant replies,
including the message that asked for the fork. It leaves out tool calls, files, reasoning, and
replies the agent hasn't finished. See
[Start from prior history](../channels/eve#start-from-prior-history) for how history joins a
session.

After the fork, the thread and the DM are separate sessions:

- A message in the thread reaches only the thread's session.
- A reply in the DM thread reaches only the DM's session.
- Both keep the conversation from before the fork.

The DM session runs the root agent with the auth you pass, here the caller's. The agent's first
reply in the DM becomes a thread root, and replies in that thread continue the fork. A new
top-level message in the DM starts a separate session. The built-in DM handler answers without a
mention, and needs the `message.im` event and the `im:history` scope; see
[Message hooks](../channels/slack#message-hooks).

## Calling the tool again

A Slack target with only a `channelId` starts a new thread, so each call opens a new conversation
in the DM. To stop the model from forking the same conversation twice, say so in the tool's
`description`, or record each fork in your app and check for one before opening the DM.

## Fork elsewhere

The same shape works for any channel whose `receive` hook accepts a target. Replace the Slack steps
with whatever finds the destination, and pass that channel's name and target to `ctx.to`. To fork
from an earlier point, stop reading the stream at the `turn.started` event of the first turn to
leave out.
