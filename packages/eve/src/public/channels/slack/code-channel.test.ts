import { describe, expect, it, vi } from "vitest";

import type { SlackApiResponse } from "#public/channels/slack/api.js";
import { createSlackCodeChannel } from "#public/channels/slack/code-channel.js";

function slackApi(
  origin: Record<string, unknown>,
  responses: Record<string, SlackApiResponse> = {},
) {
  return vi.fn(async (operation: string, _body: unknown): Promise<SlackApiResponse> => {
    if (operation === "conversations.info") return { ok: true, channel: origin };
    return responses[operation] ?? { ok: true, channel: { id: "C_CODE" } };
  });
}

const ORIGIN = {
  name: "Fix it",
  originChannelId: "C_ORIGIN",
  originTs: "1.2",
  requester: "slack:T1:U1",
};

describe("createSlackCodeChannel", () => {
  it("opens a channel linked to the origin message, keyed by origin and requester", async () => {
    const request = slackApi({ is_private: true });

    const created = await createSlackCodeChannel({ ...ORIGIN, request });
    const again = await createSlackCodeChannel({ ...ORIGIN, request });

    expect(created).toEqual({ channelId: "C_CODE", isPrivate: true });
    expect(again).toEqual(created);
    const [first, second] = request.mock.calls.filter(
      ([op]) => op === "agents.conversations.create",
    );
    expect(first![1]).toMatchObject({
      is_private: true,
      name: "Fix it",
      origin_link: JSON.stringify({ channel_id: "C_ORIGIN", ts: "1.2" }),
    });
    const sessionId = (first![1] as { session_id: string }).session_id;
    expect(sessionId.length).toBeLessThanOrEqual(64);
    expect((second![1] as { session_id: string }).session_id).toBe(sessionId);
  });

  it.each([
    ["an externally shared channel", { is_ext_shared: true }],
    ["a pending Slack Connect invite", { pending_shared: ["T_OTHER"] }],
    ["a channel shared across orgs", { is_shared: true }],
  ])("refuses %s without retrying", async (_name, origin) => {
    const request = slackApi(origin);

    await expect(createSlackCodeChannel({ ...ORIGIN, request })).rejects.toMatchObject({
      fatal: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forks a Grid DM, which Slack marks org-shared", async () => {
    const request = slackApi({ is_im: true, is_org_shared: true });

    await expect(createSlackCodeChannel({ ...ORIGIN, request })).resolves.toEqual({
      channelId: "C_CODE",
      isPrivate: true,
    });
  });

  it("retries under the older codeChannels method name", async () => {
    const request = slackApi(
      {},
      {
        "agents.conversations.create": { ok: false, error: "unknown_method" },
        "codeChannels.create": { ok: true, channel: { id: "C_LEGACY" } },
      },
    );

    await expect(createSlackCodeChannel({ ...ORIGIN, request })).resolves.toMatchObject({
      channelId: "C_LEGACY",
    });
  });

  it("stops retries for permanent Slack errors, not transient ones", async () => {
    const permanent = slackApi(
      {},
      { "agents.conversations.create": { ok: false, error: "feature_disabled" } },
    );
    const transient = slackApi(
      {},
      { "agents.conversations.create": { ok: false, error: "ratelimited" } },
    );

    await expect(createSlackCodeChannel({ ...ORIGIN, request: permanent })).rejects.toMatchObject({
      fatal: true,
    });
    const error = await createSlackCodeChannel({ ...ORIGIN, request: transient }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("fatal");
  });
});
