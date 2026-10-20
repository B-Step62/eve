---
title: "Fork Conversations into Direct Messages"
description: "Copy a shared conversation into a new session in someone's direct messages from a workflow tool, so each conversation continues on its own."
---

Forking copies a conversation into a new session somewhere else, such as moving a shared channel
thread into one person's direct messages. The new session starts with the conversation so far.
After the fork, each conversation continues on its own: a later message in one never reaches the
other.

The pattern works on any channel that has direct messages and a `receive` hook. This page uses
Slack as the example and lists what changes for other platforms.

## How it works

Build the fork as a [workflow tool](../tools/workflows) so the model decides when to call it. The
tool runs three steps:

1. **Find the person's direct conversation.** Read their platform user id from
   `ctx.session.auth.current`, then look up or open a direct conversation with them. This is the
   only platform-specific step.
2. **Read the current conversation.** Fold the session's stream with `transcriptReducer()`.
3. **Start the forked session.** Call
   [`ctx.to(channel, target).create(...)`](../tools/workflows#start-channel-sessions-ctxto) with
   the transcript as `history` and a first `message`. The channel's `receive` hook maps the target
   to its session, and `message` runs the fork's first turn.

## Define the tool

This Slack version lets someone in a shared thread say "move this to my DMs":

```ts title="agent/tools/fork_to_dm.ts"
import { transcriptReducer } from "eve/client";
import { callSlackApi } from "eve/channels/slack";
import { sessions } from "eve/server";
import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import type slack from "../channels/slack";

export default defineWorkflowTool({
  description: "Continue this conversation in the user's direct messages.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    "use workflow";
    const userId = ctx.session.auth.current?.attributes.user_id;
    if (typeof userId !== "string")
      return { forked: false, reason: "No platform user to message." };

    const channelId = await openDirectMessage(userId);
    const history = await readTranscript(ctx.session.id);
    const { created, sessionId } = await ctx.to<typeof slack>("slack", { channelId }).create({
      auth: ctx.session.auth.current,
      history,
      message: "Continue this conversation here.",
    });
    if (!created) return { forked: false, reason: "A conversation is already open there." };
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

The default auth of the built-in Slack, Discord, Telegram, and Teams channels sets `user_id` to
the person's platform id, so step 1 starts the same way on each. A call from a channel without a
platform user, such as a schedule, gets `forked: false`.

On Slack, `conversations.open` opens the direct message and needs the `im:write` scope. The
example reads `SLACK_BOT_TOKEN`. If your channel uses Vercel Connect, pass the connector's
`botToken` resolver to `callSlackApi` instead.

Each platform call and the transcript read run in a `"use step"` helper, so a replayed workflow
reuses their results instead of calling the platform again.

## Other platforms

Replace `openDirectMessage`, the channel name, and the target. The rest of the tool stays the same.

| Channel  | Target for the direct conversation                             | How to get it                                                                                                  |
| -------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Slack    | `{ channelId }`                                                | `conversations.open` with the user id, as above.                                                               |
| Discord  | `{ channelId }`                                                | Open a DM channel with Discord's Create DM API, using the user id as the recipient.                            |
| Telegram | `{ chatId }`                                                   | A private chat's id is the user's id. Telegram only lets a bot message people who have started a chat with it. |
| Teams    | `{ serviceUrl, conversationId, conversationType: "personal" }` | Store the `serviceUrl` and conversation id when the person messages the bot in a personal chat.                |

Each channel's page documents its full target, under its proactive sessions section. For example,
see [Slack proactive sessions](../channels/slack#proactive-sessions) and
[Telegram](../channels/telegram).

## What the new session sees

The fork's first model call sees the transcript as earlier user and assistant turns, followed by
`message`. The transcript keeps user messages and finished assistant replies, including the message
that asked for the fork. It leaves out tool calls, files, reasoning, and replies the agent hasn't
finished. See [Start from prior history](../channels/eve#start-from-prior-history) for how history
joins a session.

After the fork, the shared conversation and the direct conversation are separate sessions:

- A message in the shared conversation reaches only its session.
- A message in the fork reaches only the fork's session.
- Both keep the conversation from before the fork.

The fork runs the root agent with the auth you pass, here the caller's. People continue it under
that channel's usual rules for which messages join a session. On Slack, the agent's first reply in
the DM becomes a thread root and replies in that thread continue the fork, while a new top-level DM
starts a separate session. The built-in Slack DM handler answers without a mention, and needs the
`message.im` event and the `im:history` scope; see [Message hooks](../channels/slack#message-hooks).

## Calling the tool again

`create` starts a session only when no session owns the target. Otherwise it returns
`created: false`, sends nothing, and the tool reports that it didn't fork. Whether a target is
already owned depends on how the channel keys direct conversations:

- A Slack target with only a `channelId` starts a new thread, so each call starts a new fork.
- A Telegram private chat is one session per chat. While the person already has a session with the
  bot there, the fork can't start.

To stop the model from forking the same conversation twice, say so in the tool's `description`, or
record each fork in your app and check for one before opening the direct conversation.

## Fork from an earlier point

To leave out the latest turns, stop reading the stream at the `turn.started` event of the first
turn to leave out. The same tool shape also forks into any other target a channel's `receive` hook
accepts, such as a new shared channel.
