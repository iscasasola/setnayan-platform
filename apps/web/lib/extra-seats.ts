/**
 * extra-seats.ts — how many seat rows a guest's "+N" should have.
 *
 * ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4 … these are for the
 * additional seats", then, asked whether the seat plan should hold chairs for
 * them: "decision. yes. + will have seats beside the person invited".
 *
 * A seat is a ROW (`guests.plus_one_of_guest_id` = the guest who brings it) —
 * the shape a named plus-one already had, which the seat engine already keeps
 * beside its primary and the pax count already counts. So "+3" means exactly
 * three such rows.
 *
 * 🔒 ONLY A PLACEHOLDER IS EVER REMOVED. A placeholder is an unnamed "TBA" seat
 * nobody confirmed. A seat someone NAMED is a person — with their own QR, their
 * own invitation — and lowering a number must never delete them. If the named
 * seats alone exceed the new number, the change is refused with the reason, and
 * the couple removes that person themselves.
 *
 * Pure: no database. The server applies what this returns.
 */

export type ExtraSeatRow = {
  guest_id: string;
  first_name: string | null;
  /** `plus_one_name_confirmed_at` — set when a name was given for this seat. */
  confirmed_at: string | null;
  created_at?: string | null;
};

export const PLACEHOLDER_FIRST_NAME = 'TBA';

/** An unnamed seat nobody has claimed — the only kind that may be removed. */
export function isPlaceholderSeat(row: ExtraSeatRow): boolean {
  return !row.confirmed_at && (row.first_name ?? '').trim().toUpperCase() === PLACEHOLDER_FIRST_NAME;
}

export type ExtraSeatPlan =
  | { ok: true; create: number; remove: string[] }
  | { ok: false; named: number; reason: string };

export function planExtraSeats(
  want: number,
  rows: readonly ExtraSeatRow[],
  guestName = 'This guest',
): ExtraSeatPlan {
  const target = Math.max(0, Math.min(4, Math.trunc(want)));
  const placeholders = rows.filter(isPlaceholderSeat);
  const named = rows.length - placeholders.length;

  if (named > target) {
    return {
      ok: false,
      named,
      reason:
        named === 1
          ? `${guestName}’s plus-one is already named — remove them from the guest list first to go below +1.`
          : `${named} of ${guestName}’s plus-ones are already named — remove one from the guest list first to go lower.`,
    };
  }
  if (rows.length < target) return { ok: true, create: target - rows.length, remove: [] };
  // Too many: drop placeholders only, the newest first.
  const surplus = rows.length - target;
  const newestFirst = [...placeholders].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return { ok: true, create: 0, remove: newestFirst.slice(0, surplus).map((r) => r.guest_id) };
}

/** Which seat a guest's RSVP name fills: the oldest placeholder, else none. */
export function seatToName(rows: readonly ExtraSeatRow[]): string | null {
  const open = rows
    .filter(isPlaceholderSeat)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return open[0]?.guest_id ?? null;
}
