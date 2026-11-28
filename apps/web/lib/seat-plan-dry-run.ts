/**
 * ✦ THE SMART LAYER'S DRY RUN (seat plan § 4.4, smart layer S; corpus SEAT-PLAN-COMPLETE-2026-11-27.md).
 *
 * The same seater auto arrange runs (`computeAutoSeat`, fill-only: nobody already seated moves), run with NO WRITES on
 * the rows a screen already read. It feeds:
 *   1. **Card suggestions** — per table with empty seats: who the seater would put there, as units (a guest with their
 *      +1s and kids), with a reason made from the seater's own terms (the group that dominates, how many parties, the
 *      side). Off when the host turned "Suggest seats on the cards" off (`event_floor_plan.seat_suggestions`).
 *   2. **Seat check** — the problems in the plan as it stands: a party split across tables, a +1 apart from their
 *      guest, an elder seated near the speakers, a table holding more people than chairs, a new "yes" the seater put
 *      where they know no one. Each carries one fix: the exact moves that fix it, or "review" when no move is safe.
 *
 * 🔒 Pure: no I/O, nothing written. 🔴 Honest failure: anything that throws returns `{ ok: false }`, so a screen shows
 * "Couldn't check seats · Try again" and never a false "All good" (`seatCheckLine`). 🔏 No guest name leaves this file:
 * reasons come from the score terms, never from an outside AI (Data Privacy Act; NPC Advisory 2024-04).
 */

import {
  SPEAKERS_NEAR_PCT,
  autoSeatTakesTable,
  computeAutoSeat,
  effectiveCapacity,
  elderTableOrder,
  isElderRole,
  isVipTable,
  seatRoomPoints,
  type AutoSeatGuest,
  type EventTableRow,
  type FloorPlanRow,
  type SeatAssignmentRow,
} from '@/lib/seating';
import { WEDDING_ROLE_SET, type RoleSet } from '@/lib/role-sets';
import { formatCount } from '@/lib/format-number';

export type DryRunGuest = AutoSeatGuest & { side?: 'bride' | 'groom' | 'both' | null };

export type DryRunFloor = Pick<
  FloorPlanRow,
  | 'stage_x'
  | 'stage_y'
  | 'priority_order'
  | 'role_seating'
  | 'vip_plus_ones'
  | 'seat_suggestions'
  | 'entrance_enabled'
  | 'entrance_x'
  | 'entrance_y'
  | 'service_entrance_enabled'
  | 'service_entrance_x'
  | 'service_entrance_y'
  | 'speakers_enabled'
  | 'speakers_x'
  | 'speakers_y'
>;

export type DryRunInput = {
  tables: ReadonlyArray<EventTableRow>;
  guests: ReadonlyArray<DryRunGuest>;
  assignments: ReadonlyArray<SeatAssignmentRow>;
  /** group_id → the group's label (the reason names the group). */
  groupLabels: ReadonlyMap<string, string>;
  floor: DryRunFloor;
  roleSet?: RoleSet;
  groupAdjacency?: boolean;
  /** "New" = seated by the seater within `NEW_RSVP_DAYS` of this moment. */
  now?: Date;
};

/** One suggestion strip on a card: ✦ the names, the reason, "Seat N". `units` share a table and are seated together. */
export type CardSuggestion = {
  tableId: string;
  units: string[][];
  rows: Array<{ guest_id: string; table_id: string; seat_number: number }>;
  reason: string;
};

export type SeatProblemKind = 'party_split' | 'plus_one_apart' | 'elder_near_speakers' | 'over_capacity' | 'new_rsvp_alone';

/** The one fix a problem offers: these moves (each guest to a table), or "review" when no move is safe. */
export type SeatFix = { kind: 'move'; moves: Array<{ guest_id: string; table_id: string }> } | { kind: 'review' };

export type SeatProblem = { kind: SeatProblemKind; guestIds: string[]; tableIds: string[]; fix: SeatFix; seats?: number };

export type SeatDryRun = { ok: true; suggestions: CardSuggestion[]; problems: SeatProblem[] } | { ok: false };

/** A seat the seater placed this recently is a "new RSVP" for the seat check. */
export const NEW_RSVP_DAYS = 14;

const tablePos = (t: EventTableRow): { x: number; y: number } | null =>
  t.x_pos !== null && t.x_pos !== undefined && t.y_pos !== null && t.y_pos !== undefined ? { x: Number(t.x_pos), y: Number(t.y_pos) } : null;

/** The guest a person came with (their party's head), or themselves. */
function partyHeadOf(g: DryRunGuest, byId: ReadonlyMap<string, DryRunGuest>): string {
  const by = g.plus_one_of_guest_id;
  return by && byId.has(by) ? by : g.guest_id;
}

function sideWords(side: 'bride' | 'groom'): string {
  return side === 'bride' ? 'bride’s side' : 'groom’s side';
}

/** The reason under a suggestion, from the seater's own terms: the dominant group, the parties, the side. */
export function suggestionReason(
  units: ReadonlyArray<ReadonlyArray<DryRunGuest>>,
  groupLabels: ReadonlyMap<string, string>,
): string {
  const people = units.flat();
  const parts: string[] = [];
  const byGroup = new Map<string, number>();
  for (const g of people) if (g.group_id && groupLabels.has(g.group_id)) byGroup.set(g.group_id, (byGroup.get(g.group_id) ?? 0) + 1);
  let top: [string, number] | null = null;
  for (const [id, n] of byGroup) {
    const label = groupLabels.get(id)!;
    if (!top || n > top[1] || (n === top[1] && label.localeCompare(groupLabels.get(top[0])!) < 0)) top = [id, n];
  }
  // A group names the strip only when it holds more than half of the people suggested (the table-name rule's bar).
  if (top && top[1] * 2 > people.length) parts.push(groupLabels.get(top[0])!.trim());
  parts.push(units.length === 1 ? '1 party' : `${formatCount(units.length)} parties`);
  const sides = new Set(people.map((g) => g.side).filter((s): s is 'bride' | 'groom' => s === 'bride' || s === 'groom'));
  if (sides.size === 1 && people.every((g) => g.side === [...sides][0])) parts.push(sideWords([...sides][0]!));
  return parts.join(' · ');
}

/** ✦ Run the seater with no writes and read the plan: the card suggestions and the seat check. */
export function seatPlanDryRun(input: DryRunInput): SeatDryRun {
  try {
    return { ok: true, suggestions: cardSuggestions(input), problems: seatProblems(input) };
  } catch (err) {
    console.error('[seat-plan] dry run failed', err);
    return { ok: false };
  }
}

function cardSuggestions(input: DryRunInput): CardSuggestion[] {
  if (input.floor.seat_suggestions === false) return [];
  const roleSet = input.roleSet ?? WEDDING_ROLE_SET;
  const rows = computeAutoSeat(
    [...input.tables],
    [...input.guests],
    [...input.assignments],
    { x: input.floor.stage_x, y: input.floor.stage_y },
    input.floor.priority_order,
    roleSet,
    input.groupAdjacency ?? true,
    input.floor.role_seating,
    { vipPlusOnes: input.floor.vip_plus_ones, room: seatRoomPoints(input.floor) },
  );
  const byId = new Map(input.guests.map((g) => [g.guest_id, g] as const));
  const byTable = new Map<string, typeof rows>();
  for (const r of rows) byTable.set(r.table_id, [...(byTable.get(r.table_id) ?? []), r]);
  const out: CardSuggestion[] = [];
  // In the plan's order, so the strips read top to bottom like the cards.
  for (const t of input.tables) {
    const here = byTable.get(t.table_id);
    if (!here) continue;
    const units = new Map<string, DryRunGuest[]>();
    for (const r of here) {
      const g = byId.get(r.guest_id);
      if (!g) continue;
      const head = partyHeadOf(g, byId);
      units.set(head, [...(units.get(head) ?? []), g]);
    }
    const list = [...units.values()];
    out.push({
      tableId: t.table_id,
      units: list.map((u) => u.map((g) => g.guest_id)),
      rows: here.map((r) => ({ guest_id: r.guest_id, table_id: r.table_id, seat_number: r.seat_number })),
      reason: suggestionReason(list, input.groupLabels),
    });
  }
  return out;
}

function seatProblems(input: DryRunInput): SeatProblem[] {
  const problems: SeatProblem[] = [];
  const byId = new Map(input.guests.map((g) => [g.guest_id, g] as const));
  const tableById = new Map(input.tables.map((t) => [t.table_id, t] as const));
  const seat = new Map(input.assignments.filter((a) => byId.has(a.guest_id)).map((a) => [a.guest_id, a] as const));
  const count = new Map<string, number>();
  for (const a of seat.values()) count.set(a.table_id, (count.get(a.table_id) ?? 0) + 1);
  const free = (tableId: string) => {
    const t = tableById.get(tableId);
    return t ? effectiveCapacity(t.capacity, t.removed_seats) - (count.get(tableId) ?? 0) : 0;
  };
  // A move INTO a locked table, or of a pinned seat, is never offered: those are "review".
  const canTake = (tableId: string, n: number) => {
    const t = tableById.get(tableId);
    return !!t && t.locked !== true && free(tableId) >= n;
  };
  const movable = (ids: string[]) => ids.every((id) => seat.get(id)?.locked !== true);

  // 1 · Parties apart: a guest and the people they brought (+1s, kids) at more than one table.
  const parties = new Map<string, string[]>();
  for (const g of input.guests) {
    if (g.rsvp_status === 'declined') continue;
    const head = partyHeadOf(g, byId);
    parties.set(head, [...(parties.get(head) ?? []), g.guest_id]);
  }
  for (const [head, members] of parties) {
    if (members.length < 2) continue;
    const headSeat = seat.get(head);
    if (!headSeat) continue;
    const headTable = tableById.get(headSeat.table_id);
    // ⚖ A principal sponsor's +1s sit together nearest the sponsors under "nearest" (owner R3): not a split.
    const away = members.filter((id) => {
      const s = seat.get(id);
      if (!s || s.table_id === headSeat.table_id) return false;
      const g = byId.get(id)!;
      const sponsorsGuest = input.floor.vip_plus_ones === 'nearest' && headTable && isVipTable(headTable) && g.role === 'guest';
      return !sponsorsGuest;
    });
    if (away.length === 0) continue;
    const tables = [...new Set([headSeat.table_id, ...away.map((id) => seat.get(id)!.table_id)])];
    const fix: SeatFix =
      movable(away) && canTake(headSeat.table_id, away.length)
        ? { kind: 'move', moves: away.map((id) => ({ guest_id: id, table_id: headSeat.table_id })) }
        : { kind: 'review' };
    problems.push({ kind: members.length === 2 ? 'plus_one_apart' : 'party_split', guestIds: [head, ...away], tableIds: tables, fix });
  }

  // 2 · Elders near the speakers.
  const room = seatRoomPoints(input.floor);
  if (room.speakers) {
    const sp = room.speakers;
    const near = (t: EventTableRow) => {
      const p = tablePos(t);
      return p !== null && Math.hypot(p.x - sp.x, p.y - sp.y) < SPEAKERS_NEAR_PCT;
    };
    const eldersAt = new Map<string, string[]>();
    for (const a of seat.values()) {
      const g = byId.get(a.guest_id)!;
      const t = tableById.get(a.table_id);
      if (!t || !isElderRole(g.role) || !near(t)) continue;
      eldersAt.set(t.table_id, [...(eldersAt.get(t.table_id) ?? []), g.guest_id]);
    }
    const quiet = elderTableOrder([...input.tables], room, (t) => tablePos(t) ?? { x: sp.x, y: sp.y }).filter((t) => !near(t) && tablePos(t) !== null);
    for (const [tableId, ids] of eldersAt) {
      // Bring their parties with them.
      const moving = [...new Set(ids.flatMap((id) => (parties.get(id) ?? [id]).filter((m) => seat.get(m)?.table_id === tableId)))];
      const to = movable(moving) ? quiet.find((t) => canTake(t.table_id, moving.length)) : undefined;
      problems.push({
        kind: 'elder_near_speakers',
        guestIds: ids,
        tableIds: [tableId],
        fix: to ? { kind: 'move', moves: moving.map((id) => ({ guest_id: id, table_id: to.table_id })) } : { kind: 'review' },
      });
    }
  }

  // 3 · More people than chairs.
  for (const t of input.tables) {
    const n = count.get(t.table_id) ?? 0;
    if (n > effectiveCapacity(t.capacity, t.removed_seats)) {
      problems.push({
        kind: 'over_capacity',
        guestIds: [...seat.values()].filter((a) => a.table_id === t.table_id).map((a) => a.guest_id),
        tableIds: [t.table_id],
        fix: { kind: 'review' },
        seats: effectiveCapacity(t.capacity, t.removed_seats),
      });
    }
  }

  // 4 · A new "yes" the seater put where they know no one (no group-mate, nobody from their party at the table).
  const now = (input.now ?? new Date()).getTime();
  const newSince = now - NEW_RSVP_DAYS * 86_400_000;
  for (const a of seat.values()) {
    if (a.placed_by !== 'auto' || !a.placed_at) continue;
    const at = Date.parse(a.placed_at);
    if (!Number.isFinite(at) || at < newSince) continue;
    const g = byId.get(a.guest_id)!;
    if (g.rsvp_status !== 'attending') continue;
    const party = parties.get(partyHeadOf(g, byId)) ?? [g.guest_id];
    const mates = [...seat.values()].filter((b) => b.table_id === a.table_id && b.guest_id !== a.guest_id).map((b) => byId.get(b.guest_id)!);
    if (mates.length === 0) continue; // an empty table is not "alone among strangers"
    const knows = mates.some((m) => party.includes(m.guest_id) || (g.group_id !== null && m.group_id === g.group_id));
    if (knows) continue;
    // Where their group sits, with room for them and the party at this table: that is the fix.
    const moving = party.filter((id) => seat.get(id)?.table_id === a.table_id);
    const groupTable = g.group_id
      ? [...seat.values()].find((b) => b.table_id !== a.table_id && byId.get(b.guest_id)?.group_id === g.group_id)?.table_id
      : undefined;
    const target = groupTable && autoSeatTakesTable(tableById.get(groupTable)!) && movable(moving) && canTake(groupTable, moving.length) ? groupTable : undefined;
    problems.push({
      kind: 'new_rsvp_alone',
      guestIds: [g.guest_id],
      tableIds: [a.table_id],
      fix: target ? { kind: 'move', moves: moving.map((id) => ({ guest_id: id, table_id: target })) } : { kind: 'review' },
    });
  }
  return problems;
}

/**
 * Fix all: every problem's moves, in order, skipping any that would move a guest twice or overfill a table (counted
 * as the moves land). Problems whose fix is "review" contribute nothing.
 */
export function fixAllMoves(
  problems: ReadonlyArray<SeatProblem>,
  tables: ReadonlyArray<EventTableRow>,
  assignments: ReadonlyArray<SeatAssignmentRow>,
): Array<{ guest_id: string; table_id: string }> {
  const count = new Map<string, number>();
  const at = new Map(assignments.map((a) => [a.guest_id, a.table_id] as const));
  for (const a of assignments) count.set(a.table_id, (count.get(a.table_id) ?? 0) + 1);
  const cap = new Map(tables.map((t) => [t.table_id, effectiveCapacity(t.capacity, t.removed_seats)] as const));
  const moved = new Set<string>();
  const out: Array<{ guest_id: string; table_id: string }> = [];
  for (const p of problems) {
    if (p.fix.kind !== 'move') continue;
    const moves = p.fix.moves.filter((m) => !moved.has(m.guest_id) && at.get(m.guest_id) !== m.table_id);
    const adds = new Map<string, number>();
    for (const m of moves) adds.set(m.table_id, (adds.get(m.table_id) ?? 0) + 1);
    // A problem's moves land together or not at all (a party is never half-fixed).
    if ([...adds].some(([t, n]) => (count.get(t) ?? 0) + n > (cap.get(t) ?? 0))) continue;
    for (const m of moves) {
      const from = at.get(m.guest_id);
      if (from) count.set(from, (count.get(from) ?? 0) - 1);
      count.set(m.table_id, (count.get(m.table_id) ?? 0) + 1);
      at.set(m.guest_id, m.table_id);
      moved.add(m.guest_id);
      out.push(m);
    }
  }
  return out;
}

/** The problem in plain words, for the Seat check `Sheet`. `nameOf` gives a guest's name, `tableName` a table's SHOWN name. */
export function seatProblemWords(p: SeatProblem, nameOf: (guestId: string) => string, tableName: (tableId: string) => string): string {
  const who = nameOf(p.guestIds[0] ?? '') || 'A guest';
  if (p.kind === 'plus_one_apart') return `${who}’s +1 sits apart from them`;
  if (p.kind === 'party_split') return `${who}’s party is split across ${formatCount(p.tableIds.length)} tables`;
  if (p.kind === 'elder_near_speakers') {
    return p.guestIds.length > 1
      ? `${who} +${formatCount(p.guestIds.length - 1)} sit near the speakers at ${tableName(p.tableIds[0]!)}`
      : `${who} sits near the speakers at ${tableName(p.tableIds[0]!)}`;
  }
  if (p.kind === 'over_capacity') return `${tableName(p.tableIds[0]!)} has ${formatCount(p.guestIds.length)} people for ${formatCount(p.seats ?? 0)} seats`;
  return `${who} said yes and sits where they know no one`;
}

/** The one line under the counts: shown only when there is something to look at, and never "All good" on a failed run. */
export function seatCheckLine(run: SeatDryRun): string | null {
  if (!run.ok) return 'Couldn’t check seats · Try again';
  return run.problems.length > 0 ? `⚠ ${formatCount(run.problems.length)} to look at` : null;
}
