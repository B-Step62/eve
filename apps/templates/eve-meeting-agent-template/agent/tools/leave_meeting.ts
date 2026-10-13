import { defineTool } from "eve/tools";
import { z } from "zod";

import { meetingBotId } from "../lib/meeting.js";
import { leaveCall } from "../lib/recall.js";

export default defineTool({
  description: "Leave the current meeting. Only works inside a meeting.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const botId = meetingBotId(ctx.session.auth);
    if (!botId) throw new Error("This session is not in a meeting.");
    await leaveCall(botId);
    return { status: "leaving" };
  },
});
