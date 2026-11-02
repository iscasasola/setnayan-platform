/**
 * lib/seat-plan-scope.ts — 🪑 WHO AUTO ARRANGE MAY MOVE, AND PUTTING SEATS BACK (owner 2026-11-02, live on his own
 * event, Seats › List › ⋯): *"We want to be able to remove all seated. When we click auto seat. We ask if we change all
 * seated or just the unseated ones?"*
 *
 *   · 'unseated' (the default) — Auto arrange seats only who has no seat; nobody seated moves.
 *   · 'all' — every seat is arranged again, EXCEPT a locked seat (`event_seat_assignments.locked`), which never moves.
 *   · "Clear all seats" — every seat comes off (locked ones stay unless the host says otherwise).
 *
 * Whatever comes off is kept as `RestoreSeat` rows so Undo puts back EXACTLY those chairs (table, seat, lock, who
 * placed it, when) — never over a guest or a chair someone took since.
 *
 * Pure: no I/O. Read by the seating server actions and the editor.
 * 🔒 lib/auto-arrange-asks-who-moves.test.ts
 */

export type SeatScope = 'unseated' | 'all';

export function parseSeatScope(raw: unknown): SeatScope {
  return raw === 'all' ? 'all' : 'unseated';
}

/** One seat as it stood — enough to put it back exactly. */
export type RestoreSeat = {
  guest_id: string;
  table_id: string;
  seat_number: number | null;
  locked: boolean;
  placed_by: string | null;
  placed_at: string | null;
};

type SeatRowLike = {
  guest_id: string;
  table_id: string;
  seat_number: number | null;
  locked?: boolean | null;
  placed_by?: string | null;
  placed_at?: string | null;
};

const asRestore = (a: SeatRowLike): RestoreSeat => ({
  guest_id: a.guest_id,
  table_id: a.table_id,
  seat_number: a.seat_number ?? null,
  locked: a.locked === true,
  placed_by: a.placed_by ?? null,
  placed_at: a.placed_at ?? null,
});

/** The seats that come off: every unlocked seat, and the locked ones too only when `keepLocked` is false. */
export function seatsToClear(assignments: readonly SeatRowLike[], keepLocked = true): RestoreSeat[] {
  return assignments.filter((a) => !(keepLocked && a.locked === true)).map(asRestore);
}

/** The seats that STAY (what the seater fills around). */
export function seatsThatStay<T extends SeatRowLike>(assignments: readonly T[], keepLocked = true): T[] {
  return keepLocked ? assignments.filter((a) => a.locked === true) : [];
}

/** A `restore` list from the client: kept only when every field is well-formed (a junk row is dropped, never repaired). */
export function parseRestoreSeats(raw: unknown): RestoreSeat[] {
  if (!Array.isArray(raw)) return [];
  const out: RestoreSeat[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    if (typeof x.guest_id !== 'string' || typeof x.table_id !== 'string') continue;
    const seat = x.seat_number;
    if (seat !== null && !(typeof seat === 'number' && Number.isInteger(seat) && seat >= 0)) continue;
    out.push({
      guest_id: x.guest_id,
      table_id: x.table_id,
      seat_number: seat as number | null,
      locked: x.locked === true,
      placed_by: typeof x.placed_by === 'string' ? x.placed_by : null,
      placed_at: typeof x.placed_at === 'string' ? x.placed_at : null,
    });
  }
  return out;
}

/**
 * What Undo may put back NOW: a seat whose guest has no seat at the moment and whose chair nobody holds. A guest the host
 * seated by hand since — or a chair someone took — is left as it is (Undo never overwrites a later choice).
 */
export function restorableSeats(restore: readonly RestoreSeat[], current: readonly SeatRowLike[]): RestoreSeat[] {
  const seatedNow = new Set(current.map((a) => a.guest_id));
  const chairsNow = new Set(current.filter((a) => a.seat_number !== null).map((a) => `${a.table_id}#${a.seat_number}`));
  const out: RestoreSeat[] = [];
  for (const r of restore) {
    if (seatedNow.has(r.guest_id)) continue;
    const chair = r.seat_number === null ? null : `${r.table_id}#${r.seat_number}`;
    if (chair && chairsNow.has(chair)) continue;
    seatedNow.add(r.guest_id);
    if (chair) chairsNow.add(chair);
    out.push(r);
  }
  return out;
}
