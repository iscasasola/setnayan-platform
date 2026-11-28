/**
 * 🪑 THE SHAPES THE SEAT SCREENS READ (seat plan § 4.4 smart layer S + § 4.6 preview D; the controller's contract of
 * 28 Nov so L10's screens and the L11 engine meet):
 *
 *   dryRun(eventId)          → { suggestions: [{ tableId, guestIds, reason, planId }],
 *                                problems:    [{ kind, guestIds, tableId, reason, fix }], line, fixAllPlanId }
 *   previewArrange(eventId…) → { planId, seated, total, rulesBroken, wishesNotMet, getSeat, notMet: [string],
 *                                changes: [{ tableId, add, guestIds, reason, removed }] } | { cannotFit: { rule, repair } }
 *   acceptArrange(eventId, planId) → one transaction (`apply_seat_plan`), one Undo.
 *
 * A `planId` IS the plan: the exact rows Accept writes plus the fingerprint of the seats it was made from, encoded.
 * Taking a suggestion, a fix, Fix all or the whole preview all go through the same Accept — which re-checks every hard
 * rule and refuses a stale plan, so a tampered or old `planId` can never write more than the host could by hand.
 * Pure: words take a `nameOf` and the SHOWN table name (`tableName`, lib/table-auto-name).
 */

import { cannotFitWords, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import { seatPlanBase, parseArrangePlan, previewSummaryWords, repairWords, type ArrangePlan, type ArrangePreview, type SeatRepair } from '@/lib/seat-plan-preview';
import { fixAllMoves, seatCheckLine, seatProblemWords, type SeatDryRun, type SeatProblemKind } from '@/lib/seat-plan-dry-run';

/** The plan plus the preview's own "still without a chair" count, which Accept's toast states. */
export type PlanPayload = ArrangePlan & { unseated: number };

export function encodePlanId(plan: PlanPayload): string {
  return Buffer.from(JSON.stringify(plan), 'utf8').toString('base64url');
}

/** A planId back to its plan, or null (nothing is written for a planId that does not read). */
export function decodePlanId(id: unknown): PlanPayload | null {
  if (typeof id !== 'string' || id.length === 0 || id.length > 400_000) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(id, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const plan = parseArrangePlan(raw);
  const unseated = (raw as { unseated?: unknown })?.unseated;
  if (!plan || typeof unseated !== 'number' || !Number.isInteger(unseated) || unseated < 0) return null;
  return { ...plan, unseated };
}

/**
 * A plan that moves guests to tables (a fix, Fix all): each mover's old seat comes off and they take the lowest free
 * real chairs at their new table, counted after the clears. Null when a table has no chair left for them.
 */
export function planForMoves(
  moves: ReadonlyArray<{ guest_id: string; table_id: string }>,
  tables: ReadonlyArray<EventTableRow>,
  assignments: ReadonlyArray<SeatAssignmentRow>,
  unseated: number,
): PlanPayload | null {
  const moving = new Set(moves.map((m) => m.guest_id));
  const taken = new Map<string, Set<number>>();
  for (const a of assignments) {
    if (moving.has(a.guest_id) || a.seat_number === null) continue;
    taken.set(a.table_id, (taken.get(a.table_id) ?? new Set()).add(a.seat_number));
  }
  const byId = new Map(tables.map((t) => [t.table_id, t] as const));
  const rows: ArrangePlan['rows'] = [];
  for (const m of moves) {
    const t = byId.get(m.table_id);
    if (!t) return null;
    const removed = new Set((t.removed_seats ?? []).filter((n) => Number.isInteger(n)));
    const used = taken.get(t.table_id) ?? new Set<number>();
    let seat = -1;
    for (let i = 0; i < t.capacity; i += 1) if (!removed.has(i) && !used.has(i)) { seat = i; break; }
    if (seat < 0) return null;
    used.add(seat);
    taken.set(t.table_id, used);
    rows.push({ guest_id: m.guest_id, table: m.table_id, seat_number: seat });
  }
  return {
    base: seatPlanBase(assignments),
    clear: moves.map((m) => m.guest_id).filter((id) => assignments.some((a) => a.guest_id === id)),
    newTables: [],
    positions: {},
    rows,
    unseated,
  };
}

export type DryRunView =
  | {
      ok: true;
      suggestions: Array<{ tableId: string; guestIds: string[]; units: string[][]; reason: string; planId: string }>;
      problems: Array<{
        kind: SeatProblemKind;
        guestIds: string[];
        tableId: string;
        reason: string;
        fix: { kind: 'move'; planId: string } | { kind: 'review' };
      }>;
      /** "⚠ N to look at" — null when there is nothing to look at. */
      line: string | null;
      /** Fix all, as ONE plan (null when no problem has a safe move). */
      fixAllPlanId: string | null;
    }
  | { ok: false; line: string };

/** The dry run in the screens' shape: words, and a planId on everything a tap can take. */
export function dryRunView(
  run: SeatDryRun,
  ctx: {
    tables: ReadonlyArray<EventTableRow>;
    assignments: ReadonlyArray<SeatAssignmentRow>;
    /** Guests who still have no chair now (the toast after Accept counts down from it). */
    unseatedNow: number;
    nameOf: (guestId: string) => string;
    tableName: (tableId: string) => string;
  },
): DryRunView {
  if (!run.ok) return { ok: false, line: seatCheckLine(run)! };
  const base = seatPlanBase(ctx.assignments);
  const suggestions = run.suggestions.map((s) => ({
    tableId: s.tableId,
    guestIds: s.rows.map((r) => r.guest_id),
    units: s.units,
    reason: s.reason,
    planId: encodePlanId({
      base,
      clear: [],
      newTables: [],
      positions: {},
      rows: s.rows.map((r) => ({ guest_id: r.guest_id, table: r.table_id, seat_number: r.seat_number })),
      unseated: Math.max(0, ctx.unseatedNow - s.rows.length),
    }),
  }));
  const problems = run.problems.map((p) => {
    const plan = p.fix.kind === 'move' ? planForMoves(p.fix.moves, ctx.tables, ctx.assignments, ctx.unseatedNow) : null;
    return {
      kind: p.kind,
      guestIds: p.guestIds,
      tableId: p.tableIds[0] ?? '',
      reason: seatProblemWords(p, ctx.nameOf, ctx.tableName),
      fix: plan ? ({ kind: 'move', planId: encodePlanId(plan) } as const) : ({ kind: 'review' } as const),
    };
  });
  const all = fixAllMoves(run.problems, ctx.tables, ctx.assignments);
  const allPlan = all.length > 0 ? planForMoves(all, ctx.tables, ctx.assignments, ctx.unseatedNow) : null;
  return { ok: true, suggestions, problems, line: seatCheckLine(run), fixAllPlanId: allPlan ? encodePlanId(allPlan) : null };
}

/** One Not met line in plain words. */
export function notMetWords(n: ArrangePreview['notMet'][number], nameOf: (guestId: string) => string): string {
  if (n.kind === 'keep_apart') {
    const [a, b] = n.guestIds;
    return `${nameOf(a ?? '') || 'A guest'} and ${nameOf(b ?? '') || 'a guest'} share a table`;
  }
  return cannotFitWords([{ kind: n.kind, guestIds: n.guestIds, tableIds: n.tableIds }], nameOf).replace(/^Didn’t fit: /, '');
}

export type ArrangeView =
  | {
      planId: string;
      seated: number;
      total: number;
      rulesBroken: number;
      wishesNotMet: number;
      getSeat: number;
      summary: string;
      notMet: string[];
      changes: Array<{ tableId: string; add: number; guestIds: string[]; removed: string[]; reason: string; label: string }>;
    }
  | { cannotFit: { rule: string; repair: SeatRepair; repairs: Array<{ rule: string; repair: SeatRepair }>; planId: string | null } };

/**
 * The preview in the screens' shape. When the plan cannot seat everyone for a nameable reason (`repairs`), it is
 * `cannotFit` with the first rule in words and its one-tap repair — plus the partial plan's `planId` (null when it seats
 * nobody new), so the host may still take what fits.
 */
export function arrangeView(
  p: ArrangePreview,
  ctx: { nameOf: (guestId: string) => string; tableName: (tableId: string) => string },
): ArrangeView {
  const planId = encodePlanId({ ...p.plan, unseated: Math.max(0, p.coming - p.seated) });
  if (p.repairs.length > 0) {
    const repairs = p.repairs.map((r) => ({ rule: repairWords(r, ctx.nameOf, ctx.tableName), repair: r }));
    return { cannotFit: { rule: repairs[0]!.rule, repair: repairs[0]!.repair, repairs, planId: p.newSeats > 0 ? planId : null } };
  }
  return {
    planId,
    seated: p.seated,
    total: p.coming,
    rulesBroken: p.rulesBroken,
    wishesNotMet: p.wishesNotMet,
    getSeat: p.newSeats,
    summary: previewSummaryWords(p),
    notMet: p.notMet.map((n) => notMetWords(n, ctx.nameOf)),
    changes: p.tables.map((t) => ({
      tableId: t.table,
      add: t.added.length,
      guestIds: t.added,
      removed: t.removed,
      reason: t.reason,
      // A new table has no shown name yet: its label.
      label: t.table.startsWith('new:') ? t.label : ctx.tableName(t.table),
    })),
  };
}

/** How many of `guests` still have no chair (not declined, not the couple), for the toast's honest count. */
export function stillUnseated(
  seatable: number,
  assignments: ReadonlyArray<Pick<SeatAssignmentRow, 'guest_id'>>,
  seatableIds: ReadonlySet<string>,
): number {
  return Math.max(0, seatable - assignments.filter((a) => seatableIds.has(a.guest_id)).length);
}

