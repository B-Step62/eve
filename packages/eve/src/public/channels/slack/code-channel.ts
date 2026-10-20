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

// Errors that won't change on retry; anything else is retried by the calling step.
const PERMANENT_CREATE_ERRORS: ReadonlySet<string> = new Set([
  "feature_disabled",
  "invalid_agent",
  "invalid_origin_link",
  "missing_scope",
  "not_allowed_token_type",
  "origin_channel_externally_shared",
  "origin_channel_is_file_channel",
  "restricted_action",
  "unknown_method",
  "user_not_enabled",
]);

/** A code channel {@link createSlackCodeChannel} opened. */
export interface SlackCreatedCodeChannel {
  readonly channelId: string;
  readonly isPrivate: boolean;
}

/**
 * Opens a code channel from an origin message. Slack treats `session_id` as an
 * idempotency key, so a retry with the same origin and requester returns the
 * same channel. Throws an error marked `fatal` when the origin can't fork or
 * Slack refuses permanently, so the calling step doesn't retry.
 */
export async function createSlackCodeChannel(input: {
  readonly name: string;
  readonly originChannelId: string;
  readonly originTs: string;
  /** Principal the channel is opened for; one channel per requester and origin message. */
  readonly requester: string;
  readonly request: SlackRequest;
}): Promise<SlackCreatedCodeChannel> {
  const info = await input.request("conversations.info", { channel: input.originChannelId });
  if (info.ok !== true) throw slackFailure("conversations.info", info.error);
  const origin = (info.channel ?? {}) as Record<string, unknown>;
  if (!isEligibleOrigin(origin)) {
    throw fatalError(
      "This conversation is shared outside the workspace, so it can't open a code channel.",
    );
  }
  const isPrivate = origin.is_private === true || origin.is_im === true || origin.is_mpim === true;
  const sessionId = createHash("sha256")
    .update(`${input.originChannelId}:${input.originTs}:${input.requester}`)
    .digest("hex")
    .slice(0, 32);
  const response = await callCodeChannelsMethod(input.request, "create", {
    is_private: isPrivate,
    name: input.name,
    origin_link: JSON.stringify({ channel_id: input.originChannelId, ts: input.originTs }),
    session_id: sessionId,
  });
  if (response.ok !== true) throw slackFailure("agents.conversations.create", response.error);
  const channelId = createdChannelId(response);
  if (channelId === undefined) {
    throw new Error("Slack did not return a channel id for the new code channel.");
  }
  cacheLookup(channelId, true);
  return { channelId, isPrivate };
}

/**
 * Slack Connect origins may include people outside the workspace. Enterprise
 * Grid marks every DM as org-shared, so sharing flags don't block a DM.
 */
function isEligibleOrigin(origin: Record<string, unknown>): boolean {
  if (origin.is_ext_shared === true || origin.is_pending_ext_shared === true) return false;
  if (Array.isArray(origin.pending_shared) && origin.pending_shared.length > 0) return false;
  const isDirect = origin.is_im === true || origin.is_mpim === true;
  return isDirect || (origin.is_shared !== true && origin.is_org_shared !== true);
}

/** Some workspaces still answer only the older `codeChannels.*` method names. */
async function callCodeChannelsMethod(
  request: SlackRequest,
  method: string,
  body: Record<string, unknown>,
): Promise<SlackApiResponse> {
  const response = await request(`agents.conversations.${method}`, body);
  if (response.ok === true || response.error !== "unknown_method") return response;
  return await request(`codeChannels.${method}`, body);
}

function createdChannelId(response: SlackApiResponse): string | undefined {
  const channel = response.channel;
  if (typeof channel === "string") return channel;
  const id = (channel as { readonly id?: unknown } | undefined)?.id ?? response.channel_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
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
