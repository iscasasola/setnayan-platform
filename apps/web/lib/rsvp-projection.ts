/**
 * RSVP attendance projection — pure, deterministic headcount math.
 *
 * The guest list gives the host a CURRENT tally (attending / pending / maybe /
 * declined). What it doesn't give is "how many plates do I actually order?" —
 * the number that matters for catering, seating, and favors, BEFORE every guest
 * has responded. This module turns the current tally into a **Projected
 * Attendance Range** by applying a standard PH-wedding response-rate assumption
 * to the still-undecided guests.
 *
 * Pure + integration-agnostic (mirrors `lib/compat-score.ts` /
 * `lib/budget-allocation.ts`): no Supabase, no React, no clock — same inputs,
 * same output. The caller derives headcounts from the guest list; this module
 * only does the arithmetic.
 *
 * The math is a three-point range, NOT a single point estimate:
 *
 *   low      = confirmed heads only (every undecided guest ends up declining)
 *   expected = confirmed + pendingRate × pending + maybeRate × maybe
 *   high     = confirmed + all pending + all maybe (everyone shows up)
 *
 * `pendingRate` / `maybeRate` are PLANNING ASSUMPTIONS, not prices — surfaced as
 * named, owner-tunable constants rather than buried magic numbers. The 85%
 * default reflects the standard Filipino-wedding pending-acceptance heuristic;
 * "maybe" guests split roughly even, so 50%. Both are overridable per call.
 */

import type { GuestRow, GuestStats } from '@/lib/guests';

/**
 * Standard share of still-PENDING (no-response-yet) guests assumed to attend.
 * PH-wedding planning heuristic — high acceptance once you've invited someone.
 * Owner-tunable (see `Pricing.md` holistic-review note); NOT a price.
 */
export const DEFAULT_PENDING_ATTENDANCE_RATE = 0.85;

/**
 * Standard share of "maybe" (explicitly-undecided) guests assumed to attend.
 * Lower than pending because a "maybe" is a softer signal than silence-so-far.
 */
export const DEFAULT_MAYBE_ATTENDANCE_RATE = 0.5;

export type ProjectionRates = {
  pendingRate: number;
  maybeRate: number;
};

/**
 * Heads (people, not invitations) bucketed by RSVP status. A guest contributes
 * 1 head, plus 1 more when they're allowed a plus-one. The couple are always
 * counted as attending (mirrors the `coupleAttending` coercion in lib/guests).
 */
export type StatusHeadcounts = {
  attending: number;
  pending: number;
  maybe: number;
  declined: number;
};

export type AttendanceProjection = {
  /** Confirmed heads — the floor; these are coming. */
  low: number;
  /** Best single planning number — confirmed + weighted undecided. */
  expected: number;
  /** Ceiling — confirmed + every undecided head shows up. */
  high: number;
  /** Echo of the heads that fed the projection (for UI captions). */
  heads: StatusHeadcounts;
  /** How many undecided heads the range spans (high − low). */
  undecidedHeads: number;
  /** Rates used, so the UI can show "assuming 85% of pending reply yes". */
  rates: ProjectionRates;
};

/** A guest contributes themselves + their plus-one (when allowed). */
function headsForGuest(guest: Pick<GuestRow, 'plus_one_allowed'>): number {
  return 1 + (guest.plus_one_allowed ? 1 : 0);
}

/**
 * Reduce a guest list to per-status HEAD counts (people, incl. plus-ones).
 * The richer counterpart to `computeGuestStats`, which counts guest ROWS — for
 * catering math you need heads, and a plus-one is a head with no row of its own.
 */
export function headcountsFromGuests(
  guests: ReadonlyArray<GuestRow>,
): StatusHeadcounts {
  const heads: StatusHeadcounts = {
    attending: 0,
    pending: 0,
    maybe: 0,
    declined: 0,
  };
  for (const guest of guests) {
    const h = headsForGuest(guest);
    if (guest.rsvp_status === 'attending') heads.attending += h;
    else if (guest.rsvp_status === 'pending') heads.pending += h;
    else if (guest.rsvp_status === 'maybe') heads.maybe += h;
    else if (guest.rsvp_status === 'declined') heads.declined += h;
  }
  return heads;
}

/**
 * Fallback heads-from-stats when only a `GuestStats` (row tally) is on hand.
 * Less precise than `headcountsFromGuests` because `GuestStats.plus_ones` isn't
 * split by status — we attribute every potential plus-one to the still-open
 * (pending + maybe) buckets, which keeps the high end honest without inflating
 * the confirmed floor. Prefer `headcountsFromGuests` when you have the rows.
 */
export function headcountsFromStats(stats: GuestStats): StatusHeadcounts {
  const openRows = stats.pending + stats.maybe;
  const pendingShare =
    openRows > 0 ? Math.round((stats.plus_ones * stats.pending) / openRows) : 0;
  const maybeShare = openRows > 0 ? stats.plus_ones - pendingShare : 0;
  return {
    attending: stats.attending,
    pending: stats.pending + pendingShare,
    maybe: stats.maybe + maybeShare,
    declined: stats.declined,
  };
}

/**
 * Project an attendance RANGE from per-status head counts.
 *
 * Deterministic: identical heads + rates → identical low/expected/high. Rates
 * are clamped to [0, 1] so a bad override can never push `expected` outside the
 * [low, high] envelope.
 *
 * @example
 * projectAttendance({ attending: 80, pending: 40, maybe: 10, declined: 5 });
 * // → { low: 80, expected: 80 + 34 + 5 = 119, high: 130, ... }
 */
export function projectAttendance(
  heads: StatusHeadcounts,
  opts: Partial<ProjectionRates> = {},
): AttendanceProjection {
  const pendingRate = clamp01(opts.pendingRate ?? DEFAULT_PENDING_ATTENDANCE_RATE);
  const maybeRate = clamp01(opts.maybeRate ?? DEFAULT_MAYBE_ATTENDANCE_RATE);

  const low = Math.max(0, Math.round(heads.attending));
  const high = low + Math.max(0, Math.round(heads.pending + heads.maybe));
  const expectedRaw =
    low + heads.pending * pendingRate + heads.maybe * maybeRate;
  // Guard the envelope: expected is always within [low, high].
  const expected = Math.min(high, Math.max(low, Math.round(expectedRaw)));

  return {
    low,
    expected,
    high,
    heads,
    undecidedHeads: high - low,
    rates: { pendingRate, maybeRate },
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
