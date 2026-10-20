/**
 * Slack code channels: a dedicated channel per agent task, served as one eve
 * session. See https://docs.slack.dev/ai/slack-code.
 */
import { createLogger, logError } from "#internal/logging.js";
import type { SlackApiResponse } from "#public/channels/slack/api.js";

const log = createLogger("slack.code-channel");

/**
 * Placeholder thread for a code channel session (`C123:0`). Non-empty, so the
 * binding never auto-anchors on its first post; Slack calls omit `thread_ts`.
 */
export const CODE_CHANNEL_THREAD_TS = "0";

type SlackRequest = (operation: string, body: unknown) => Promise<SlackApiResponse>;

const MAX_CACHED_CHANNELS = 1_000;
// Slack sets a channel's kind at creation, so a lookup holds for the process.
const codeChannelCache = new Map<string, boolean>();

/**
 * Whether the conversation is a code channel. A failed lookup (for example a
 * missing `channels:read` scope) counts as not a code channel and is retried
 * on the next message.
 */
export async function isSlackCodeChannel(
  channelId: string,
  request: SlackRequest,
): Promise<boolean> {
  const cached = codeChannelCache.get(channelId);
  if (cached !== undefined) return cached;
  let response: SlackApiResponse;
  try {
    response = await request("conversations.info", { channel: channelId });
  } catch (error) {
    logError(log, "conversations.info threw", error, { channelId });
    return false;
  }
  if (response.ok !== true) {
    log.warn("conversations.info returned not-ok", { channelId, error: response.error });
    return false;
  }
  const channel = response.channel as
    | { readonly properties?: { readonly record_channel?: { readonly record_type?: unknown } } }
    | undefined;
  const codeChannel = channel?.properties?.record_channel?.record_type === "agent_channel";
  if (codeChannelCache.size >= MAX_CACHED_CHANNELS) {
    codeChannelCache.delete(codeChannelCache.keys().next().value!);
  }
  codeChannelCache.set(channelId, codeChannel);
  return codeChannel;
}

/**
 * Whether a message is the origin quote Slack posts when it creates a code
 * channel from a message. It is context, not a request.
 */
export function isSlackCodeChannelOriginContext(raw: Record<string, unknown>): boolean {
  const blocks = raw.blocks;
  return (
    Array.isArray(blocks) &&
    blocks.some(
      (block) =>
        (block as { readonly block_id?: unknown } | null)?.block_id ===
        "agent_channel_origin_context",
    )
  );
}

/** Slack agent session lifecycle states. */
export type SlackSessionStatus = "active" | "processing" | "suspended";

/** Sets a code channel's session status. Failures are logged, never thrown. */
export async function setSlackCodeChannelStatus(
  request: SlackRequest,
  channelId: string,
  status: SlackSessionStatus,
): Promise<void> {
  try {
    const response = await request("agents.sessions.setStatus", { channel_id: channelId, status });
    if (response.ok !== true) {
      log.warn("agents.sessions.setStatus returned not-ok", { error: response.error, status });
    }
  } catch (error) {
    logError(log, "agents.sessions.setStatus threw", error, { channelId });
  }
}

/** Slack's `thread_ts` for a session thread: omitted for top-level posts. */
export function slackThreadTsParam(threadTs: string): string | undefined {
  return threadTs === "" || threadTs === CODE_CHANNEL_THREAD_TS ? undefined : threadTs;
}
