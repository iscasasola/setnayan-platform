import { wallClockToInstant } from './schedule';
/**
 * Day-of run-of-show — shared types + pure derivation for the "now / next /
 * running ±N min" header.
 *
 * The run-state lives on `event_schedule_blocks` (run_state / actual_start_at /
 * actual_end_at, migration 20270321980372). The host/coordinator (and a booked
 * vendor) advance it via the single-winner advance_schedule_block() RPC. This
 * module is the framework-free core the header component renders from — kept
 * separate so it's unit-testable and importable from server + client without
 * dragging Supabase in.
 */

export type RunState = 'upcoming' | 'live' | 'done';

/** Minimal block shape the header needs — a subset of event_schedule_blocks. */
export type RunOfShowBlock = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  run_state: RunState;
  actual_start_at: string | null;
  /** Schedule block type — feeds the per-trade relevance lens. Empty string when
   *  a legacy row has none, which the lens treats as "no rule", never a throw. */
  block_type?: string;
};

export type RunOfShowState = {
  /** The block currently 'live' (run-state driven), if any. */
  current: RunOfShowBlock | null;
  /** The next block still 'upcoming' after the current one, if any. */
  next: RunOfShowBlock | null;
  /**
   * Signed minutes the live block is running early/late: (actual_start −
   * planned start). Positive = late, negative = early. null when nothing is
   * live or the live block has no actual_start_at yet.
   */
  driftMinutes: number | null;
  /** True once every block is done — the show has wrapped. */
  allDone: boolean;
  /** True while nothing has been advanced yet (all upcoming). */
  notStarted: boolean;
};

/**
 * Order blocks the same way the run-of-show advance does: sort_order is folded
 * in upstream (the queries already order by start_at then sort_order), so here
 * we only need a stable start_at ordering for next-pointer derivation.
 */
function byStart(a: RunOfShowBlock, b: RunOfShowBlock): number {
  const ta = new Date(a.start_at).getTime();
  const tb = new Date(b.start_at).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb) || ta === tb) {
    return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
  }
  return ta - tb;
}

/**
 * Derive the now/next/drift view from the run-state on the blocks. Pure — no
 * wall clock dependency for "current" (run-state is the source of truth, set by
 * advance_schedule_block); the wall clock only feeds the live-block drift label.
 */
/**
 * A stored wall clock → the real instant it denotes at the venue.
 *
 * EXPORTED because three surfaces need it and three copies is how the day-of
 * clock drifted apart in the first place. Any comparison between a schedule
 * time and `now` (or any other real timestamp) must go through here.
 *
 * Returns null if the value or the zone cannot be read, so a caller reports
 * nothing rather than a wrong number.
 */
export function plannedInstant(iso: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return wallClockToInstant(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), tz);
}

export function deriveRunOfShow(
  blocks: ReadonlyArray<RunOfShowBlock>,
  now: Date = new Date(),
  /**
   * The venue's timezone. REQUIRED to state how far ahead or behind the day is
   * running, and omitted deliberately by callers that do not have it — in which
   * case no drift is reported at all.
   *
   * WHY: `start_at` is the venue's WALL CLOCK stored in a UTC column;
   * `actual_start_at` is a real timestamp written by NOW(). Subtracting one from
   * the other mixes two different kinds of value and yields a constant error
   * equal to the venue's UTC offset — so pressing "Start" exactly on time
   * announced the wedding was running 480 MINUTES AHEAD, on the couple's page,
   * the guests' site, the vendor's console and the emcee's desk at once.
   *
   * A wrong number here is worse than none: it tells a coordinator to rush a
   * wedding that is perfectly on time. So without a timezone this reports
   * nothing rather than guessing.
   */
  eventTz?: string,
): RunOfShowState {
  const ordered = [...blocks].sort(byStart);
  const current = ordered.find((b) => b.run_state === 'live') ?? null;

  // Next = the first 'upcoming' block after the current one (or the first
  // upcoming overall when nothing is live yet).
  let next: RunOfShowBlock | null = null;
  if (current) {
    const idx = ordered.findIndex((b) => b.block_id === current.block_id);
    next = ordered.slice(idx + 1).find((b) => b.run_state === 'upcoming') ?? null;
  } else {
    next = ordered.find((b) => b.run_state === 'upcoming') ?? null;
  }

  let driftMinutes: number | null = null;
  if (current?.actual_start_at && eventTz) {
    // The planned time must become a REAL instant before it can be compared
    // with one. Without that conversion the two values are not the same kind
    // of thing and the difference is meaningless.
    const planned = plannedInstant(current.start_at, eventTz);
    const actual = new Date(current.actual_start_at).getTime();
    if (planned !== null && !Number.isNaN(actual)) {
      driftMinutes = Math.round((actual - planned) / 60000);
    }
  }

  const total = ordered.length;
  const doneCount = ordered.filter((b) => b.run_state === 'done').length;
  const upcomingCount = ordered.filter((b) => b.run_state === 'upcoming').length;

  return {
    current,
    next,
    driftMinutes,
    allDone: total > 0 && doneCount === total,
    notStarted: total > 0 && upcomingCount === total,
  };
}

// ── Guest "What's happening now" trigger read (owner directive 2026-07-23) ──
//
// Guest surfaces historically infer "now" from the wall clock. When the host /
// coordinator has actually started the run of show (some block advanced past
// 'upcoming'), the run-state pointer is the truth and the clock is only a
// fallback. These helpers are generic over any block shape carrying an
// OPTIONAL run_state so both the /[slug] widgets (full ScheduleBlockRow) and
// the day-of cards (trimmed shapes) share one derivation — per the § 5 study,
// the derivation lives in lib/ so the in-flight 5-tab hub rebuild can re-home
// the panels without reimplementing it.

type MaybeRunStateBlock = {
  block_id: string;
  start_at: string;
  run_state?: RunState | null;
};

/**
 * True once the host/coordinator has actually taken the wheel — any block is
 * 'live' or 'done'. While false, guest surfaces MUST keep their wall-clock
 * inference (the pointer is unset; there is nothing to follow). Missing /
 * undefined run_state (callers that don't select it) counts as 'upcoming'.
 */
export function hasRunShowSignal(
  blocks: ReadonlyArray<{ run_state?: RunState | null }>,
): boolean {
  return blocks.some((b) => b.run_state === 'live' || b.run_state === 'done');
}

/**
 * Trigger-driven now/next over an arbitrary block shape.
 *
 * Returns null when the show hasn't started (no 'live'/'done' block) — the
 * caller falls back to time inference. Otherwise:
 *   • current — the single 'live' block (advance_schedule_block is
 *     single-winner, so at most one). null = "between moments", INCLUDING the
 *     case where the live block is a private (is_public=false) row the guest
 *     can't see — the caller must degrade gracefully, never tease it.
 *   • next — the first 'upcoming' block after current (or the first upcoming
 *     overall when nothing visible is live).
 */
export function pickTriggerNowNext<T extends MaybeRunStateBlock>(
  blocks: ReadonlyArray<T>,
): { current: T | null; next: T | null } | null {
  if (!hasRunShowSignal(blocks)) return null;
  const ordered = [...blocks].sort((a, b) => {
    const ta = new Date(a.start_at).getTime();
    const tb = new Date(b.start_at).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb) || ta === tb) {
      return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
    }
    return ta - tb;
  });
  const currentIdx = ordered.findIndex((b) => b.run_state === 'live');
  const current = currentIdx >= 0 ? (ordered[currentIdx] ?? null) : null;
  const searchFrom = currentIdx >= 0 ? currentIdx + 1 : 0;
  const next =
    ordered
      .slice(searchFrom)
      .find((b) => (b.run_state ?? 'upcoming') === 'upcoming') ?? null;
  return { current, next };
}

/** Human "running 12 min late" / "8 min early" / "on time" label. */
export function driftLabel(driftMinutes: number | null): string | null {
  if (driftMinutes == null) return null;
  if (driftMinutes === 0) return 'on time';
  const n = Math.abs(driftMinutes);
  const unit = n === 1 ? 'min' : 'min';
  return driftMinutes > 0 ? `${n} ${unit} behind` : `${n} ${unit} ahead`;
}
