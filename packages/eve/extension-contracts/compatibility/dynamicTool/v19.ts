import { z } from "#compiled/zod/index.js";
import { defineDynamic, defineTool } from "#public/tools/index.js";

export default defineDynamic({
  events: {
    "session.started": async function* () {
      yield defineTool({
        description: "Start a background export.",
        execution: "background",
        inputSchema: z.object({ exportId: z.string() }),
        execute(input, _ctx, task) {
          return task.delegated({
            executor: { data: { exportId: input.exportId }, kind: "export" },
            receipt: { exportId: input.exportId },
          });
        },
      });
    },
  },
});
