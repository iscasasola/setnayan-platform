/**
 * lib/seat-plan-print.ts — WHAT THE A3 SEAT PLAN PRINTS (pure: no pdf-lib, no I/O).
 *
 * Owner 2026-10-01, DECISION_LOG "THE SEAT PLAN IS THE VENUE FLOOR PLAN — ON
 * THE PHONE, IN 3D AND ON PAPER": *"when it prints, we need to show the
 * elements, the tables with chairs, the stage, and the rest."* — and "SEAT
 * PLAN: LINKED TABLES ARE ONE TABLE · NOTHING OVERLAPS": one legend entry per
 * unit. The approved frame (prototypes/seat_plan_and_walking_order_2026-10-01
 * _fable.html, frame 7) is ONE A3 landscape page: the room as laid out, each
 * table with its chairs (a filled chair = seated), the table number + count,
 * and beside it a legend — who sits where, one entry per unit, open seats
 * shown — then an UNSEATED box.
 *
 * This file decides the CONTENT; `lib/seating-pdf.ts` only draws it. So the
 * two rules the owner named are held here, as functions:
 *   · `units` — one entry per linked unit (`groupTablesIntoUnits`, the shipped
 *     grouping the editor, the pack and the caterer sheet already use);
 *   · `chairs` — one chair per OCCUPIABLE seat (deleted chairs are not drawn),
 *     so a table prints exactly as many chairs as it has seats.
 * Who is unseated is `guestsStillToSeat` — the rule Auto Arrange counts and
 * the phone's Unseated chip shows; never a second opinion.
 */
import {
  effectiveCapacity,
  groupTablesIntoUnits,
  guestsStillToSeat,
  removedSeatSet,
  shapeHintFor,
  type EventTableRow,
  type SeatAssignmentRow,
  type TableShapeHint,
} from '@/lib/seating';

export type SeatPlanPrintGuest = {
  guest_id: string;
  name: string;
  role: string | null;
  rsvp_status: string;
};

/** One chair as printed: its index in the table's seat ring, and who sits there. */
export type SeatPlanPrintChair = { seat: number; name: string | null };

export type SeatPlanPrintUnit = {
  key: string;
  /** The unit's own name (the link label for a linked unit — data, never typed). */
  label: string;
  /** "Round", "Long · linked", "Family head" … — what the legend says beside it. */
  kind: string;
  /** The table ids in this unit, lead first. */
  tableIds: string[];
  seated: number;
  /** Occupiable seats across the unit (deleted chairs excluded). */
  seats: number;
  /** Chair order across the unit: a name, or null for an open seat. */
  roster: Array<string | null>;
  /** True for the couple's sweetheart — drawn, never counted as a guest table. */
  sweetheart: boolean;
};

export type SeatPlanPrintModel = {
  units: SeatPlanPrintUnit[];
  /** Chairs per table id, occupiable seats only, in seat order. */
  chairs: Map<string, SeatPlanPrintChair[]>;
  /** Names of everyone still to seat (not declined, not seated, not the couple), A→Z. */
  unseated: string[];
  /** Guest tables as the couple counts them — linked units once, the sweetheart not at all. */
  tableCount: number;
  /** How many units are linked (the header says "(1 + 2 and 10 + 11 linked)"). */
  linkedLabels: string[];
  seatedCount: number;
};

const KIND: Record<TableShapeHint, string> = {
  round: 'Round',
  long_banquet: 'Long',
  family_head: 'Family head',
  sweetheart: 'Sweetheart',
  serpentine: 'Serpentine',
};

/**
 * A table's occupants by chair — the SAME rule the editor's `occupantsFor` and
 * the old PDF used: a stored seat number wins; anyone unnumbered (or whose
 * number is taken / out of range) fills the next free, not-deleted chair.
 */
export function occupantsByChair<G extends { guest_id: string }>(
  table: Pick<EventTableRow, 'table_id' | 'capacity' | 'removed_seats'>,
  assignments: ReadonlyArray<Pick<SeatAssignmentRow, 'table_id' | 'guest_id' | 'seat_number'>>,
  guestById: ReadonlyMap<string, G>,
): Array<G | null> {
  const cap = Math.max(0, Math.floor(table.capacity));
  const occ: Array<G | null> = new Array(cap).fill(null);
  const removed = removedSeatSet(table.removed_seats, cap);
  const overflow: G[] = [];
  for (const a of assignments) {
    if (a.table_id !== table.table_id) continue;
    const g = guestById.get(a.guest_id);
    if (!g) continue;
    const n = a.seat_number;
    if (n !== null && n >= 0 && n < cap && occ[n] === null && !removed.has(n)) occ[n] = g;
    else overflow.push(g);
  }
  let i = 0;
  for (const g of overflow) {
    while (i < cap && (occ[i] !== null || removed.has(i))) i++;
    if (i < cap) occ[i] = g;
  }
  return occ;
}

export function seatPlanPrintModel(input: {
  tables: ReadonlyArray<EventTableRow>;
  assignments: ReadonlyArray<Pick<SeatAssignmentRow, 'table_id' | 'guest_id' | 'seat_number'>>;
  guests: ReadonlyArray<SeatPlanPrintGuest>;
  /** The event type's couple roles (`RoleSet.coupleRoles`) — they are never "unseated". */
  coupleRoles: ReadonlySet<string>;
}): SeatPlanPrintModel {
  const guestById = new Map(input.guests.map((g) => [g.guest_id, g]));
  const chairs = new Map<string, SeatPlanPrintChair[]>();
  for (const t of input.tables) {
    const removed = removedSeatSet(t.removed_seats, t.capacity);
    const occ = occupantsByChair(t, input.assignments, guestById);
    chairs.set(
      t.table_id,
      occ.flatMap((g, seat) => (removed.has(seat) ? [] : [{ seat, name: g?.name ?? null }])),
    );
  }

  const units: SeatPlanPrintUnit[] = groupTablesIntoUnits([...input.tables]).map((u) => {
    const roster = u.members.flatMap((m) => (chairs.get(m.table_id) ?? []).map((c) => c.name));
    const shape = shapeHintFor(u.lead.table_type);
    return {
      key: u.key,
      label: u.label,
      kind: `${KIND[shape]}${u.isLinked ? ' · linked' : ''}`,
      tableIds: u.members.map((m) => m.table_id),
      seated: roster.filter((n) => n !== null).length,
      seats: u.members.reduce((n, m) => n + effectiveCapacity(m.capacity, m.removed_seats), 0),
      roster,
      sweetheart: shape === 'sweetheart',
    };
  });

  const seatedIds = new Set(
    input.assignments.filter((a) => input.tables.some((t) => t.table_id === a.table_id)).map((a) => a.guest_id),
  );
  const unseated = guestsStillToSeat(input.guests, seatedIds, { coupleRoles: input.coupleRoles })
    .map((g) => g.name)
    .sort((a, b) => a.localeCompare(b));

  return {
    units,
    chairs,
    unseated,
    tableCount: units.filter((u) => !u.sweetheart).length,
    linkedLabels: units.filter((u) => u.tableIds.length > 1).map((u) => u.label),
    seatedCount: units.reduce((n, u) => n + u.seated, 0),
  };
}

/**
 * The short name a unit wears ON the plan: the members' table numbers joined
 * ("1 + 2"), so a linked run carries ONE label — or the unit's own name when a
 * member has no number ("Family", "A & B").
 */
export function unitPlanName(unit: Pick<SeatPlanPrintUnit, 'label'>, memberLabels: ReadonlyArray<string>): string {
  const nums = memberLabels.map((l) => l.match(/\d+/)?.[0] ?? null);
  if (nums.length > 0 && nums.every((n) => n !== null)) return nums.join(' + ');
  return unit.label;
}
