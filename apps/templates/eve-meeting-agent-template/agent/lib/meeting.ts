const AUTHENTICATOR = "recall-webhook";

/**
 * Everyone in a meeting shares one principal, the bot. Recall's speaker names
 * come from the meeting platform and prove nothing, and one shared principal
 * lets the queue turn policy batch a burst of utterances into one turn.
 */
export function meetingAuth(botId: string) {
  return {
    attributes: { botId },
    authenticator: AUTHENTICATOR,
    issuer: "recall",
    principalId: `recall:bot:${botId}`,
    principalType: "service",
  };
}

type SessionAuth = {
  readonly initiator: {
    readonly authenticator: string;
    readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  } | null;
};

/** The Recall bot that started this session, or `undefined` outside a meeting. */
export function meetingBotId(auth: SessionAuth): string | undefined {
  const initiator = auth.initiator;
  if (initiator?.authenticator !== AUTHENTICATOR) return undefined;
  const botId = initiator.attributes.botId;
  return typeof botId === "string" ? botId : undefined;
}
