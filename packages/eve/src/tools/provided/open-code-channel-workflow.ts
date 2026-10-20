import { transcriptReducer } from "#client/index.js";
import { sessions } from "#public/server/index.js";
import type { SlackChannel } from "#public/channels/slack/index.js";
import type { WorkflowToolContext } from "#public/tools/index.js";
import type {
  OpenCodeChannelInput,
  OpenCodeChannelOutput,
} from "#tools/provided/open-code-channel.js";

/**
 * Forks the calling Slack conversation into a new code channel. Reaches the
 * Slack channel by name, since a workflow body must not import a channel.
 */
export async function executeOpenCodeChannel(
  input: OpenCodeChannelInput,
  ctx: WorkflowToolContext,
): Promise<OpenCodeChannelOutput> {
  "use workflow";

  const auth = ctx.session.auth.current;
  const {
    channel_id: channelId,
    message_ts: originTs,
    thread_ts: originThreadTs,
  } = auth?.attributes ?? {};
  if (
    auth?.authenticator !== "slack-webhook" ||
    typeof channelId !== "string" ||
    typeof originTs !== "string"
  ) {
    return { reason: "This conversation is not a Slack message.", status: "unavailable" };
  }
  // A code channel session's thread is the `"0"` placeholder, from its first turn on.
  if (originThreadTs === "0") {
    return { reason: "This conversation is already a code channel.", status: "unavailable" };
  }

  // The issuer names the workspace whose installation received the message.
  const installationTeamId = auth.issuer?.startsWith("slack:")
    ? auth.issuer.slice("slack:".length)
    : undefined;
  const history = await readSessionTranscript(ctx.session.id);
  // Slack refusals fail the call with Slack's error, which the model can relay.
  const { sessionId } = await ctx.sendToChannel<SlackChannel>("slack", input.message, {
    target: {
      channelId,
      codeChannel: { name: input.name, originTs },
      ...(installationTeamId !== undefined && { installationTeamId }),
    },
    auth,
    history,
  });
  return { sessionId, status: "opened" };
}

/** Bounds the step result and the history the code channel session imports. */
const MAX_HISTORY_MESSAGES = 40;

async function readSessionTranscript(sessionId: string) {
  "use step";
  const reducer = transcriptReducer({ maxMessages: MAX_HISTORY_MESSAGES });
  let transcript = reducer.initial();
  for await (const event of sessions.attach(sessionId).stream({ follow: false })) {
    transcript = reducer.reduce(transcript, event);
  }
  return transcript.messages;
}
