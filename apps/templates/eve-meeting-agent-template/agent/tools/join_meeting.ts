import { defineTool } from "eve/tools";
import { z } from "zod";

import { meetingBotId } from "../lib/meeting.js";
import { createBot } from "../lib/recall.js";

export default defineTool({
  description:
    "Send the meeting bot to a Zoom, Google Meet, or Microsoft Teams meeting. The host may need to admit it.",
  inputSchema: z.object({
    meetingUrl: z.url({ protocol: /^https$/ }).describe("The meeting's join link."),
  }),
  async execute({ meetingUrl }, ctx) {
    if (meetingBotId(ctx.session.auth)) {
      throw new Error("Join other meetings from outside a meeting.");
    }
    const bot = await createBot({ meetingUrl, webhookUrl: webhookUrl() });
    return { botId: bot.id, status: "joining" };
  },
});

function webhookUrl(): string {
  const explicit = process.env.RECALL_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  // Preview URLs sit behind Deployment Protection, which blocks Recall.
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (host) return `https://${host}/recall/webhook`;
  throw new Error(
    "Set RECALL_WEBHOOK_URL to a public HTTPS URL for /recall/webhook, such as a tunnel to `eve dev`.",
  );
}
