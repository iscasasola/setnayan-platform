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
export function deriveRunOfShow(
  blocks: ReadonlyArray<RunOfShowBlock>,
  now: Date = new Date(),
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
  if (current?.actual_start_at) {
    const planned = new Date(current.start_at).getTime();
    const actual = new Date(current.actual_start_at).getTime();
    if (!Number.isNaN(planned) && !Number.isNaN(actual)) {
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
