import { formatCount } from '@/lib/format-number';

/**
 * table-words.ts — how a table's name is written next to a guest.
 *
 * A couple names a table however they like: "7", "Table 9", "Sweetheart Table",
 * "Family of the Bride", "Principal Sponsors 1". Only a BARE NUMBER needs the
 * word "Table" in front of it; every other name is already what the couple
 * calls it and is printed exactly as they typed it.
 *
 * 🔴 WHY THIS IS ONE FUNCTION (owner, live on maria-and-jose at 375 px,
 * 2026-10-05): the guest list rows prefixed EVERY label with "Table ", so the
 * bride and groom read "Table Sweetheart Table" and a guest at "Table 9" read
 * "Table Table 9". The guest card already had the right rule in a private
 * helper; the list had its own template literal. Two spellings of one fact
 * drift — so the rule lives here and both read it.
 */
import { formatCount } from '@/lib/format-number';

/** "7" → "Table 7"; "Table 9" / "Sweetheart Table" / "Sponsors" stay as named. */
export function tableWords(label: string): string {
  const trimmed = label.trim();
  return /^\d+$/.test(trimmed) ? `Table ${trimmed}` : trimmed;
}

/**
 * "Seat 2" — a seat as a person reads it. `event_seat_assignments.seat_number` counts from 0 (the auto-draft's first
 * chair is 0, `lib/seating.ts`), so the first chair reads "Seat 1" — Seats › List's own words (`seat-list.tsx`).
 */
export function seatWords(seatNumber: number): string {
  return `Seat ${formatCount(seatNumber + 1)}`;
}

/**
 * 🪑 A CHAIR'S NUMBER AS A GUEST READS IT — `event_seat_assignments.seat_number`
 * counts from 0 (the auto-draft's first chair is 0, `seatAt` in lib/seating.ts;
 * prod 2026-11-22: `min(seat_number) = 0`, 33 of 263 numbered seats are chair 0).
 * Seats › List writes it `Seat ${formatCount(seat + 1)}`, so a ticket, a print
 * or the guest's seat pass that printed the column raw read "Seat 0" for the
 * first chair and one lower than the seat plan for every other. The bare
 * number, counted from 1: `0` → `"1"`.
 */
export function seatNumberWords(seatNumber: number): string {
  return formatCount(seatNumber + 1);
}
