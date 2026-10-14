// Sample reservation book for Juniper Table. Replace these helpers with calls
// to your reservation system; the tools only depend on their signatures.

import { z } from "zod";

const MAX_PARTY_SIZE = 8;

const FIRST_SEATING = 17 * 60;
const LAST_SEATING = 21 * 60 + 30;
const SEATING_INTERVAL = 30;

export const reservationSlot = z.object({
  date: z.iso.date().describe("Reservation date as YYYY-MM-DD."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .describe("Reservation time as 24-hour HH:MM, for example 19:30."),
  partySize: z.number().int().min(1).max(20).describe("Number of guests."),
});

export type ReservationSlot = z.infer<typeof reservationSlot>;

export type Availability =
  | { available: true; date: string; time: string; partySize: number }
  | { available: false; reason: string; alternatives: string[] };

export function checkAvailability({ date, time, partySize }: ReservationSlot): Availability {
  if (partySize > MAX_PARTY_SIZE) {
    return {
      available: false,
      reason: `Parties larger than ${MAX_PARTY_SIZE} book private dining by email at events@junipertable.example.`,
      alternatives: [],
    };
  }

  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 1) {
    return { available: false, reason: "Juniper Table is closed on Mondays.", alternatives: [] };
  }

  const open = openSeatings(weekday, partySize);
  const requested = toMinutes(time);
  if (open.includes(requested)) return { available: true, date, time, partySize };

  const alternatives = open
    .toSorted((a, b) => Math.abs(a - requested) - Math.abs(b - requested))
    .slice(0, 3)
    .toSorted((a, b) => a - b)
    .map(toTime);
  const reason =
    requested < FIRST_SEATING || requested > LAST_SEATING
      ? "Seatings run from 5:00 PM to 9:30 PM."
      : "That time is fully booked.";
  return { available: false, reason, alternatives };
}

// Weekend prime time is full, and only small tables are left at 7:00 PM on
// weeknights, so callers regularly get alternatives.
function openSeatings(weekday: number, partySize: number): number[] {
  const weekend = weekday === 5 || weekday === 6;
  const seatings: number[] = [];
  for (let minutes = FIRST_SEATING; minutes <= LAST_SEATING; minutes += SEATING_INTERVAL) {
    const prime = minutes >= 18 * 60 + 30 && minutes <= 20 * 60;
    if (weekend && prime) continue;
    if (!weekend && minutes === 19 * 60 && partySize > 4) continue;
    seatings.push(minutes);
  }
  return seatings;
}

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}
