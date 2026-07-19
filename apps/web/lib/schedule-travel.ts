/**
 * schedule-travel.ts — travel multi-day itineraries on the existing schedule
 * spine (ai-travel-scheduling · Setnayan_AI_Gap_Leaves_Travel_Dinner_Date
 * 2026-07-17 Part B).
 *
 * Travel is `multi_day` + `layer_mode='roaming'`: one trip, several days. Two
 * reservation classes lay onto the ONE `event_schedule_blocks` timeline —
 * no new table, no new conflict primitive:
 *
 *   • NIGHT-BLOCKS (`block_type='lodging'`) — a hotel stay spans
 *     check-in (start_at) → check-out (end_at) across days. Multiple hotels =
 *     sequential night-blocks (Hotel A nights 1–2, Hotel B nights 3–4).
 *     `expandLodgingNights` is the per-day expansion: a lodging block covers
 *     every NIGHT from its check-in day up to (not including) its check-out
 *     day — the composable "room × nights" geometry.
 *
 *   • TIME-BLOCKS (`block_type='tour'`) — the `tour_activity` taxonomy leaf
 *     is not just a vendor category, it generates a schedule block (start/end)
 *     on the trip. No two tours may overlap: a double-book is rejected at
 *     save (`findTourOverlap`) and any pre-existing overlap surfaces through
 *     the AI's existing GRD-06 clash guard ("Two things land on {slot}:
 *     {item_a} and {item_b}") — reused, never re-invented.
 *
 * The lodging guard flags a trip night with NO hotel booked (a gap in
 * lodging). Everything here is pure — same inputs, same outputs, no I/O —
 * so the whole itinerary engine is unit-testable (schedule-travel.test.ts)
 * and free (Rule 1: deterministic, no per-call cost).
 *
 * Timezone contract: schedule times are stored as the naive event-local
 * wall-clock at UTC ("…T14:00:00Z" = 2 PM at the venue — see lib/schedule.ts).
 * All day math + formatting below therefore reads UTC fields, which keeps it
 * deterministic on any machine.
 *
 * INERT for non-travel events: nothing imports this module outside the
 * travel-only branches of the schedule surface + the travel-type checks in
 * the schedule server actions.
 */

import type { ScheduleBlockType } from './schedule';
import { renderTemplate } from './setnayan-ai-templates';

// ─────────────────────────────── type gates ────────────────────────────────

export const TRAVEL_EVENT_TYPE = 'travel';

export function isTravelEventType(eventType: string | null | undefined): boolean {
  return eventType === TRAVEL_EVENT_TYPE;
}

/** The two travel-only block types. Offered ONLY by the travel add-form and
 *  rejected server-side for any other event type, so every non-travel
 *  schedule surface stays byte-identical. */
export const TRAVEL_ONLY_BLOCK_TYPES: ReadonlyArray<ScheduleBlockType> = [
  'lodging',
  'tour',
];

export function isTravelOnlyBlockType(t: string): boolean {
  return t === 'lodging' || t === 'tour';
}

/** The trip-shaped block-type menu for the travel add-form: the two itinerary
 *  classes first, then the generic types that make sense on a trip. */
export const TRAVEL_SCHEDULE_BLOCK_TYPES: ReadonlyArray<ScheduleBlockType> = [
  'lodging',
  'tour',
  'dinner',
  'program',
  'send_off',
  'custom',
];

// ───────────────────────────── structural shapes ────────────────────────────

/** Minimal structural subset of ScheduleBlockRow the itinerary math needs —
 *  the page rows, test fixtures, and save-time candidates all fit it. */
export type TravelBlock = {
  block_id: string;
  label: string;
  block_type: ScheduleBlockType | string;
  start_at: string;
  end_at: string | null;
  parent_block_id?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Hard cap on per-night expansion / itinerary length. A trip is days-to-weeks;
 *  anything longer is a typo'd check-out we refuse to explode into rows. */
export const MAX_ITINERARY_DAYS = 60;

// ────────────────────────────── day-key helpers ─────────────────────────────

/** ISO timestamp → its event-local day key ('YYYY-MM-DD', read as UTC per the
 *  wall-clock-at-UTC storage contract). Null for an unparseable value. */
export function travelDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dayKeyToUtcMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00Z`);
}

function addDays(dayKey: string, days: number): string {
  return new Date(dayKeyToUtcMs(dayKey) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** 'Sat, Aug 3' — deterministic (UTC-read) label for a day key. */
export function formatTravelDay(dayKey: string): string {
  return new Date(dayKeyToUtcMs(dayKey)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatClock(iso: string): string {
  return (
    new Date(iso)
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      })
      // Newer ICU builds put a narrow no-break space (U+202F) before AM/PM;
      // normalize so guard copy renders (and tests compare) identically on
      // every Node/browser.
      .replace(/\u202f/g, ' ')
  );
}

// ──────────────────────── night-block (lodging) expansion ───────────────────

function isTopLevel(b: TravelBlock): boolean {
  return (b.parent_block_id ?? null) === null;
}

function lodgingBlocks<T extends TravelBlock>(blocks: readonly T[]): T[] {
  return blocks.filter((b) => b.block_type === 'lodging' && isTopLevel(b));
}

function tourBlocks<T extends TravelBlock>(blocks: readonly T[]): T[] {
  return blocks.filter((b) => b.block_type === 'tour' && isTopLevel(b));
}

/**
 * Per-day expansion of one hotel night-block: the day keys of every NIGHT the
 * stay covers — check-in day up to (not including) check-out day. A stay with
 * no end_at, an end on the same day, or an inverted range counts as ONE night
 * (the check-in night) so a half-filled form still reads as a stay instead of
 * vanishing. Expansion is capped at MAX_ITINERARY_DAYS nights.
 */
export function expandLodgingNights(block: TravelBlock): string[] {
  const checkIn = travelDayKey(block.start_at);
  if (!checkIn) return [];
  const checkOut = travelDayKey(block.end_at);
  if (!checkOut || checkOut <= checkIn) return [checkIn];
  const nights: string[] = [];
  let cursor = checkIn;
  while (cursor < checkOut && nights.length < MAX_ITINERARY_DAYS) {
    nights.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return nights;
}

// ───────────────────────────── itinerary building ───────────────────────────

export type TravelItineraryDay<T extends TravelBlock = TravelBlock> = {
  /** 'YYYY-MM-DD' event-local day. */
  dayKey: string;
  /** 1-based position in the trip. */
  dayNumber: number;
  /** 'Sat, Aug 3'. */
  dateLabel: string;
  /** Lodging night-blocks covering THIS night (usually 0 or 1). */
  lodging: T[];
  /** Tour time-blocks starting this day, in start order. */
  tours: T[];
  /** TRUE when this is a trip night with no hotel booked. Never true on the
   *  final itinerary day (check-out / going-home day needs no night). */
  isLodgingGap: boolean;
};

export type TravelItinerary<T extends TravelBlock = TravelBlock> = {
  days: TravelItineraryDay<T>[];
  /** TRUE when the itinerary spans more than one day. */
  isMultiDay: boolean;
};

/**
 * The day-by-day lens over the one master timeline. The day domain is the
 * union of the event's own date range (event_date … event_end_date, when set)
 * and every day any block touches (tour start days + lodging nights + the
 * final check-out day), capped at MAX_ITINERARY_DAYS. Pure filter — the
 * blocks are never copied or mutated, so an edit to a master row is instantly
 * visible here (same discipline as lib/schedule-ros.ts).
 */
export function buildTravelItinerary<T extends TravelBlock>(
  blocks: readonly T[],
  opts: { tripStart?: string | null; tripEnd?: string | null } = {},
): TravelItinerary<T> {
  const dayKeys = new Set<string>();

  const tripStart = travelDayKey(opts.tripStart ?? null);
  const tripEnd = travelDayKey(opts.tripEnd ?? null);
  if (tripStart) {
    dayKeys.add(tripStart);
    if (tripEnd && tripEnd > tripStart) {
      let cursor = tripStart;
      while (cursor < tripEnd && dayKeys.size < MAX_ITINERARY_DAYS) {
        cursor = addDays(cursor, 1);
        dayKeys.add(cursor);
      }
    }
  }

  const lodging = lodgingBlocks(blocks);
  const tours = tourBlocks(blocks);

  const nightsByBlock = new Map<string, string[]>();
  for (const b of lodging) {
    const nights = expandLodgingNights(b);
    nightsByBlock.set(b.block_id, nights);
    for (const n of nights) dayKeys.add(n);
    // The check-out morning is still a trip day even with no night there.
    const checkOut = travelDayKey(b.end_at);
    if (checkOut) dayKeys.add(checkOut);
  }
  for (const t of tours) {
    const day = travelDayKey(t.start_at);
    if (day) dayKeys.add(day);
  }

  const orderedDays = [...dayKeys].sort().slice(0, MAX_ITINERARY_DAYS);
  const lastDay = orderedDays[orderedDays.length - 1];

  const days: TravelItineraryDay<T>[] = orderedDays.map((dayKey, idx) => {
    const nightLodging = lodging.filter((b) =>
      (nightsByBlock.get(b.block_id) ?? []).includes(dayKey),
    );
    const dayTours = tours
      .filter((t) => travelDayKey(t.start_at) === dayKey)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    return {
      dayKey,
      dayNumber: idx + 1,
      dateLabel: formatTravelDay(dayKey),
      lodging: nightLodging,
      tours: dayTours,
      // A night is expected on every itinerary day EXCEPT the last (that is
      // the check-out / going-home day). Single-day domains have no nights.
      isLodgingGap:
        orderedDays.length > 1 && dayKey !== lastDay && nightLodging.length === 0,
    };
  });

  return { days, isMultiDay: days.length > 1 };
}

// ─────────────────────────── clash detection (GRD-06) ───────────────────────

export type TravelClash =
  | {
      kind: 'tour_overlap';
      /** The two clashing tour labels, in start order. */
      itemA: string;
      itemB: string;
      /** The shared slot — 'Sat, Aug 3 · 2:00 PM – 3:30 PM'. */
      slot: string;
      dayKey: string;
    }
  | {
      kind: 'lodging_gap';
      /** Consecutive uncovered nights, ascending. */
      nights: string[];
      /** 'the night of Sat, Aug 3' / 'the nights of Sat, Aug 3 – Mon, Aug 5'. */
      label: string;
    };

type Interval = { startMs: number; endMs: number };

function tourInterval(b: TravelBlock): Interval | null {
  const startMs = Date.parse(b.start_at);
  if (Number.isNaN(startMs)) return null;
  const endRaw = b.end_at ? Date.parse(b.end_at) : Number.NaN;
  // A tour with no/invalid end is a point in time — it clashes only when it
  // sits strictly inside another tour's window.
  const endMs = Number.isNaN(endRaw) || endRaw < startMs ? startMs : endRaw;
  return { startMs, endMs };
}

/** Strict interval overlap; back-to-back (A ends exactly when B starts) is fine. */
function overlaps(a: Interval, b: Interval): boolean {
  const aEnd = Math.max(a.endMs, a.startMs + 1);
  const bEnd = Math.max(b.endMs, b.startMs + 1);
  return a.startMs < bEnd && b.startMs < aEnd;
}

function overlapSlot(a: Interval, b: Interval): string {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  const startIso = new Date(startMs).toISOString();
  const day = formatTravelDay(startIso.slice(0, 10));
  if (endMs <= startMs) return `${day} · ${formatClock(startIso)}`;
  return `${day} · ${formatClock(startIso)} – ${formatClock(new Date(endMs).toISOString())}`;
}

/**
 * Save-time double-book check: the first EXISTING tour block the candidate
 * tour overlaps, or null when the slot is clear. `excludeBlockId` skips the
 * candidate's own row on an update. Pure — the server action feeds it the
 * event's current rows.
 */
export function findTourOverlap<T extends TravelBlock>(
  candidate: { start_at: string; end_at: string | null; block_id?: string | null },
  blocks: readonly T[],
  excludeBlockId?: string | null,
): T | null {
  const cand = tourInterval({
    block_id: 'candidate',
    label: '',
    block_type: 'tour',
    start_at: candidate.start_at,
    end_at: candidate.end_at,
  });
  if (!cand) return null;
  const exclude = excludeBlockId ?? candidate.block_id ?? null;
  for (const b of tourBlocks(blocks)) {
    if (exclude !== null && b.block_id === exclude) continue;
    const iv = tourInterval(b);
    if (iv && overlaps(cand, iv)) return b;
  }
  return null;
}

/**
 * The GRD-06-worded rejection for a save-time double-book: the candidate tour
 * lands on the same slot as an existing one. Used by the schedule server
 * actions ("no two activities may overlap — a double-book is rejected at
 * save"); the copy is the AI's clash guard verbatim so the warning reads the
 * same wherever it surfaces.
 */
export function tourDoubleBookMessage(
  candidate: { label: string; start_at: string; end_at: string | null },
  conflict: TravelBlock,
): string {
  const candIv = tourInterval({
    block_id: 'candidate',
    label: candidate.label,
    block_type: 'tour',
    start_at: candidate.start_at,
    end_at: candidate.end_at,
  });
  const conflictIv = tourInterval(conflict);
  const slot =
    candIv && conflictIv
      ? overlapSlot(candIv, conflictIv)
      : (travelDayKey(candidate.start_at) ?? candidate.start_at);
  return renderTemplate('GRD-06', {
    item_a: conflict.label,
    item_b: candidate.label,
    slot,
  });
}

function gapLabel(nights: string[]): string {
  const first = nights[0]!;
  const last = nights[nights.length - 1]!;
  return nights.length === 1
    ? `the night of ${formatTravelDay(first)}`
    : `the nights of ${formatTravelDay(first)} – ${formatTravelDay(last)}`;
}

/**
 * The travel clash guard: every tour-overlap pair (GRD-06's "two things land
 * on {slot}") + every run of trip nights with no hotel booked. Deterministic
 * order — overlaps by slot time, then gaps by night.
 */
export function detectTravelClashes(
  blocks: readonly TravelBlock[],
  opts: { tripStart?: string | null; tripEnd?: string | null } = {},
): TravelClash[] {
  const clashes: TravelClash[] = [];

  // 1 · tour overlaps — each clashing pair, earliest first.
  const tours = tourBlocks(blocks)
    .map((b) => ({ b, iv: tourInterval(b) }))
    .filter((x): x is { b: TravelBlock; iv: Interval } => x.iv !== null)
    .sort((x, y) => x.iv.startMs - y.iv.startMs || x.b.label.localeCompare(y.b.label));
  for (let i = 0; i < tours.length; i++) {
    for (let j = i + 1; j < tours.length; j++) {
      const a = tours[i]!;
      const b = tours[j]!;
      if (!overlaps(a.iv, b.iv)) continue;
      const overlapStartMs = Math.max(a.iv.startMs, b.iv.startMs);
      clashes.push({
        kind: 'tour_overlap',
        itemA: a.b.label,
        itemB: b.b.label,
        slot: overlapSlot(a.iv, b.iv),
        dayKey: new Date(overlapStartMs).toISOString().slice(0, 10),
      });
    }
  }

  // 2 · lodging gaps — consecutive uncovered nights, one clash per run.
  const { days } = buildTravelItinerary(blocks, opts);
  let run: string[] = [];
  const flush = () => {
    if (run.length > 0) {
      clashes.push({ kind: 'lodging_gap', nights: run, label: gapLabel(run) });
      run = [];
    }
  };
  for (const day of days) {
    if (day.isLodgingGap) run.push(day.dayKey);
    else flush();
  }
  flush();

  return clashes;
}

/**
 * Traveler-facing copy for a clash. Tour overlaps render the AI's existing
 * GRD-06 guard template VERBATIM ("Two things land on {slot}: {item_a} and
 * {item_b}. That's a clash — want to resolve it now?"); lodging gaps get the
 * spec's "night with no hotel booked" flag. Deterministic string substitution
 * only — no model, no cost.
 */
export function travelClashCopy(clash: TravelClash): string {
  if (clash.kind === 'tour_overlap') {
    return renderTemplate('GRD-06', {
      item_a: clash.itemA,
      item_b: clash.itemB,
      slot: clash.slot,
    });
  }
  return `No hotel booked for ${clash.label} — a gap in your lodging. Add a stay so every night of the trip is covered.`;
}
