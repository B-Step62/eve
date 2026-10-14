import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { checkAvailability, reservationSlot } from "../lib/reservations";

// The voice app shows the approval on screen and reads it aloud. The caller
// answers with a button or by saying an option; the voice model never answers.
export default defineTool({
  description:
    "Book a table at Juniper Table. Check availability first and confirm the details with the caller.",
  inputSchema: reservationSlot.extend({
    name: z.string().min(1).describe("Name for the reservation."),
    notes: z
      .string()
      .optional()
      .describe("Occasions, allergies, or seating requests, in the caller's words."),
  }),
  approval: always(),
  async execute({ name, notes, ...slot }) {
    const availability = checkAvailability(slot);
    if (!availability.available) return { booked: false, ...availability };

    // Sample only: nothing is stored. Write the booking to your reservation
    // system here and return its confirmation code.
    const confirmation = crypto.randomUUID().slice(0, 6).toUpperCase();
    return { booked: true, confirmation, name, notes, ...slot };
  },
});
