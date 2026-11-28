/**
 * 🪑 THE AUTO-ARRANGE PREVIEW (seat plan § 4.6, preview D; corpus SEAT-PLAN-COMPLETE-2026-11-27.md).
 *
 * "Only the unseated (N)" and "Seat everyone again" open a preview instead of saving. This builds it, writing NOTHING:
 *   · the counts — "X of Y seated · N rules broken · N wishes not met · N guests get a seat";
 *   · the Not met list (the seater's own "didn't fit" + keep-apart rules it could not hold);
 *   · the tables that change: per table who joins, who leaves, and a one-line reason from the seater's terms;
 *   · named repairs when the plan cannot seat everyone ("Not enough seats: 212 coming, 200 chairs. Add 2 tables");
 *   · the exact plan Accept writes, with `base` — the fingerprint of the seats it started from, so a stale preview is
 *     refused (`apply_seat_plan`, the one transaction).
 * The host's 🔒 on a table in the preview (`keep`) keeps that table exactly as it is and the preview re-runs.
 * The same independent check auto arrange uses (`checkAutoSeatPlan`) runs first: a plan that fails it is never shown.
 */

import { createHash } from 'node:crypto';
import {
  autoSeatRoom,
  autoSeatTakesTable,
  computeAutoSeat,
  effectiveCapacity,
  guestsStillToSeat,
  seatRoomPoints,
  solveSeatPlan,
  type AutoSeatCannotFit,
  type AutoSeatGuest,
  type EventTableRow,
  type FloorPlanRow,
  type KeepApartRule,
  type RecommendedTable,
  type SeatAssignmentRow,
} from '@/lib/seating';
import { seatsThatStay, seatsToClear, type RestoreSeat, type SeatScope } from '@/lib/seat-plan-scope';
import { checkAutoSeatPlan } from '@/lib/seat-plan-validator';
import { suggestionReason, type DryRunGuest } from '@/lib/seat-plan-dry-run';
import { WEDDING_ROLE_SET, type RoleSet } from '@/lib/role-sets';
import { formatCount } from '@/lib/format-number';

/**
 * The fingerprint of an event's seats — md5 of "guest:table:seat" joined by ',' in guest order ('-' for no chair).
 * 🔒 Byte-for-byte the SQL in `apply_seat_plan`: change one, change both.
 */
export function seatPlanBase(seats: ReadonlyArray<Pick<SeatAssignmentRow, 'guest_id' | 'table_id' | 'seat_number'>>): string {
  const line = [...seats]
    .sort((a, b) => (a.guest_id < b.guest_id ? -1 : a.guest_id > b.guest_id ? 1 : 0))
    // The STORED chair (from 0), never shown to anybody: it must match the SQL's `seat_number::text` exactly.
    .map((s) => {
      const stored = s.seat_number;
      return `${s.guest_id}:${s.table_id}:${stored === null ? '-' : String(stored)}`;
    })
    .join(',');
  return createHash('md5').update(line).digest('hex');
}

/** A table the plan adds for room: its key ("new:<key>" in the rows), what it is and where it goes. */
export type PlanNewTable = { key: string; label: string; type: string; capacity: number; sort_order: number; x?: number; y?: number };

/** Exactly what Accept writes (`apply_seat_plan`). */
export type ArrangePlan = {
  base: string;
  clear: string[];
  newTables: PlanNewTable[];
  positions: Record<string, { x: number; y: number }>;
  rows: Array<{ guest_id: string; table: string; seat_number: number }>;
};

export type TableChange = { table: string; label: string; added: string[]; removed: string[]; reason: string };

export type SeatRepair =
  | { kind: 'add_tables'; tables: number; coming: number; chairs: number }
  | { kind: 'add_seats'; tableId: string; seats: number; guestIds: string[]; need: number; gap: number };

export type NotMet =
  | { kind: AutoSeatCannotFit['kind']; guestIds: string[]; tableIds: string[] }
  | { kind: 'keep_apart'; guestIds: string[]; tableIds: string[] };

export type ArrangePreview = {
  ok: true;
  seated: number;
  coming: number;
  rulesBroken: number;
  wishesNotMet: number;
  newSeats: number;
  notMet: NotMet[];
  tables: TableChange[];
  repairs: SeatRepair[];
  plan: ArrangePlan;
};

export type ArrangePreviewInput = {
  tables: ReadonlyArray<EventTableRow>;
  /** The tables auto arrange would add for room, each with where the editor laid it out (or nowhere). */
  newTables: ReadonlyArray<RecommendedTable & { x?: number; y?: number }>;
  /** Where the editor laid the existing tables out (table_id → percent). */
  positions: Readonly<Record<string, { x: number; y: number }>>;
  guests: ReadonlyArray<DryRunGuest>;
  assignments: ReadonlyArray<SeatAssignmentRow>;
  scope: SeatScope;
  /** 🔒 Tables the host locked in this preview: kept exactly as they are. */
  keep: ReadonlySet<string>;
  constraints: ReadonlyArray<KeepApartRule>;
  memberships: ReadonlyMap<string, string[]>;
  groupLabels: ReadonlyMap<string, string>;
  floor: FloorPlanRow;
  roleSet?: RoleSet;
  groupAdjacency?: boolean;
};

const NEW = 'new:';

/** Build the preview. Returns `{ ok: false }` when the plan breaks a hard rule (it is never shown). */
export function buildArrangePreview(input: ArrangePreviewInput): ArrangePreview | { ok: false } {
  const roleSet = input.roleSet ?? WEDDING_ROLE_SET;
  const maxSort = input.tables.reduce((m, t) => Math.max(m, t.sort_order), -1);
  const added: EventTableRow[] = input.newTables.map((t, i) => ({
    table_id: `${NEW}${t.label}`,
    public_id: '',
    event_id: input.tables[0]?.event_id ?? '',
    table_label: t.label,
    table_type: t.type,
    capacity: t.capacity,
    sort_order: maxSort + 1 + i,
    x_pos: t.x ?? null,
    y_pos: t.y ?? null,
  }));
  const tables: EventTableRow[] = [
    ...input.tables.map((t) => {
      const p = input.positions[t.table_id];
      const laid = p ? { ...t, x_pos: p.x, y_pos: p.y } : t;
      return input.keep.has(t.table_id) ? { ...laid, locked: true } : laid;
    }),
    ...added,
  ];
  const closed = new Set(tables.filter((t) => t.locked === true).map((t) => t.table_id));
  const clearRows: RestoreSeat[] = input.scope === 'all' ? seatsToClear([...input.assignments], true, closed) : [];
  const stay = input.scope === 'all' ? seatsThatStay([...input.assignments], true, closed) : [...input.assignments];

  const guests: AutoSeatGuest[] = input.guests.map((g) => ({ ...g }));
  const cannotFit: AutoSeatCannotFit[] = [];
  const auto = { vipPlusOnes: input.floor.vip_plus_ones, room: seatRoomPoints(input.floor), cannotFit };
  const stage = { x: input.floor.stage_x, y: input.floor.stage_y };
  const solved =
    input.constraints.length > 0
      ? solveSeatPlan({
          tables,
          guests,
          assignments: stay,
          stage,
          priorityOrder: input.floor.priority_order,
          constraints: [...input.constraints],
          groupMembers: new Map(input.memberships),
          roleSet,
          groupAdjacency: input.groupAdjacency ?? true,
          roleSeating: input.floor.role_seating,
          autoSeat: auto,
        })
      : null;
  const rows =
    solved?.assignments ??
    computeAutoSeat(tables, guests, stay, stage, input.floor.priority_order, roleSet, input.groupAdjacency ?? true, input.floor.role_seating, auto);

  if (checkAutoSeatPlan({ tables, guests, existing: stay, added: rows, nearestVipPlusOnes: input.floor.vip_plus_ones === 'nearest' }).length > 0) return { ok: false };

  // Counts.
  const seatable = guestsStillToSeat(input.guests, new Set(), roleSet);
  const seatableIds = new Set(seatable.map((g) => g.guest_id));
  const seatedAfter = new Set([...stay.map((s) => s.guest_id), ...rows.map((r) => r.guest_id)]);
  const seated = [...seatedAfter].filter((id) => seatableIds.has(id)).length;
  // A cleared guest seated again is not a new seat.
  const before = new Set(input.assignments.map((a) => a.guest_id));
  const newSeats = rows.filter((r) => !before.has(r.guest_id)).length;

  // Not met.
  const notMet: NotMet[] = cannotFit.map((c) => ({ kind: c.kind, guestIds: c.guestIds, tableIds: c.tableIds }));
  for (const v of solved?.violations ?? []) notMet.push({ kind: 'keep_apart', guestIds: [v.guest_a_id, v.guest_b_id], tableIds: [] });

  // Tables that change.
  const byId = new Map(input.guests.map((g) => [g.guest_id, g] as const));
  const addedAt = new Map<string, string[]>();
  for (const r of rows) addedAt.set(r.table_id, [...(addedAt.get(r.table_id) ?? []), r.guest_id]);
  const backAt = new Map(rows.map((r) => [r.guest_id, r.table_id] as const));
  const removedAt = new Map<string, string[]>();
  for (const c of clearRows) if (backAt.get(c.guest_id) !== c.table_id) removedAt.set(c.table_id, [...(removedAt.get(c.table_id) ?? []), c.guest_id]);
  const clearedFrom = new Map(clearRows.map((c) => [c.guest_id, c.table_id] as const));
  const changes: TableChange[] = [];
  for (const t of tables) {
    // A guest cleared and seated back at the same table did not change it.
    const joins = (addedAt.get(t.table_id) ?? []).filter((id) => clearedFrom.get(id) !== t.table_id);
    const leaves = removedAt.get(t.table_id) ?? [];
    if (joins.length === 0 && leaves.length === 0) continue;
    const units = new Map<string, DryRunGuest[]>();
    for (const id of joins) {
      const g = byId.get(id);
      if (!g) continue;
      const head = g.plus_one_of_guest_id && byId.has(g.plus_one_of_guest_id) ? g.plus_one_of_guest_id : g.guest_id;
      units.set(head, [...(units.get(head) ?? []), g]);
    }
    changes.push({
      table: t.table_id,
      label: t.table_label,
      added: joins,
      removed: leaves,
      reason: joins.length > 0 ? suggestionReason([...units.values()], input.groupLabels) : '',
    });
  }

  const repairs = planRepairs({ tables, guests: input.guests, stay, rows, cannotFit, roleSet });

  const isNew = (id: string) => id.startsWith(NEW);
  return {
    ok: true,
    seated,
    coming: seatable.length,
    rulesBroken: solved?.violations.length ?? 0,
    wishesNotMet: cannotFit.length,
    newSeats,
    notMet,
    tables: changes,
    repairs,
    plan: {
      base: seatPlanBase(input.assignments),
      clear: clearRows.map((c) => c.guest_id),
      // Only the new tables a seat lands at are added; the rest were not needed after all.
      newTables: added
        .filter((t) => addedAt.has(t.table_id))
        .map((t) => ({
          key: t.table_id.slice(NEW.length),
          label: t.table_label,
          type: t.table_type,
          capacity: t.capacity,
          sort_order: t.sort_order,
          ...(t.x_pos !== null && t.x_pos !== undefined ? { x: Number(t.x_pos) } : {}),
          ...(t.y_pos !== null && t.y_pos !== undefined ? { y: Number(t.y_pos) } : {}),
        })),
      positions: Object.fromEntries(Object.entries(input.positions).filter(([id]) => !isNew(id) && input.tables.some((t) => t.table_id === id))),
      rows: rows.map((r) => ({ guest_id: r.guest_id, table: r.table_id, seat_number: r.seat_number })),
    },
  };
}

/**
 * Named repairs when the plan cannot seat everyone, each one tap: not enough chairs → add tables; a party bigger than
 * the biggest gap → add the missing seats to the table with that gap.
 */
export function planRepairs(input: {
  tables: ReadonlyArray<EventTableRow>;
  guests: ReadonlyArray<AutoSeatGuest>;
  stay: ReadonlyArray<SeatAssignmentRow>;
  rows: ReadonlyArray<{ guest_id: string; table_id: string }>;
  cannotFit: ReadonlyArray<AutoSeatCannotFit>;
  roleSet?: RoleSet;
}): SeatRepair[] {
  const roleSet = input.roleSet ?? WEDDING_ROLE_SET;
  const out: SeatRepair[] = [];
  const after = [...input.stay.map((s) => ({ guest_id: s.guest_id, table_id: s.table_id })), ...input.rows];
  const room = autoSeatRoom(input.tables, input.guests, after, roleSet);
  if (room.shortfall > 0) {
    const chairs = input.tables.filter((t) => autoSeatTakesTable(t)).reduce((n, t) => n + effectiveCapacity(t.capacity, t.removed_seats), 0);
    out.push({
      kind: 'add_tables',
      tables: Math.ceil(room.shortfall / 10),
      coming: guestsStillToSeat(input.guests, new Set(), roleSet).length,
      chairs,
    });
  }
  const count = new Map<string, number>();
  for (const s of after) count.set(s.table_id, (count.get(s.table_id) ?? 0) + 1);
  const gapOf = (t: EventTableRow) => effectiveCapacity(t.capacity, t.removed_seats) - (count.get(t.table_id) ?? 0);
  const open = input.tables.filter((t) => autoSeatTakesTable(t) && !t.table_id.startsWith(NEW));
  for (const c of input.cannotFit) {
    if (c.kind !== 'no_room' || c.guestIds.length < 2) continue;
    const best = open.filter((t) => gapOf(t) > 0).sort((a, b) => gapOf(b) - gapOf(a) || a.sort_order - b.sort_order)[0];
    if (!best) continue;
    const gap = gapOf(best);
    const need = c.guestIds.length;
    // Only when a few more chairs make it fit; a whole new table is the other repair.
    if (need - gap > 0 && best.capacity + (need - gap) <= 32) {
      out.push({ kind: 'add_seats', tableId: best.table_id, seats: need - gap, guestIds: c.guestIds, need, gap });
    }
  }
  return out;
}

/** "X of Y seated · N rules broken · N wishes not met · N guests get a seat". */
export function previewSummaryWords(p: Pick<ArrangePreview, 'seated' | 'coming' | 'rulesBroken' | 'wishesNotMet' | 'newSeats'>): string {
  const n = (v: number, one: string, many: string) => `${formatCount(v)} ${v === 1 ? one : many}`;
  return [
    `${formatCount(p.seated)} of ${formatCount(p.coming)} seated`,
    n(p.rulesBroken, 'rule broken', 'rules broken'),
    n(p.wishesNotMet, 'wish not met', 'wishes not met'),
    n(p.newSeats, 'guest gets a seat', 'guests get a seat'),
  ].join(' · ');
}

/** A repair in plain words. `nameOf` gives a guest's name, `tableName` a table's SHOWN name. */
export function repairWords(r: SeatRepair, nameOf: (guestId: string) => string, tableName: (tableId: string) => string): string {
  if (r.kind === 'add_tables') {
    return `Not enough seats: ${formatCount(r.coming)} coming, ${formatCount(r.chairs)} ${r.chairs === 1 ? 'chair' : 'chairs'}. Add ${formatCount(r.tables)} ${r.tables === 1 ? 'table' : 'tables'}`;
  }
  const who = nameOf(r.guestIds[0] ?? '') || 'A guest';
  return `${who}’s party needs ${formatCount(r.need)} seats together; the biggest gap is ${formatCount(r.gap)}. Add ${formatCount(r.seats)} ${r.seats === 1 ? 'seat' : 'seats'} to ${tableName(r.tableId)}`;
}

/** Read the plan Accept was handed back (the editor round-trips it). Anything malformed is null — nothing is written. */
export function parseArrangePlan(raw: unknown): ArrangePlan | null {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
  if (!isStr(o.base) || !Array.isArray(o.clear) || !Array.isArray(o.newTables) || !Array.isArray(o.rows)) return null;
  if (!o.clear.every(isStr)) return null;
  const rows = o.rows as Array<Record<string, unknown>>;
  if (!rows.every((r) => r && isStr(r.guest_id) && isStr(r.table) && Number.isInteger(r.seat_number))) return null;
  const newTables = o.newTables as Array<Record<string, unknown>>;
  if (!newTables.every((t) => t && isStr(t.key) && isStr(t.label) && isStr(t.type) && Number.isInteger(t.capacity))) return null;
  const positions: Record<string, { x: number; y: number }> = {};
  if (o.positions && typeof o.positions === 'object') {
    for (const [id, p] of Object.entries(o.positions as Record<string, unknown>)) {
      const q = p as { x?: unknown; y?: unknown } | null;
      if (q && Number.isFinite(Number(q.x)) && Number.isFinite(Number(q.y))) positions[id] = { x: Number(q.x), y: Number(q.y) };
    }
  }
  return {
    base: o.base,
    clear: o.clear as string[],
    newTables: newTables as unknown as PlanNewTable[],
    positions,
    rows: rows as unknown as ArrangePlan['rows'],
  };
}
