/**
 * seat-chip.tsx — the reactive seat cell for a Living Roster row (P3).
 *
 * Three states, resolved in this order so an OPTIMISTIC decline flips the chip
 * instantly (before the DB trigger has freed the seat server-side):
 *   1. declined  → "—"          (rsvp is declined; the seat is/gets freed)
 *   2. seated    → "🪑 T#"      (a live assignment from event_seat_assignments)
 *   3. suggested → "⌁ ~T#"      (a pure per-row hint from lib/seat-suggest)
 * A "+1" badge rides along for a guest who brings a plus-one (never when declined).
 *
 * DEGRADED scope (owner-decided, no schema change): there is NO persisted "held"
 * seat state, so this chip never renders the prototype's half-moon "◐ held"
 * variant, and there is no release-bar. Placed vs suggested vs declined is the
 * whole surface until the seat plan grows a hold column (deferred to a later PR).
 *
 * Presentational only (no hooks / no server calls) — the row passes the already
 * server-computed placed/suggested labels + the guest's effective rsvp.
 */

import type { RsvpStatus } from '@/lib/guests';

export function SeatChip({
  placed,
  suggested,
  rsvp,
  hasPlusOne,
}: {
  /** The guest's live seat's table label (from the assignment map), or null. */
  placed: string | null;
  /** The self-drafted table label from seat-suggest, or null (e.g. no tables). */
  suggested: string | null;
  /** The guest's EFFECTIVE (optimistically-projected) RSVP. */
  rsvp: RsvpStatus;
  /** Whether a plus-one rides along (guests.plus_one_allowed). */
  hasPlusOne: boolean;
}) {
  // The +1 badge — only when the guest is actually coming (a declined guest frees
  // their whole allocation, plus-one included).
  const plus =
    hasPlusOne && rsvp !== 'declined' ? (
      <span
        title="Their plus-one is seated with them"
        className="ml-1 inline-flex rounded-full bg-[var(--sn-gold-100)] px-1.5 py-px text-[10px] font-semibold text-[var(--sn-gold-700)]"
      >
        +1
      </span>
    ) : null;

  // Mono seat chips (Glass PR-3, per the roster proto): placed = a white mono
  // plaque, suggested = the gold-100 hint, declined/empty = a quiet dash.

  // 1. Declined — a dash. Checked FIRST so an optimistic decline shows "—" the
  //    instant the row flips, even while `placed` is still the stale prior seat.
  if (rsvp === 'declined') {
    return <span className="text-ink/30">—</span>;
  }

  // 2. Seated — the confirmed chair.
  if (placed) {
    return (
      <span className="inline-flex items-center whitespace-nowrap">
        <span className="inline-flex items-center rounded-md border border-ink/15 bg-white/70 px-2 py-0.5 font-mono text-[11px] font-bold text-ink/70">
          {placed}
        </span>
        {plus}
      </span>
    );
  }

  // 3. Suggested — a hint the couple confirms by seating the guest in the 0008
  //    editor. Null suggestion (no tables yet) degrades to a quiet dash.
  if (suggested) {
    return (
      <span className="inline-flex items-center whitespace-nowrap">
        <span
          title="Suggested from role + side · place them in the seat plan to confirm"
          className="inline-flex items-center rounded-md border border-transparent bg-[var(--sn-gold-100)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--sn-gold-700)]"
        >
          ~{suggested}
        </span>
        {plus}
      </span>
    );
  }

  return <span className="text-ink/30">—</span>;
}
