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
  plusOnes,
  plusControl,
  plain = false,
}: {
  /** The guest's live seat's table label (from the assignment map), or null. */
  placed: string | null;
  /** The self-drafted table label from seat-suggest, or null (e.g. no tables). */
  suggested: string | null;
  /** The guest's EFFECTIVE (optimistically-projected) RSVP. */
  rsvp: RsvpStatus;
  /** Extra seats that ride along, 0–4 (guests.plus_one_count). */
  plusOnes: number;
  /** The +N control (a `PlusOneChipEditor`). When given it is drawn in the
   *  badge's place — ALWAYS, so a guest with none can be given some — and the
   *  plain badge is not. Omitted → the read-only "+N" badge. */
  plusControl?: React.ReactNode;
  /**
   * Roster presentation: the table (owner 2026-09-20 — "remove the pill boxes
   * ... so it looks neater"). Same three states, same labels, no plaque. The
   * CARD keeps its box, where one guest fills the surface and a box reads as a
   * label rather than as texture — which is why this is a prop and not an edit
   * to the markup below.
   */
  plain?: boolean;
}) {
  // The +1 badge — only when the guest is actually coming (a declined guest frees
  // their whole allocation, plus-one included).
  const plus =
    rsvp === 'declined' ? null : plusControl ? (
      <span className="ml-1 inline-flex">{plusControl}</span>
    ) : plusOnes > 0 ? (
      <PlusBadge count={plusOnes} />
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
        <span
          className={
            plain
              ? 'font-mono text-[11px] text-ink/70'
              : 'inline-flex items-center rounded-md border border-ink/15 bg-white/70 px-2 py-0.5 font-mono text-[11px] font-bold text-ink/70'
          }
        >
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
          className={
            plain
              ? 'font-mono text-[11px] text-ink/45'
              : 'inline-flex items-center rounded-md border border-transparent bg-[var(--sn-gold-100)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--sn-gold-700)]'
          }
        >
          ~{suggested}
        </span>
        {plus}
      </span>
    );
  }

  return <span className="text-ink/30">—</span>;
}

/** "+N" — the extra seats that come with a guest (owner 2026-09-21: up to +4). */
export function PlusBadge({ count }: { count: number }) {
  return (
    <span
      title={count === 1 ? 'Their plus-one is seated with them' : `${count} extra seats come with them`}
      className="inline-flex rounded-full bg-[var(--sn-gold-100)] px-1.5 py-px text-[10px] font-semibold text-[var(--sn-gold-700)]"
    >
      +{count}
    </span>
  );
}
