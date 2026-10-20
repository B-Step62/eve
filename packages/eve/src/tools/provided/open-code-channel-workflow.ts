import { transcriptReducer } from "#client/index.js";
import { sessions } from "#public/server/index.js";
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
  // A code channel session's thread is the `"0"` placeholder.
  if (originThreadTs === "0") {
    return { reason: "This conversation is already a code channel.", status: "unavailable" };
  }

  const history = await readSessionTranscript(ctx.session.id);
  try {
    const { sessionId } = await ctx.sendToChannel("slack", input.message, {
      target: {
        channelId,
        codeChannel: {
          name: input.name,
          originTs,
        },
      },
      auth,
      history,
    });
    return { sessionId, status: "opened" };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : String(error),
      status: "unavailable",
    };
  }
}

async function readSessionTranscript(sessionId: string) {
  "use step";
  const reducer = transcriptReducer();
  let transcript = reducer.initial();
  for await (const event of sessions.attach(sessionId).stream({ follow: false })) {
    transcript = reducer.reduce(transcript, event);
  }
  return transcript.messages;
}
