import { defineTool } from "eve/tools";
import { checkAvailability, reservationSlot } from "../lib/reservations";

// The runtime tool name comes from the filename, so the model sees this as
// `check_availability`. Tool filenames must be snake_case ASCII.
export default defineTool({
  description:
    "Check whether Juniper Table can seat a party at a date and time. Returns nearby open times when the request is unavailable.",
  inputSchema: reservationSlot,
  async execute(slot) {
    return checkAvailability(slot);
  },
});
