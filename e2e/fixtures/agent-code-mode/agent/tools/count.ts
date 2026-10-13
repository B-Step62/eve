import { defineTool } from "eve/tools";
import { z } from "zod";
const counters = new Map<string, number>();
export default defineTool({
  description: "Increment and return this session's invocation count.",
  inputSchema: z.strictObject({}),
  execute: (_input, ctx) => {
    const count = (counters.get(ctx.session.id) ?? 0) + 1;
    counters.set(ctx.session.id, count);
    return count;
  },
});
