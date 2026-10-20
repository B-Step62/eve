import { turns } from "eve/events";
import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic((ctx) =>
  // Six seed turns precede expansion.
  turns(ctx.view).length > 6
    ? defineInstructions({
        role: "system",
        content: `EXPANDED_POLICY ${"Use the configured catalog policy. ".repeat(140)}`,
      })
    : null,
);
