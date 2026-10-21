import { z } from "zod";
import { defineWorkflowTool } from "#public/tools/index.js";

// Epoch 96 workflow tools had no `ctx.channel()`; epoch 97 adds it, which is additive.
export default defineWorkflowTool({
  description: "Report the calling session.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    "use workflow";
    return { callId: ctx.callId, sessionId: ctx.session.id };
  },
});
