import { manilaDate, manilaStartIso, manilaEndOfDayIso, inclusiveDays } from '@/lib/papic-window';

/**
 * story-day-window.ts — bounds the Story's day timeline to the event's OWN
 * days (03 §3 · 08 steps 0.2 + 0.4).
 *
 * 🚨 THE BUG THIS EXISTS TO KILL. The editorial timeline read
 * (`apps/web/app/[slug]/_components/editorial/data.ts`) pulled the day's
 * captures as `.order('captured_at', {ascending:true}).limit(48)` with NO
 * lower bound on `captured_at`. Papic cameras may start shooting up to
 * PAPIC_CAPTURE_MONTHS_BEFORE months before the event (owner lock, see
 * `papic-window.ts`). A ~100-capture prenup/despedida shoot fills all 48 rows
 * with pre-day photos, and the wedding day itself renders no photograph.
 *
 * The fix is not "raise the cap" — the same data.ts file already documents why
 * (presigning hundreds of URLs to discard most of them is the shape that made
 * the gallery slow). It is bounding the READ to the days that are actually
 * "the day" — `events.event_date` through `events.event_end_date` inclusive,
 * in Manila calendar days — same anchor the Papic capture WINDOW already uses.
 *
 * PURE + unit-testable. No DB, no I/O. Every date boundary here is Manila
 * calendar time (reused from papic-window.ts, PAPIC_TZ_OFFSET = +08:00, no
 * DST) — NOT the runtime's local zone and NOT a bare UTC day. A day is not an
 * instant, and CI's UTC clock hides both classes of mistake (see the file's
 * test suite, run under both Asia/Manila and a west-of-Greenwich zone).
 */

export type StoryDayWindow = {
  /** Manila calendar date the story's first day starts on. */
  startDate: string;
  /** Manila calendar date the story's last day ends on (inclusive). */
  endDate: string;
  /** Real-instant ISO bounds a `captured_at` column can be compared against. */
  startIso: string;
  endIso: string;
  /** Calendar-inclusive day count, ≥ 1. */
  days: number;
};

/**
 * Resolve the event's own day span from `events.event_date` /
 * `events.event_end_date`. Returns null when there's no usable event_date —
 * an editorial with no date has no "the day" to bound against, so its
 * timeline read stays unbounded (today's pre-existing behaviour) rather than
 * silently emptying.
 *
 * A stray `event_end_date` earlier than `event_date` (bad data) is ignored —
 * the window collapses to the single event day rather than reading backwards.
 */
export function storyDayWindow(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): StoryDayWindow | null {
  const startDate = manilaDate(eventDate);
  if (!startDate) return null;
  const endCandidate = manilaDate(eventEndDate);
  const endDate = endCandidate && endCandidate >= startDate ? endCandidate : startDate;
  return {
    startDate,
    endDate,
    startIso: manilaStartIso(startDate, '00:00'),
    endIso: manilaEndOfDayIso(endDate),
    days: inclusiveDays(startDate, endDate),
  };
}

/** Every Manila calendar date in the window, in order (e.g. 2 days → 2 entries). */
export function storyDayList(window: StoryDayWindow): string[] {
  const out: string[] = [];
  // Walk by UTC midnight of each calendar date string — safe here because we
  // only ever add whole days to a Y-M-D, never compare it to a real instant.
  let cursor = Date.parse(`${window.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${window.endDate}T00:00:00Z`);
  let guard = 0;
  while (cursor <= endMs && guard < 400) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
    guard += 1;
  }
  return out.length > 0 ? out : [window.startDate];
}

/**
 * Which Manila calendar day (as a 'YYYY-MM-DD' string) a real-instant ISO
 * timestamp falls on. Null when the timestamp can't be parsed. This is the
 * ONLY correct way to ask "which day is this capture on" — comparing a bare
 * UTC date slice of the ISO string is exactly the mistake that let a day-2
 * capture (shot at, say, 1am Manila = 5pm UTC the day before) draw on a
 * day-1 bar.
 */
export function manilaDayOf(iso: string | null | undefined): string | null {
  return manilaDate(iso);
}

/**
 * Split a proportional share of `total` chapters across `groupSizes` (one
 * count per non-empty day), using the largest-remainder method so the sum
 * never exceeds `total` while every non-empty group gets at least 1 whenever
 * there are no more groups than `total`. Pure arithmetic — no I/O.
 *
 * Exists so "As the Day Unfolded" never merges a day-2 capture into a day-1
 * chapter: chapters are built PER DAY (see data.ts), and this decides how
 * many of the shared cap of EDITORIAL_DAY_CHAPTER_CAP each day gets.
 */
export function allocateChapterCounts(groupSizes: number[], total: number): number[] {
  const n = groupSizes.length;
  if (n === 0) return [];
  const sum = groupSizes.reduce((a, b) => a + b, 0);
  if (sum <= 0) return groupSizes.map(() => 0);
  const cap = Math.max(0, Math.floor(total));
  if (cap === 0) return groupSizes.map(() => 0);

  // Every non-empty day gets a floor of 1 (when there's room for it), then the
  // remaining budget is distributed proportionally by exact share, largest
  // remainder first.
  const nonEmptyCount = groupSizes.filter((g) => g > 0).length;
  const guaranteed = Math.min(nonEmptyCount, cap);
  const remaining = cap - guaranteed;

  const shares = groupSizes.map((g) => (g > 0 ? (g / sum) * remaining : 0));
  const base = shares.map((s) => Math.floor(s));
  let used = base.reduce((a, b) => a + b, 0);
  const remainders = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (used < remaining && idx < remainders.length) {
    base[remainders[idx]!.i]! += 1;
    used += 1;
    idx += 1;
  }

  const out = groupSizes.map((g, i) => (g > 0 ? Math.min(g, 1 + base[i]!) : 0));
  // Floating remainder assignment can occasionally push the sum 1 over cap
  // when every group is tiny — trim from the largest group last.
  let overflow = out.reduce((a, b) => a + b, 0) - cap;
  let trimIdx = out.length - 1;
  while (overflow > 0 && trimIdx >= 0) {
    if (out[trimIdx]! > 1) {
      out[trimIdx]! -= 1;
      overflow -= 1;
    }
    trimIdx -= 1;
  }
  return out;
}
