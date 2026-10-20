import { defineChannel } from "#public/channels/index.js";
import { defineSchedule } from "#public/schedules/index.js";

const reports = defineChannel({
  routes: [],
  receive(input, { from }) {
    return from("nightly-report").send(input.message, { auth: input.auth });
  },
});

// Existing schedules use runtime-created session handles without preparation.
export default defineSchedule({
  cron: "0 2 * * *",
  async run({ to, appAuth, waitUntil }) {
    const session = await to(reports, {}).send("Prepare the nightly report.", { auth: appAuth });
    const events = await session.getEventStream({ startIndex: 0 });
    waitUntil(events.cancel());
  },
});
