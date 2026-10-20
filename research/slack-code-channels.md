---
issue: TBD
status: in-progress
last_updated: "2026-10-20"
---

# Slack code channels

> **AI status:** Written entirely by AI; human review pending.

> **Implementation status:** Phase 1 is partly in. Shipped: detection, `C123:0` keying, top-level
> replies, session status, stop, the manifest option, and `participants: "owner" | "all"` (default
> `"owner"`). Not yet: `"confirm"`, replies in the user's thread inside a code channel, the
> membership check, and phases 2 and 3.

## Summary

[Slack Code](https://docs.slack.dev/ai/slack-code) gives an agent a dedicated channel per task, a
"code channel", with a session status, a context bar, view tabs (diffs, canvases, HTML, Block
Kit), per-channel slash commands, and an archive step that records a summary. Slack's guidance is
that an agent mentioned in an ordinary channel decides for itself when a request needs more than
one message and opens a code channel for it.

eve cannot do this today. The Slack channel keys every session by `channelId:threadTs` and always
replies in a thread. This plan adds code channel support to the existing `slackChannel()` in three
phases:

1. **Serve code channels.** Recognize a code channel, run one session for the whole channel,
   reply top-level, answer without a mention, drive the session status, and honor
   `agent_session_stopped`.
2. **Fork a thread into a code channel.** A workflow tool lets the model create the code channel
   from the triggering message and start a new eve session there with the thread's conversation as
   `history`. It uses `ctx.to(channel, target).send()` for workflow tools from
   [#5096](https://github.com/vercel/eve/pull/5096) and `history` from
   [#4477](https://github.com/vercel/eve/pull/4477). Apps can also fork from inbound handlers.
3. **Code channel surfaces.** Typed helpers for the context bar, views, rename, slash commands,
   and archive.

This plan stacks on #5096. Phase 2 can ship on #5096 as it stands, with at-least-once delivery.
Making the fork exactly-once and safe against a racing message needs `create()` on `to()` handles
with a first message, which #5096 defers until a caller needs it; code channels are that caller
(see [Forking needs from eve](#forking-needs-from-eve)).

## Why not a separate channel

An early sketch made code channels a second, opt-in channel file:

```ts title="agent/channels/slack-code.ts"
import { slackCodeChannel } from "eve/channels/slack";

export default slackCodeChannel({ credentials });
```

This plan extends `slackChannel()` instead, for three reasons:

- **One app, one route.** Code channel events come from the same Slack app, with the same
  credentials and manifest, on the same Events API request URL as every other message. Two
  channels would have to split one webhook between them, and each would need to know which
  conversations belong to the other.
- **Forking crosses the boundary.** The fork starts in an ordinary thread and continues in a code
  channel. With two channels, the fork becomes a cross-channel hand-off with two configurations
  that must agree on auth, rendering, and credentials.
- **Most behavior is shared.** Rendering, HITL, task cards, attachments, auth derivation, and
  delivery are the same in both kinds of conversation. Only session keying, reply placement,
  status, and mention handling differ.

## Authoring API

Phase 1 is an option on the Slack channel:

```ts title="agent/channels/slack.ts"
import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

export default slackChannel({
  credentials: connectSlackCredentials("slack/my-agent"),
  codeChannels: {
    // Who can start turns in a code channel. Defaults to "confirm".
    participants: "confirm",
  },
});
```

Without `codeChannels`, a mention inside a code channel that a person opened from Slack's UI is
still served as a code channel once the Slack app has the feature enabled. The option controls
the manifest additions, the default for un-mentioned messages, and who can drive the session (see
[Participants](#participants)).

Phase 2 is a workflow tool. A channel cannot contribute tools to the agent, so the app adds the
tool as a file. eve ships a factory for it:

```ts title="agent/tools/open_code_channel.ts"
import { openCodeChannelTool } from "eve/channels/slack/tools";

export default openCodeChannelTool({
  // Optional. Shapes what the code channel session starts from. Defaults to the calling
  // session's transcript. Apps can trim or summarize it here, or return false to start without
  // history (see "Without history" below).
  history: (transcript) => transcript,
});
```

The factory returns a `defineWorkflowTool()` with default instructions adapted from Slack's
guidance (open a code channel for multi-step work, code changes, builds, tests, PRs, or long
output; reply in place for a single message answer). Its body follows the
[fork pattern](../docs/patterns/fork-conversations-into-new-threads.md) from #5096. The factory
lives on a separate entry point because a workflow body must not import the channel module: #5096
names channels by path for the same reason.

Apps that decide in code instead fork from an inbound handler. Those contexts already receive
`from()`:

```ts
const result = await ctx.slack.openCodeChannel({
  name: "Fix the flaky login test",
  message: "Continue the task from the thread. Start by reproducing the failure.",
});

if (result.status === "opened") {
  // result.channelId, result.sessionId
} else {
  // "ineligible" (shared or Slack Connect origin) or "unavailable" (feature disabled,
  // missing scope, permanent Slack error). The caller replies in place.
}
```

## Phase 1: serve code channels

### Detection

A code channel reports `properties.record_channel.record_type === "agent_channel"` from
`conversations.info`. Slack writes this at creation, so it is reliable before the session produces
anything. eve checks it once per conversation the first time a message arrives without a known
session, and stores the result in session state (`kind: "code_channel"`). Channels eve created
itself are marked at creation and skip the lookup.

### Session keying

A code channel is one session. eve keys it by `slackContinuationToken(channelId, "0")`
(`C123:0`), not by thread. Every message in the channel, top-level or threaded, resolves to that
session. Slack does not allow separate agent sessions in a code channel's threads, so this matches
Slack's model.

`"0"` is a placeholder thread, not an empty one. In eve's Slack state, an empty `threadTs` already
means "not anchored yet: the first post starts a thread". A non-empty placeholder keeps that
meaning intact and needs no special case in session state. Slack accepts `thread_ts: "0"` on
`chat.startStream` as "top-level". For other calls, eve's Slack binding omits `thread_ts` when
the thread is `"0"`, and reads channel history with `conversations.history` instead of
`conversations.replies`.

### Reply placement

eve replies top-level in a code channel. A threaded user message gets its reply in that thread.

Today, a binding that starts without a `threadTs` adopts the first posted message as the thread
root (`onThreadTsChanged`), so every later reply would land in that thread. The `"0"` placeholder
is a `threadTs`, so the auto-anchor never runs in a code channel. Streaming uses
`chat.startStream` without `thread_ts` (or with `"0"`), which Slack supports for top-level
messages in code channels.

### Mentions

Slack asks agents to respond in a code channel without a mention. The default message hook treats
every human message in a code channel as a turn, the same way it treats DMs today. An authored
`onMessage` keeps full control. A new `ctx.isCodeChannel()` helper joins `isDMOrPrivateChannel()`
and `isSubscribed()`.

When Slack creates a code channel from an origin message, it posts a context message into the new
channel that quotes the origin (a block with `block_id: "agent_channel_origin_context"`, with
fallback text that starts `Context from #channel`). The default hook skips it, so it never starts
a turn. The forked session already has the origin conversation as history.

### Participants

Code channels admit members of the origin channel, so more people can talk in one than asked for
it. The session's auth comes from whoever started it, so an unrestricted channel lets any member
drive work under the starter's identity. `codeChannels.participants` sets the policy:

| Value       | Behavior                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"owner"`   | Only the person who opened the channel starts turns. Other messages are ignored.                                                                           |
| `"confirm"` | Other members' messages become an approval request to the owner, using eve's existing HITL. A confirmed request runs as a turn; a rejected one is dropped. |
| `"all"`     | Every member starts turns, with auth derived per message as in ordinary threads.                                                                           |

The owner is the person who triggered the fork, or the channel's `creator` for a channel opened
from Slack's UI. eve checks channel membership before admitting a message from a channel it did
not create, because a mention event alone does not prove the speaker can see the channel.

### Session status

eve maps turn lifecycle to `agents.sessions.setStatus` on the channel (no `thread_ts`):

| eve event                                   | Slack status |
| ------------------------------------------- | ------------ |
| `turn.started`                              | `processing` |
| turn settles with nothing pending           | `active`     |
| an input request (question, approval) parks | `suspended`  |

Slack shows its own "Working..." UX while the status is `processing`, so the thread-status line
(`assistant.threads.setStatus`) is not used in code channels. Task cards keep working unchanged.

### Stop

`agent_session_stopped` without `thread_ts` cancels the code channel session's active turn and
suppresses further posts and `agents.*` calls for that turn, as Slack requires. Slack updates the
status itself. The same event with a `thread_ts` in an ordinary channel can cancel that thread's
session once eve adopts thread agent sessions; that is outside this plan.

### Manifest and setup

`defineSlackAppManifest` and `eve add channel/slack` gain an option that adds:

- `features.code_channels.enabled: true` (and `slash_command_url` in phase 3)
- bot scope `code_channels:manage`, plus `channels:history` / `groups:history`
- bot events `message.session` and `agent_session_stopped`

`message.session` delivers messages only from code channels and agent session threads, so an app
gets un-mentioned code channel messages without subscribing to every channel message. Vercel
Connect connectors need the same scopes and events.

### Slack method names

Slack documents the `agents.conversations.*` methods. Some workspaces still answer only the older
`codeChannels.*` names. eve calls `agents.conversations.*` and retries the same call under
`codeChannels.*` when Slack returns `unknown_method`. Only `unknown_method` from the fallback
counts as a permanent failure.

## Phase 2: fork a thread into a code channel

### Flow

`open_code_channel` is a workflow tool. Each platform call and the transcript read run in a
`"use step"` helper, so a replayed workflow reuses their results:

```ts
async execute(input, ctx) {
  "use workflow";
  const auth = ctx.session.auth.current;
  const origin = slackOrigin(auth); // channel_id, thread_ts, message_ts, user_id from Slack's auth
  if (!origin) return { opened: false, reason: "This conversation is not in Slack." };

  if (!(await isOriginEligible(origin))) return { opened: false, reason: "ineligible" }; // step
  const channelId = await createCodeChannel(origin, input.name); // step
  const history = await readTranscript(ctx.session.id); // step
  const { sessionId } = await ctx
    .to<typeof slack>("slack", { channelId, codeChannel: true })
    .send(input.message, { auth, history });
  return { opened: true, channelId, sessionId };
}
```

1. **Check the origin.** Slack Connect origins may include people outside the workspace, and the
   tool does not fork them: `is_ext_shared`, `is_pending_ext_shared`, or a non-empty
   `pending_shared`. `is_shared` and `is_org_shared` also block a fork, except on DMs: Enterprise
   Grid marks every DM as org-shared, so treating that as Slack Connect would block every DM on
   Grid.
2. **Create the channel.** `agents.conversations.create` with the origin channel, the triggering
   message's `ts`, `is_private` copied from the origin (DMs and group DMs count as private), and a
   `session_id`. eve's default Slack auth gains a `message_ts` attribute so the tool can link the
   exact message, not the thread root. Slack treats `session_id` as an idempotency key (at most
   64 characters). The tool uses a hash of team, requester, origin channel, and origin thread, so
   one requester gets one code channel per thread: a retried step, or the model calling the tool
   again, returns the same channel. Right after creation, the tool sets the channel's status to
   `processing`, publishes the [binding](#the-channel-binding), and clears the origin thread's
   status line.
3. **Read the transcript.** Fold the calling session's stream with `transcriptReducer()`, as in
   the fork pattern. It keeps the current turn's user message and finished assistant text, and
   leaves out partial text and tool calls.
4. **Start the session.** `ctx.to("slack", { channelId, codeChannel: true }).send()` with the
   message, the caller's auth, and the history runs the Slack channel's `receive()` in a step (see
   [The code channel target](#the-code-channel-target)).
5. **Point back.** The tool returns the channel, and the model's reply in the thread links to it.
   The source thread stays a normal session for quick questions.

Because the channel is keyed per requester and thread, a second call can reach a channel that
already has its session. With `to().create()` (see [Retries and races](#retries-and-races)) that
returns `created: false`, and the tool reports `alreadyOpen` without delivering anything. Until
then, the tool checks for a binding with a session before sending.

The `ctx.slack.openCodeChannel()` helper for inbound handlers runs the same steps with `from()`.

### The code channel target

The Slack channel's `receive()` maps a target with only a `channelId` to a new thread: it uses a
random continuation token until the first post, then aliases the session to that post's `ts`. A
code channel needs the opposite. `receive()` gains a `codeChannel: true` target that:

- keys the session by `slackContinuationToken(channelId, "0")`, the same address phase 1 uses for
  inbound messages, so later messages in the channel reach the forked session;
- marks session state as a code channel and records its owner for [Participants](#participants);
- seeds the state with `forkedFrom` (source session id and turn), until eve has lineage.

### The channel binding

A code channel needs a durable record of where it came from: the source session, the turn it
forked at, and its owner. eve can keep that record on the channel itself, in the `agent_resource`
property that `agents.conversations.setProperties` sets, so any deployment can read it back with
`conversations.info` and eve needs no store of its own.

The binding must be signed. Slack lets any member of a code channel call
`agents.conversations.*` methods on it, so an unsigned binding could be rewritten to point a
channel at another session. eve HMAC-signs the binding with a deployment secret and ignores a
binding whose signature does not verify. `agent_resource` takes a URL, so the signed binding rides
in the fragment of a link the app chooses, which also gives the channel a useful "open" link.

Signing needs a secret. Without one, eve skips the binding and falls back to `origin_link`, which
Slack writes and members cannot change, but which identifies only the origin message, not the
source session or turn. A binding that fails to publish after the channel exists is reported to
the model like a creation failure: the work continues in the thread, and the model is told not to
retry.

### Retries and races

**Retries.** #5096's `send()` is at-least-once: a step that fails after delivering retries the
delivery. In the thread fork pattern that starts a second thread. Here the address is the code
channel's, so a retry delivers the history and the message to the same session again: the
history appears twice and the first turn runs twice.

**A message can arrive before the seed.** The code channel's address exists only after Slack
creates the channel. If someone posts in the new channel before the tool's `send()`, the inbound
handler starts an unseeded session there. The tool's `send()` then adds history and the message
to that session. Nothing is lost, but the imported turns land after the user's first message.

Both are rare, and phase 2 can ship with them documented. The fix is one rule: **whoever claims
the code channel's address seeds it, in the same call that starts its first turn.**

- `to().create({ history, message })` starts the session, adds history, and runs the first turn as
  one claim. A retry returns `created: false` and delivers nothing.
- The inbound handler never starts an unseeded session in a code channel. On the first message in
  a code channel with no session, it resolves the source session the same way discovery does
  (see [Channels opened from Slack's UI](#channels-opened-from-slacks-ui)) and calls
  `create({ history, message })` with the user's message. If the fork won the claim, the handler
  gets `created: false` and sends the user's message as a normal follow-up.
- If the inbound handler wins, the tool's `create()` returns `created: false` and the tool's
  `message` is not delivered. The user's message drives the first turn instead. The seeded history
  still holds the original request, so the session has the task. The tool result reports this
  case so the source thread's reply stays accurate.

The inbound half works with `from().create()` from #4477 today, apart from the first message.

### Fork, not move

eve could move the source session into the code channel by aliasing the channel's continuation
token to it. This plan forks instead:

- Slack treats a code channel as one session and the origin thread as a separate conversation.
  Moving the session leaves the thread with no session to answer follow-ups.
- A fork lets the code channel use different defaults (for example a sandbox, a different
  turn policy, or code channel instructions) without affecting the thread.
- #5096 already gives workflow tools a supported fork path. Moving a live session between
  addresses mid-turn has no precedent in eve.

### Without history

Some agents keep their working state outside the eve transcript, for example in an external task
or job that the session drives. For them, the code channel session does not need the thread's
conversation, only a pointer to that state. `history: false` starts the code channel session
with just the first message, and the app carries the pointer in the message or in the binding.
Such apps usually want the `queue` turn policy in the code channel, so later messages line up
behind the running work instead of interrupting it.

### Who decides

Slack's guidance is that the model decides from the request and its context, and that users
should not need a command. That is why phase 2 is a workflow tool and not an inbound rule. Apps
that want a deterministic rule call `ctx.slack.openCodeChannel()` from `onAppMention` instead.

The tool returns `opened: false` outside Slack threads and DMs, and inside a code channel. Apps
that want to hide it there can wrap it in a dynamic tool resolver on the Slack channel's metadata.

### Failures

These Slack errors are permanent for the installation or origin, and the tool returns
`unavailable` without retrying: `feature_disabled`, `invalid_agent`, `invalid_origin_link`,
`missing_scope`, `not_allowed_token_type`, `origin_channel_externally_shared`,
`origin_channel_is_file_channel`, `restricted_action`, `unknown_method` (after the
[fallback](#slack-method-names)), `user_not_enabled`. Other errors are retried by the step. When
the tool returns `unavailable` or `ineligible`, the model continues in place, and the tool result
tells it not to retry channel creation on its own.

### Channels opened from Slack's UI

A person can open a code channel from Slack directly, then mention the agent in it. eve detects
the channel and first reads a verified [binding](#the-channel-binding). Without one, it reads
`agent_session.origin_link` (`channel_id`, `ts`). The origin message may be a reply, so eve looks
up that message's `thread_ts` and resolves `slackContinuationToken(origin.channel_id, thread_ts)`.
When a source session exists, eve seeds history from it, as in a fork. A channel with no origin,
or an origin with no session, starts fresh.

eve ignores a code channel that is archived, shared outside the workspace, or not assigned to this
app's bot (`agent_session.encoded_agent_bot_user_ids`). The channel's `creator` becomes its owner
for [Participants](#participants).

The same resolution serves the race in [Retries and races](#retries-and-races). A fork that
published its binding gives discovery the exact source session and turn. Without a binding, a
fork and a discovery can resolve slightly different cut points in the
source session (the fork stops at its own turn; discovery reads up to the current tail). Once
`create()` takes a first message, only the claim winner's history is used.

## Forking needs from eve

#4477 adds `history` on `send()` and `create()`. #5096 adds `ctx.to(channel, target).send()` to
workflow tools, with `history`. Against those:

| Need                               | Status                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Channel operations from a tool     | Covered by #5096 for workflow tools. Ordinary tools stay out, since a retried call could deliver again with no recorded result. |
| Read the calling session's history | Covered: `sessions.attach()` and `transcriptReducer()` in a step, as in #5096's fork pattern.                                   |
| Forking mid-turn                   | Covered: the transcript keeps the current user message and finished assistant text.                                             |
| Exactly-once first turn, race-free | Needs `create()` on `to()` handles with a first `message`. #5096 defers it until a caller needs it.                             |
| Size check against Workflow limits | Needed. See below.                                                                                                              |
| Tool results as text               | Can follow.                                                                                                                     |
| Lineage (`forkedFrom`)             | Can follow. #5096 leaves it to this plan. Until then, the code channel target stores it in state.                               |

**`create()` on `to()` handles.** `to(channel, target).create({ auth, history, message })` runs
`receive()` with a `from()` whose `send()` becomes a `create()` at the same address, and returns
`{ created, sessionId }`. An earlier revision of #5096 had this shape before it was deferred.
`from().create()` gains the same optional first `message`.

**Size check.** #4477 no longer caps history. History travels in the run input, in session state
(when `create()` holds it until the first message), and in the `history.imported` event. The
Workflow payload and event size limits for these are not checked yet, so a very large fork would
fail in the Workflow layer without a clear eve error. eve should check the size up front and fail
with a clear error. A large seeded history is compacted on the first turn, but one larger than
the compaction model's own context window could still fail; the check should account for it. The
tool's `history` option is where apps trim long sessions.

**Tool results as text.** History is text only, so a forked session loses tool calls, which
matters for coding work (files read, commands run, branch names). Until #4477's tool tier lands,
the transcript read can optionally render settled tool calls as short assistant text
(`Ran tool X: <one-line result>`). This is lossy and opt-in.

**Lineage.** A later `forkedFrom: { sessionId, turnId }` on `create()` and `send()` would let
clients, traces, and Agent Runs link the two sessions, with a `session.forked` event on the
source stream.

## Phase 3: code channel surfaces

`ctx.slack.codeChannel` is available when the conversation is a code channel:

```ts
await ctx.slack.codeChannel.setContextBar([
  { key: "repo", label: "acme/billing", icon: "folder", url: "https://github.com/acme/billing" },
  {
    key: "pr",
    label: "PR #42 is open",
    icon: "hierarchy",
    url: "https://github.com/acme/billing/pull/42",
  },
]);
await ctx.slack.codeChannel.setView({
  type: "diff",
  content: diff,
  baseBranch: "main",
  headBranch: "agent/fix",
});
await ctx.slack.codeChannel.rename("Fix flaky login test");
await ctx.slack.codeChannel.archive({ summaryMessageTs });
```

These wrap `agents.conversations.setProperties`, `setView`, `listViews`, `removeView`,
`setCommands`, `archive`, and `agents.sessions.rename`. Context bar items replace the whole set on
each call, so the helper keeps the last set in session state and merges by `key`.

Optional model-facing tools (`set_context_bar`, `publish_diff`, `archive_code_channel`) can follow
once the helpers settle. Archive should stay behind a confirmation, following Slack's suggested
pattern of a summary message plus an archive button.

Per-channel slash commands (`setCommands`) arrive at the manifest's `slash_command_url`. eve
routes them to the existing `onSlashCommand` with the code channel's session target.

## Runtime boundary

- Phase 1 is inside the Slack channel: inbound classification, session keying, binding options,
  default hooks, and renderer defaults. No harness or workflow change.
- Phase 2 adds the Slack `codeChannel` receive target, the `openCodeChannelTool()` factory and its
  steps, and the inbound helper. It runs on #5096's workflow tool `ctx.to()`. `create()` on `to()`
  handles, with a first message, is the one framework addition, and it is additive.
- Phase 3 is Slack API wrappers and state.

## Non-goals

- Moving a live session between Slack addresses.
- Agent session threads (`agents.sessions.*` with `thread_ts`) in ordinary channels. They share
  the status and stop plumbing from phase 1 and can follow separately.
- Carrying sandbox state into the forked session. The code channel session starts its own
  sandbox.
- Automatic archive when a PR merges. Apps can call `archive` from their own hooks.

## Open questions

1. **Binding secret.** Whether eve derives the binding's signing key from an existing deployment
   secret or asks apps for a dedicated one, and what eve does when neither exists.
2. **Confirmed requests' auth.** Under `"confirm"`, whether a confirmed request runs as the owner
   (the session's auth) or as the requester. Running as the owner is simpler but lets the owner
   approve work they could not have asked for in the requester's name.
3. **Chat SDK.** eve's Slack transport calls the Web API directly, so this does not depend on the
   Chat SDK Slack adapter. If the adapter adds code channel APIs, eve should match its naming.
4. **Default `history`.** The whole source transcript can be noisy. A model-written handoff brief
   (one assistant message) may serve the code channel better. The `history` option allows either;
   the default needs evaluation.
5. **Stop semantics.** Whether `agent_session_stopped` should cancel only the active turn or also
   pending tasks the turn started.
6. **Ship before `create()`?** Phase 2 works on #5096 with at-least-once delivery. Decide whether
   to ship it that way first or land `to().create()` together with it.

## Validation plan

- Unit: code channel detection and caching; channel-scoped keying for top-level and threaded
  messages; the `"0"` placeholder omits `thread_ts` and never auto-anchors; Slack's origin context
  message is skipped; status transitions per lifecycle event; `session_id` derivation within 64
  characters; origin eligibility, including Grid DMs marked org-shared; the `unknown_method`
  fallback; permanent error classification; binding signing and rejection of a tampered binding;
  each `participants` policy; the `codeChannel` receive target maps to `C123:0`.
- Integration, modeled on #5096's `channel-handoff.integration.test.ts` against the real
  `slackChannel()` with Slack's API mocked: the tool forks a thread into a code channel, the code
  channel session's first model call sees the thread's history, a later message in the code
  channel reaches only that session, and the source thread keeps answering. With `to().create()`:
  a retried send step runs the first turn once, and a message posted before the fork's `create()`
  still gets the seeded history before it. `agent_session_stopped` cancels the active turn and
  suppresses later posts.
- Conformance: the Slack conformance suite gains code channel cases (top-level replies, no
  mention required, threaded user replies).
- E2E: a fixture agent forks a thread into a code channel against a mocked Slack API and answers
  the first code channel message from the seeded history.
