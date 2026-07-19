/**
 * seat-suggest.ts — the PURE per-row seat SUGGESTION for the Living Roster's
 * reactive seat column (P3).
 *
 * The moment a guest is added, the roster shows where they'd *land* in the seat
 * plan — a dashed "~T#" hint — before the couple ever opens the seating editor.
 * `suggestTableFor` is that hint: a pure O(tables) function of (guest, tables,
 * assignments), backed by the REAL seating logic (`guestTier` + `rankTablesByStage`
 * from `lib/seating.ts`), NOT the heavy constraint solver. It is deliberately
 * cheap enough to call once per rendered row.
 *
 * DEGRADED scope (owner-decided, no schema change): a guest is only ever
 * *placed* (a live assignment), *declined* (dash), or *suggested* (this). There
 * is no persisted "held" seat state, so this never produces one — it is a hint,
 * confirmed only when the couple actually seats the guest in the 0008 editor.
 *
 * It mirrors the prototype's `suggestTable` heuristic (guests-prototype.html
 * ~365-374 — role tier, then a side split for general guests) but resolves to a
 * REAL `table_label` from the event's tables instead of the prototype's T1/T5/T6
 * literals, and prefers a table that still has a free chair.
 */

import {
  effectiveCapacity,
  guestTier,
  rankTablesByStage,
  type EventTableRow,
  type SeatAssignmentRow,
} from './seating';

// Fallback stage anchor, used only when the caller doesn't pass the event's real
// stage — mirrors seating.ts's private STAGE_POINT. The Guests page passes the
// actual event_floor_plan { stage_x, stage_y } so the hint ranks tables from
// where the couple actually placed the stage (matching what `computeAutoSeat`
// fills), not a hardcoded top-center default.
const STAGE = { x: 50, y: 8 };

// The minimal guest shape the heuristic reads — a structural subset of GuestRow,
// so a full row is assignable without a cast. Kept as loose primitives (guestTier
// takes plain strings) so this helper never has to know the exact role/category
// enums.
export type SuggestGuest = {
  role: string;
  group_category: string;
  side: 'bride' | 'groom' | 'both';
  seating_priority: number | null;
};

/**
 * The table the seat plan would draft this guest into, as a `table_label`, or
 * `null` when there's nothing to suggest (no tables, or only the couple's
 * sweetheart). PURE — same inputs always yield the same label.
 */
export function suggestTableFor(
  guest: SuggestGuest,
  tables: EventTableRow[],
  assignments: SeatAssignmentRow[],
  stage: { x: number; y: number } = STAGE,
): string | null {
  if (tables.length === 0) return null;

  // Pool excludes the sweetheart table (reserved for the couple) and is ranked
  // stage-nearest first from the event's real stage anchor — the SAME pool and
  // ordering `computeAutoSeat` uses, so a suggestion matches what Auto-Arrange
  // would do even when the couple has moved the stage.
  const pool = rankTablesByStage(tables, stage)
    .map((r) => r.table)
    .filter((t) => t.table_type !== 'sweetheart_2');
  if (pool.length === 0) return null;

  // Live free-seat count per table so a suggestion prefers a table with room.
  const free = new Map<string, number>();
  for (const t of pool) free.set(t.table_id, effectiveCapacity(t.capacity, t.removed_seats));
  for (const a of assignments) {
    if (free.has(a.table_id)) free.set(a.table_id, (free.get(a.table_id) ?? 0) - 1);
  }

  // Role tier → a stage-proximity band (tier 1 nearest the stage). General guests
  // (tier 4) split by side so the two families lean to different tables — the
  // real-data analogue of the prototype's SUGGEST_TIER + T5/T6 side split.
  const tier = guestTier(guest.role, guest.group_category, guest.seating_priority);
  let idx = tier - 1;
  if (tier === 4 && guest.side === 'groom') idx += 1;
  idx = Math.min(idx, pool.length - 1);

  // Walk outward from the banded table to the first one that still has a free
  // chair; if the whole tail is full, fall back to the banded table's label (a
  // suggestion is only a hint — an over-capacity plan is the couple's to resolve).
  for (let i = idx; i < pool.length; i++) {
    const t = pool[i]!;
    if ((free.get(t.table_id) ?? 0) > 0) return t.table_label;
  }
  return pool[idx]?.table_label ?? null;
}
