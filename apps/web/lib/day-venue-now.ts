/**
 * 🗺 ON THE DAY, DIRECTIONS GO TO ONE PLACE — WHERE THINGS ARE HAPPENING NOW
 * (owner 2026-10-01, DECISION_LOG "THE DAY GUEST PAGES — APPROVED, WITH
 * ANSWERS", verbatim: *"directions to the location/venue where things are
 * happening is only 1 of 2."*).
 *
 * An event with a ceremony venue and a reception venue shows directions to the
 * one the current or next moment is at — before the ceremony is over, the
 * ceremony venue; after it, the reception — never both stacked. Every reader
 * on the day asks THIS function (the Live tab's directions, the Welcome tab's
 * venue, the couple's venue scene on the day), so two of them can never point
 * a guest at two different churches.
 *
 * WHEN THE CEREMONY IS OVER, from the data only — nothing guessed:
 *   1. the run of show says so (`run_state = 'done'` or an `actual_end_at`);
 *   2. otherwise its own `end_at` has passed;
 *   3. otherwise the next top-level moment after it has started (the
 *      reception's first block, or whatever the couple put next).
 * With none of those, the ceremony is still the place to go.
 *
 * 🕐 Schedule times are the venue's wall clock parked in UTC (`lib/schedule.ts`
 * `venueNowMs`), so `nowMs` must be `venueNowMs(eventTz)` — never `Date.now()`.
 *
 * Pure: no I/O.
 */
import type { EventVenue } from '@/lib/event-venues';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { ceremonyBlock } from '@/lib/print-pieces';

type Block = Pick<ScheduleBlockRow, 'block_type' | 'start_at' | 'end_at' | 'parent_block_id' | 'run_state' | 'actual_end_at'> &
  Partial<ScheduleBlockRow>;

const at = (v: string | null | undefined): number => (v ? Date.parse(v) : Number.NaN);

/** Is the ceremony over at `nowMs`? (See the module docblock for the order of evidence.) */
export function ceremonyIsOver(blocks: readonly Block[], nowMs: number): boolean {
  const c = ceremonyBlock(blocks as ScheduleBlockRow[]);
  if (!c) return false;
  if (c.run_state === 'done' || c.actual_end_at) return true;
  if (c.run_state === 'live') return false;
  const end = at(c.end_at);
  if (Number.isFinite(end)) return nowMs >= end;
  const start = at(c.start_at);
  const next = blocks
    .filter((b) => !b.parent_block_id && b !== c && Number.isFinite(at(b.start_at)) && at(b.start_at) > start)
    .map((b) => at(b.start_at))
    .sort((a, b) => a - b)[0];
  return next !== undefined && nowMs >= next;
}

/**
 * The ONE venue a guest is pointed at on the day, or null when the event has
 * none. One venue (or one that is both) → that venue. Two → the ceremony's
 * until the ceremony is over, then the reception's.
 */
export function dayVenueNow(input: {
  venues: readonly EventVenue[] | null | undefined;
  blocks: readonly Block[] | null | undefined;
  nowMs: number;
}): EventVenue | null {
  const venues = input.venues ?? [];
  if (venues.length <= 1) return venues[0] ?? null;
  const ceremony = venues.find((v) => v.role === 'ceremony') ?? null;
  const reception = venues.find((v) => v.role === 'reception') ?? null;
  if (!ceremony || !reception) return venues[0] ?? null;
  return ceremonyIsOver(input.blocks ?? [], input.nowMs) ? reception : ceremony;
}

/** The venue list a day reader draws: the one place, or nothing. */
export function dayVenuesNow(input: Parameters<typeof dayVenueNow>[0]): EventVenue[] {
  const v = dayVenueNow(input);
  return v ? [v] : [];
}
