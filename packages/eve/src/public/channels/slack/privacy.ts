import type { SlackApiResponse } from "#public/channels/slack/api.js";

type SlackConversationPrivacy = "private" | "public" | "unknown";

interface SlackConversationInput {
  readonly channelId: string;
  readonly raw: Readonly<Record<string, unknown>> | undefined;
  readonly request: (operation: string, body: unknown) => Promise<SlackApiResponse>;
}

export function readSlackConversationPrivacy(
  raw: Readonly<Record<string, unknown>> | undefined,
): SlackConversationPrivacy {
  switch (raw?.channel_type) {
    case "im":
    case "mpim":
    case "group":
      return "private";
    case "channel":
      return "public";
    default:
      return "unknown";
  }
}

export async function resolveSlackConversationPrivacy(
  input: SlackConversationInput,
): Promise<SlackConversationPrivacy> {
  const eventPrivacy = readSlackConversationPrivacy(input.raw);
  if (eventPrivacy !== "unknown") return eventPrivacy;

  try {
    return readConversationInfoPrivacy(
      await input.request("conversations.info", { channel: input.channelId }),
    );
  } catch {
    return "unknown";
  }
}

export async function isPrivateSlackConversation(input: SlackConversationInput): Promise<boolean> {
  return (await resolveSlackConversationPrivacy(input)) !== "public";
}

function readConversationInfoPrivacy(response: SlackApiResponse): SlackConversationPrivacy {
  if (response.ok !== true || !isRecord(response.channel)) return "unknown";

  const channel = response.channel;
  if (channel.is_im === true || channel.is_mpim === true || channel.is_private === true) {
    return "private";
  }
  return channel.is_private === false ? "public" : "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
