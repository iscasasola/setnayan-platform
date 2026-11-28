/**
 * seat-check.ts — ✦ SEAT PLAN S · THE SMART LAYER'S WORDS (owner 28 Nov 2026, DECISION_LOG; `SEAT-PLAN-COMPLETE-2026-11-27.md`
 * § 4.4; drawing `prototypes/seating_later_2026-11-27/` S). No new page: a strip on a card, one line under the counts, one
 * Sheet.
 *
 * The answers come from the engine's DRY RUN (the engine lane, L11): `dryRun(eventId)` →
 * `{ suggestions: [{ tableId, guestIds, reason }], problems: [{ kind, guestIds, tableId, reason, fix }] }`. This file is the
 * UI's side of that shape — the types, and the words each piece says — so the screens build against it before the engine
 * lands. A dry run that FAILED is its own state: never read as "no problems", never a false "All good".
 *
 * PURE. No guest name leaves the device for any outside AI: the reasons are the solver's own score terms, in words.
 * 🔒 lib/the-seat-check-is-honest.test.ts
 */

export type SeatSuggestion = {
  tableId: string;
  /** The guests the solver would seat here — a guest with their +1s / household, as one unit. */
  guestIds: readonly string[];
  /** Why, in plain words (the solver's score terms): "Santos family · 2 parties · groom's side". */
  reason: string;
};

export type SeatProblemKind = 'household_split' | 'plus_one_apart' | 'elder_near_speaker' | 'table_over' | 'new_rsvp_alone';

/** A problem's one press: seat these guests at that table, or open the table to look. */
export type SeatProblemFix = { kind: 'seat'; tableId: string; guestIds: readonly string[] } | { kind: 'review'; tableId: string };

export type SeatProblem = {
  kind: SeatProblemKind;
  guestIds: readonly string[];
  tableId: string | null;
  /** Plain words: "Ben sits at Table 4, apart from Ana". */
  reason: string;
  fix: SeatProblemFix;
};

export type DryRun = { suggestions: readonly SeatSuggestion[]; problems: readonly SeatProblem[] };

/** What the plan knows about its own check: not run yet, read, or failed (never a false "All good"). */
export type SeatCheckState = { status: 'idle' } | { status: 'read'; run: DryRun } | { status: 'failed' };

/** The ONE line under the counts — null when there is nothing to say (no problems, or nothing read yet). */
export function seatCheckLine(state: SeatCheckState): { words: string; failed: boolean } | null {
  if (state.status === 'failed') return { words: 'Couldn’t check seats · Try again', failed: true };
  if (state.status !== 'read') return null;
  const n = state.run.problems.length;
  // Drawn with the warning icon before and the chevron after ("⚠ N to look at ›") — the words are these.
  return n > 0 ? { words: `${n} to look at`, failed: false } : null;
}

/** Each kind's heading in the Sheet. */
export const SEAT_PROBLEM_TITLES: Readonly<Record<SeatProblemKind, string>> = {
  household_split: 'A household is split',
  plus_one_apart: 'A +1 sits apart',
  elder_near_speaker: 'Elders near a speaker',
  table_over: 'A table is over its seats',
  new_rsvp_alone: 'A new RSVP sits alone',
};

/** Each check said the way it reads when it came back clean — the Sheet's "All good" list. */
export const SEAT_CHECK_GOOD: Readonly<Record<SeatProblemKind, string>> = {
  household_split: 'Households sit together',
  plus_one_apart: 'Every +1 sits with their guest',
  elder_near_speaker: 'Elders sit away from the speakers',
  table_over: 'No table is over its seats',
  new_rsvp_alone: 'New RSVPs sit with someone they know',
};

/** The checks that came back clean — the Sheet's "All good" list (only from a dry run that was READ). */
export function seatChecksAllGood(run: DryRun): SeatProblemKind[] {
  const found = new Set(run.problems.map((p) => p.kind));
  return (Object.keys(SEAT_PROBLEM_TITLES) as SeatProblemKind[]).filter((k) => !found.has(k));
}

/** The strip's seat words for the free chairs a suggestion takes: "Seat 7" · "Seats 7 and 8" · "Seats 3, 5 and 9". */
export function suggestionSeatWords(seats: readonly number[], fmt: (n: number) => string = String): string {
  const n = seats.map((s) => s + 1);
  if (n.length === 0) return '';
  if (n.length === 1) return `Seat ${fmt(n[0]!)}`;
  return `Seats ${n.slice(0, -1).map(fmt).join(', ')} and ${fmt(n[n.length - 1]!)}`;
}

/** The suggestion for one table that still fits its free chairs (the first such, by the solver's order). */
export function suggestionFor(run: DryRun | null, tableId: string, freeChairs: number): SeatSuggestion | null {
  if (!run) return null;
  return run.suggestions.find((s) => s.tableId === tableId && s.guestIds.length > 0 && s.guestIds.length <= freeChairs) ?? null;
}
