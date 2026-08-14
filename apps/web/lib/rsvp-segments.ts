import type { GuestStats } from '@/lib/guests';

/**
 * rsvp-segments.ts — the shape-honest RSVP bar's arithmetic (Overview Phase 4).
 *
 * ── WHY A BAR AND NOT A RING ─────────────────────────────────────────────────
 * The Guests mini used to render a single `ProgressRing` at
 * `attending / total`. A ring is a part-of-whole shape: it can only ever say
 * ONE number, so it said "62%" and silently folded *declined*, *maybe* and
 * *never replied* into the same grey remainder. Those three mean completely
 * different things to a host — a decline is a settled answer, a silence is a
 * chase. The council verdict's "shape-honest widgets" phase asks for the shape
 * to carry the real composition, so a four-state split gets a segmented bar and
 * the genuinely part-of-whole number (budget committed vs target) gets the ring.
 *
 * ── WHY THE PERCENTAGES ARE APPORTIONED, NOT ROUNDED INDEPENDENTLY ───────────
 * Rounding each segment on its own lets the widths sum to 99 or 101, which
 * renders as a hairline gap or a clipped final segment — the sort of thing that
 * looks like a rendering bug on exactly the wide-but-thin element where it is
 * most visible. `apportion` uses the largest-remainder method so the parts
 * always total exactly 100 while staying as close as possible to the true
 * ratios.
 *
 * ── FAIL-HONEST, NOT FAIL-PRETTY ─────────────────────────────────────────────
 * `GuestStats.total` is counted separately from the four status buckets, so a
 * row carrying a status outside the four (a new enum value, a migration
 * mid-flight) would make the buckets sum to LESS than the total. Rather than
 * quietly rescaling the bar to fill itself — which would overstate every
 * segment and hide the discrepancy — the unaccounted remainder becomes its own
 * visible `unaccounted` segment. A bar that fills to 100% is then always
 * telling the truth about the whole invited list.
 */

/** The four RSVP states, plus the fail-honest remainder. */
export type RsvpSegmentKey =
  | 'attending'
  | 'maybe'
  | 'pending'
  | 'declined'
  | 'unaccounted';

export type RsvpSegment = {
  key: RsvpSegmentKey;
  /** Head count in this state. Always > 0 — empty states are dropped. */
  count: number;
  /** Width in percent. The rendered segments sum to exactly 100. */
  pct: number;
  /** Screen-reader / legend wording, already pluralised. */
  label: string;
  /**
   * CSS colour for the segment fill. Every value is a shipped `--sn-*` token —
   * `pending` deliberately reuses the SAME `--sn-warning` amber the council
   * reserved as the non-gold urgency hue (sign-off #5), so "nobody has replied"
   * reads as urgent in the one place a host looks first. There is no
   * `--urgent` token in this codebase and this file does not invent one.
   */
  color: string;
};

/** Fixed render order: settled-yes → soft-yes → silent → settled-no. */
const ORDER: readonly RsvpSegmentKey[] = [
  'attending',
  'maybe',
  'pending',
  'declined',
  'unaccounted',
] as const;

const LABEL_ONE: Readonly<Record<RsvpSegmentKey, string>> = {
  attending: 'attending',
  maybe: 'maybe',
  pending: 'no reply yet',
  declined: 'declined',
  unaccounted: 'not counted',
};

const COLOR: Readonly<Record<RsvpSegmentKey, string>> = {
  attending: 'var(--sn-success)',
  maybe: 'var(--sn-info)',
  pending: 'var(--sn-warning)',
  declined: 'rgb(var(--color-ink) / 0.28)',
  unaccounted: 'rgb(var(--color-ink) / 0.14)',
};

/**
 * Largest-remainder apportionment of 100 across `counts`.
 *
 * Returns integers summing to exactly 100 (or all-zero when the total is 0).
 * Every non-zero count receives at least 1, so a single guest in a state is
 * never rendered as a zero-width segment that the reader cannot see but the
 * legend still claims exists.
 */
export function apportion(counts: readonly number[]): number[] {
  const safe = counts.map((c) => (Number.isFinite(c) && c > 0 ? Math.floor(c) : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total <= 0) return safe.map(() => 0);

  const exact = safe.map((c) => (c / total) * 100);
  // Floor first, but never below 1 for a state that actually has people in it.
  const out = exact.map((v, i) => ((safe[i] ?? 0) > 0 ? Math.max(1, Math.floor(v)) : 0));

  let drift = out.reduce((a, b) => a + b, 0) - 100;

  // Hand back / take away from the largest remainders first. Only segments that
  // can afford it (staying >= 1) ever give a point back, so the minimum holds.
  const byRemainder = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem);

  // drift < 0 → we owe points out; drift > 0 → we must reclaim points.
  let guard = 0;
  while (drift !== 0 && guard < 1000) {
    guard += 1;
    let moved = false;
    if (drift < 0) {
      for (const { i } of byRemainder) {
        if ((safe[i] ?? 0) === 0) continue;
        out[i] = (out[i] ?? 0) + 1;
        drift += 1;
        moved = true;
        if (drift === 0) break;
      }
    } else {
      for (let k = byRemainder.length - 1; k >= 0; k -= 1) {
        const entry = byRemainder[k];
        if (!entry) continue;
        const current = out[entry.i] ?? 0;
        if (current <= 1) continue;
        out[entry.i] = current - 1;
        drift -= 1;
        moved = true;
        if (drift === 0) break;
      }
    }
    // Nothing could legally move — stop rather than spin. Reachable only when
    // there are more than 100 non-empty states, which cannot happen with five.
    if (!moved) break;
  }

  return out;
}

/**
 * Build the rendered segments for a guest list.
 *
 * Returns `[]` when nobody is invited yet — the caller renders no bar at all
 * rather than an empty track, matching the Overview's real-data-or-nothing rule.
 */
export function rsvpSegments(stats: GuestStats): RsvpSegment[] {
  const counted = stats.attending + stats.maybe + stats.pending + stats.declined;
  const unaccounted = Math.max(0, (stats.total ?? 0) - counted);

  const raw: Record<RsvpSegmentKey, number> = {
    attending: Math.max(0, stats.attending),
    maybe: Math.max(0, stats.maybe),
    pending: Math.max(0, stats.pending),
    declined: Math.max(0, stats.declined),
    unaccounted,
  };

  const present = ORDER.filter((k) => raw[k] > 0);
  if (present.length === 0) return [];

  const pcts = apportion(present.map((k) => raw[k]));

  return present.map((key, i) => ({
    key,
    count: raw[key],
    // `pcts` is built from `present` and so is the same length by
    // construction; the fallback exists only to satisfy the compiler's
    // indexed-access check, not to paper over a real gap.
    pct: pcts[i] ?? 0,
    label: `${raw[key]} ${LABEL_ONE[key]}`,
    color: COLOR[key],
  }));
}

/**
 * One-line summary for the tile's sub-label and the bar's accessible name.
 *
 * Leads with the number the host is actually chasing. "18 attending · 4 still
 * to reply" beats "18 of 30" because the second number is the one that implies
 * an action.
 */
export function rsvpSummary(stats: GuestStats): string {
  const invited = stats.total ?? 0;
  if (invited <= 0) return 'No one invited yet';
  if (stats.pending > 0) {
    return `${stats.attending} attending · ${stats.pending} still to reply`;
  }
  return `${stats.attending} attending of ${invited} invited`;
}
