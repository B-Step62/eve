/**
 * Slack code channels: a dedicated channel per agent task, served as one eve
 * session. See https://docs.slack.dev/ai/slack-code.
 */
import { createHash } from "node:crypto";

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
/** A failed lookup is retried after this, so a broken install doesn't call Slack per message. */
const FAILED_LOOKUP_TTL_MS = 60_000;
// Slack sets a channel's kind at creation, so a lookup holds for the process.
const codeChannelCache = new Map<string, boolean | { readonly failedAtMs: number }>();

/**
 * Whether the conversation is a code channel. A failed lookup counts as not a
 * code channel, so its messages get per-thread sessions until a retry
 * succeeds a minute later.
 */
export async function isSlackCodeChannel(
  channelId: string,
  request: SlackRequest,
): Promise<boolean> {
  const cached = codeChannelCache.get(channelId);
  if (typeof cached === "boolean") return cached;
  if (cached !== undefined && Date.now() - cached.failedAtMs < FAILED_LOOKUP_TTL_MS) return false;
  let codeChannel: boolean;
  try {
    const response = await request("conversations.info", { channel: channelId });
    if (response.ok !== true) {
      log.error(
        response.error === "missing_scope"
          ? "conversations.info needs the channels:read and groups:read scopes to detect code channels; reinstall the Slack app"
          : "conversations.info failed; treating the channel as an ordinary channel",
        { channelId, error: response.error },
      );
      cacheLookup(channelId, { failedAtMs: Date.now() });
      return false;
    }
    const channel = response.channel as
      | { readonly properties?: { readonly record_channel?: { readonly record_type?: unknown } } }
      | undefined;
    codeChannel = channel?.properties?.record_channel?.record_type === "agent_channel";
  } catch (error) {
    logError(log, "conversations.info threw; treating the channel as an ordinary channel", error, {
      channelId,
    });
    cacheLookup(channelId, { failedAtMs: Date.now() });
    return false;
  }
  cacheLookup(channelId, codeChannel);
  return codeChannel;
}

function cacheLookup(channelId: string, value: boolean | { readonly failedAtMs: number }): void {
  codeChannelCache.delete(channelId);
  if (codeChannelCache.size >= MAX_CACHED_CHANNELS) {
    codeChannelCache.delete(codeChannelCache.keys().next().value!);
  }
  codeChannelCache.set(channelId, value);
}

// Errors from Slack's docs that won't change on retry; anything else is retried by the calling step.
const PERMANENT_CREATE_ERRORS: ReadonlySet<string> = new Set([
  "access_denied",
  "channel_not_viewable",
  "feature_disabled",
  "invalid_agent",
  "invalid_arguments",
  "invalid_origin_link",
  "missing_scope",
  "no_permission",
  "no_shared_workspace",
  "not_allowed_token_type",
  "origin_channel_externally_shared",
  "origin_channel_is_file_channel",
  "restricted_action",
  "team_access_not_granted",
  "user_not_enabled",
]);

/**
 * Opens a code channel from an origin message. Slack invites the origin
 * message's author, matches the origin's privacy, and refuses Slack Connect
 * origins. `session_id` makes the call idempotent, so a retry with the same
 * origin and requester returns the same channel. Throws an error marked
 * `fatal` when Slack refuses permanently, so the calling step doesn't retry.
 */
export async function createSlackCodeChannel(input: {
  readonly name: string;
  readonly originChannelId: string;
  readonly originTs: string;
  /** Principal the channel is opened for; one channel per requester and origin message. */
  readonly requester: string;
  readonly request: SlackRequest;
}): Promise<string> {
  const sessionId = createHash("sha256")
    .update(`${input.originChannelId}:${input.originTs}:${input.requester}`)
    .digest("hex")
    .slice(0, 32);
  const response = await input.request("agents.conversations.create", {
    name: input.name,
    origin_channel_id: input.originChannelId,
    origin_message_ts: input.originTs,
    session_id: sessionId,
  });
  if (response.ok !== true) throw slackFailure("agents.conversations.create", response.error);
  const channelId = response.channel_id;
  if (typeof channelId !== "string" || channelId.length === 0) {
    throw new Error("Slack did not return a channel id for the new code channel.");
  }
  cacheLookup(channelId, true);
  return channelId;
}

function slackFailure(method: string, error: unknown): Error {
  const code = typeof error === "string" ? error : "unknown_error";
  const message = `Slack ${method} failed: ${code}`;
  return PERMANENT_CREATE_ERRORS.has(code) ? fatalError(message) : new Error(message);
}

// The Workflow SDK doesn't retry a step error marked `fatal`; channels stay free of its imports.
function fatalError(message: string): Error {
  return Object.assign(new Error(message), { fatal: true });
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
