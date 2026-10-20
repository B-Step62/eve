import { describe, expect, it, vi } from "vitest";

import type { SlackApiResponse } from "#public/channels/slack/api.js";
import { createSlackCodeChannel } from "#public/channels/slack/code-channel.js";

function slackApi(response: SlackApiResponse = { ok: true, channel_id: "C_CODE" }) {
  return vi.fn(async (_operation: string, _body: unknown): Promise<SlackApiResponse> => response);
}

const ORIGIN = {
  name: "Fix it",
  originChannelId: "C_ORIGIN",
  originTs: "1.2",
  requester: "slack:T1:U1",
};

describe("createSlackCodeChannel", () => {
  it("opens a channel linked to the origin message, keyed by origin and requester", async () => {
    const request = slackApi();

    await expect(createSlackCodeChannel({ ...ORIGIN, request })).resolves.toBe("C_CODE");
    await createSlackCodeChannel({ ...ORIGIN, request });

    const calls = request.mock.calls as [string, Record<string, string>][];
    const [operation, first] = calls[0]!;
    const second = calls[1]![1];
    expect(operation).toBe("agents.conversations.create");
    expect(first).toEqual({
      name: "Fix it",
      origin_channel_id: "C_ORIGIN",
      origin_message_ts: "1.2",
      session_id: expect.stringMatching(/^[0-9a-f]{32}$/u),
    });
    expect(second.session_id).toBe(first.session_id);
  });

  it("stops retries for permanent Slack errors, not transient ones", async () => {
    const permanent = slackApi({ ok: false, error: "origin_channel_externally_shared" });
    const transient = slackApi({ ok: false, error: "ratelimited" });

    await expect(createSlackCodeChannel({ ...ORIGIN, request: permanent })).rejects.toMatchObject({
      fatal: true,
    });
    const error = await createSlackCodeChannel({ ...ORIGIN, request: transient }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("fatal");
  });
});
