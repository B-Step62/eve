import { defineDynamic, defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";

export default defineDynamic(() => ({
  dynamic_scoped_approval: defineTool({
    description:
      "Echoes a scope after approving that scope. Only call when explicitly asked for dynamic_scoped_approval.",
    inputSchema: z.object({ scope: z.string() }),
    approval: once({ key: (input) => input.scope }),
    execute: (input) => ({ scope: input.scope }),
  }),
}));
