/**
 * 🛡 THE INDEPENDENT CHECK ON AN AUTO-ARRANGED PLAN (seat plan § 5 step 7, corpus SEAT-PLAN-COMPLETE-2026-11-27.md:
 * "Run an independent validator that shares no code with the solver. A plan that fails it is never shown").
 *
 * It deliberately imports NOTHING from `lib/seating.ts` or the seat-plan engine: a rule written once in the solver and
 * read back by its own helper would agree with itself however wrong it was. Everything below is re-stated from the
 * plan's hard rules, on the plain rows the action is about to write:
 *   1. every new seat is at a table of this plan;
 *   2. nobody is seated twice (a new seat for someone already seated is a move, and auto arrange never moves anyone);
 *   3. a seat number is a real chair: inside the table's capacity, not a removed chair, not already taken;
 *   4. no table holds more people than it has chairs;
 *   5. never at the Sweetheart, a locked table or a Spare table;
 *   6. never a guest who declined (or one who is not on the list);
 *   7. a party never splits: a newly seated +1 or kid sits at the table (or linked run) of the guest who brought them,
 *      when that guest is seated — except, under the host's "nearest" pick, a non-role +1 of a guest at a VIP table
 *      (owner R3: principal sponsors' +1s sit together nearest the sponsors).
 * Pure. It returns every broken rule, in words, so a refusal can say what it refused.
 */

export type CheckTable = {
  table_id: string;
  table_type: string;
  capacity: number;
  removed_seats?: number[] | null;
  locked?: boolean | null;
  table_kind?: string | null;
  is_vip?: boolean | null;
  link_group_id?: string | null;
};
export type CheckSeat = { guest_id: string; table_id: string; seat_number: number | null };
export type CheckGuest = { guest_id: string; rsvp_status: string; plus_one_of_guest_id?: string | null; role?: string | null };

export type PlanBreak = { rule: 'table' | 'twice' | 'chair' | 'capacity' | 'closed' | 'guest' | 'party'; guestId: string; tableId: string };

function chairsOf(t: CheckTable): { real: Set<number>; count: number } {
  const removed = new Set((t.removed_seats ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < t.capacity));
  const real = new Set<number>();
  for (let i = 0; i < t.capacity; i += 1) if (!removed.has(i)) real.add(i);
  return { real, count: real.size };
}

function closedToAutoSeat(t: CheckTable): boolean {
  return t.table_type === 'sweetheart_2' || t.locked === true || t.table_kind === 'spare';
}

/** Every hard rule the NEW seats break, given the seats that already stand. Empty = the plan may be written. */
export function checkAutoSeatPlan(input: {
  tables: ReadonlyArray<CheckTable>;
  guests: ReadonlyArray<CheckGuest>;
  existing: ReadonlyArray<CheckSeat>;
  added: ReadonlyArray<CheckSeat>;
  /** The host's VIP +1 pick is "nearest" (their +1s sit together near the VIP tables, not beside them). */
  nearestVipPlusOnes?: boolean;
}): PlanBreak[] {
  const breaks: PlanBreak[] = [];
  const tableById = new Map(input.tables.map((t) => [t.table_id, t]));
  const guestById = new Map(input.guests.map((g) => [g.guest_id, g]));
  const seated = new Set(input.existing.map((s) => s.guest_id));
  const taken = new Map<string, Set<number>>();
  const headcount = new Map<string, number>();
  for (const s of input.existing) {
    headcount.set(s.table_id, (headcount.get(s.table_id) ?? 0) + 1);
    if (s.seat_number !== null) {
      const set = taken.get(s.table_id) ?? new Set<number>();
      set.add(s.seat_number);
      taken.set(s.table_id, set);
    }
  }
  for (const s of input.added) {
    const t = tableById.get(s.table_id);
    if (!t) {
      breaks.push({ rule: 'table', guestId: s.guest_id, tableId: s.table_id });
      continue;
    }
    const g = guestById.get(s.guest_id);
    if (!g || g.rsvp_status === 'declined') breaks.push({ rule: 'guest', guestId: s.guest_id, tableId: s.table_id });
    if (seated.has(s.guest_id)) breaks.push({ rule: 'twice', guestId: s.guest_id, tableId: s.table_id });
    seated.add(s.guest_id);
    if (closedToAutoSeat(t)) breaks.push({ rule: 'closed', guestId: s.guest_id, tableId: s.table_id });
    const chairs = chairsOf(t);
    const used = taken.get(s.table_id) ?? new Set<number>();
    if (s.seat_number !== null) {
      if (!chairs.real.has(s.seat_number) || used.has(s.seat_number)) breaks.push({ rule: 'chair', guestId: s.guest_id, tableId: s.table_id });
      used.add(s.seat_number);
      taken.set(s.table_id, used);
    }
    const n = (headcount.get(s.table_id) ?? 0) + 1;
    headcount.set(s.table_id, n);
    if (n > chairs.count) breaks.push({ rule: 'capacity', guestId: s.guest_id, tableId: s.table_id });
  }
  // 7 · A party never splits.
  const tableOf = new Map<string, string>();
  for (const x of input.existing) tableOf.set(x.guest_id, x.table_id);
  for (const x of input.added) tableOf.set(x.guest_id, x.table_id);
  const placeOf = (tableId: string) => {
    const t = tableById.get(tableId);
    return t?.link_group_id ? `link:${t.link_group_id}` : `table:${tableId}`;
  };
  for (const s of input.added) {
    const by = guestById.get(s.guest_id)?.plus_one_of_guest_id;
    if (!by) continue;
    const at = tableOf.get(by);
    if (!at || placeOf(at) === placeOf(s.table_id)) continue;
    const headTable = tableById.get(at);
    const vip = !!headTable && (headTable.table_kind === 'vip' || (headTable.table_kind == null && headTable.is_vip === true));
    const role = guestById.get(s.guest_id)?.role ?? 'guest';
    if (input.nearestVipPlusOnes && vip && role === 'guest') continue;
    breaks.push({ rule: 'party', guestId: s.guest_id, tableId: s.table_id });
  }
  return breaks;
}
