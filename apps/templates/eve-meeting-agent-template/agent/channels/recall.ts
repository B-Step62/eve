import { defineChannel, POST } from "eve/channels";

import { meetingAuth } from "../lib/meeting.js";
import { botName, parseMeetingEvent, sendChatMessage, verifyRecallWebhook } from "../lib/recall.js";

const MAX_WEBHOOK_BYTES = 256 * 1024;

interface RecallChannelState {
  botId: string | null;
}

export default defineChannel<RecallChannelState, { state: RecallChannelState }>({
  // Utterances arrive every few seconds. Steering would keep restarting the
  // model, so let each turn finish and batch whatever arrived meanwhile.
  turnPolicy: "queue",
  state: { botId: null },
  context: (state) => ({ state }),

  routes: [
    POST("/recall/webhook", async (request, { from, waitUntil }) => {
      const secret = process.env.RECALL_WORKSPACE_VERIFICATION_SECRET?.trim();
      if (!secret) {
        return new Response("RECALL_WORKSPACE_VERIFICATION_SECRET is not set.", { status: 503 });
      }
      if (Number(request.headers.get("content-length") ?? 0) > MAX_WEBHOOK_BYTES) {
        return new Response("payload too large", { status: 413 });
      }

      const body = await request.text();
      if (!verifyRecallWebhook(request.headers, body, secret)) {
        return new Response("unauthorized", { status: 401 });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        return new Response("invalid JSON", { status: 400 });
      }

      const event = parseMeetingEvent(payload);
      // The bot's own chat messages come back as chat events.
      if (!event || event.speaker === botName()) return new Response(null, { status: 204 });

      // Speech is labeled with its speaker so a spoken "approve" never matches
      // an open prompt's option. A chat message goes through as typed, so
      // replying "1" in chat answers the prompt the bot posted.
      const message = event.source === "speech" ? `${event.speaker}: ${event.text}` : event.text;
      const context =
        event.source === "speech"
          ? `${event.speaker} said this out loud in the meeting.`
          : `${event.speaker} wrote this in the meeting chat.`;

      // Recall retries any non-2xx response every second, so acknowledge first.
      waitUntil(
        from(event.botId)
          .send(message, {
            auth: meetingAuth(event.botId),
            context: [context],
            state: { botId: event.botId },
          })
          .catch((error: unknown) => console.error("Recall delivery failed", error)),
      );
      return new Response(null, { status: 204 });
    }),
  ],

  events: {
    async "message.completed"(event, channel) {
      if (event.finishReason === "tool-calls" || !event.message || !channel.state.botId) return;
      await sendChatMessage(channel.state.botId, event.message);
    },

    // Meeting chat has no buttons, so post the first request with numbered
    // options; eve answers it with the next chat reply that names one.
    async "input.requested"(event, channel) {
      const request = event.requests[0];
      if (!request || !channel.state.botId) return;
      const options = (request.options ?? []).map(
        (option, index) => `${index + 1}. ${option.label}`,
      );
      const instruction = options.length > 0 ? "Reply in chat with a number." : "Reply in chat.";
      await sendChatMessage(
        channel.state.botId,
        [request.prompt, ...options, instruction].join("\n"),
      );
    },

    async "turn.failed"(event, channel) {
      if (event.terminal || !channel.state.botId) return;
      await sendChatMessage(channel.state.botId, "Sorry, I hit an error. Please ask again.");
    },
  },
});
