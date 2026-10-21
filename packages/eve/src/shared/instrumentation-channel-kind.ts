import type { ChannelKind } from "#shared/channel-info.js";

const FRAMEWORK_CHANNEL_KINDS: ReadonlySet<string> = new Set(["http", "schedule", "subagent"]);

export function isInstrumentationChannelKind(kind: string): kind is ChannelKind {
  return kind.startsWith("channel:") || FRAMEWORK_CHANNEL_KINDS.has(kind);
}

export function normalizeInstrumentationChannelKind(rawKind: string | undefined): ChannelKind {
  return rawKind !== undefined && isInstrumentationChannelKind(rawKind) ? rawKind : "unknown";
}
