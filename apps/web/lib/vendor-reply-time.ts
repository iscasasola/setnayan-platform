/**
 * "USUALLY RESPONDS IN 2h" — the one place that claim is decided.
 *
 * Pure module — no env, no I/O, no clock of its own (`now` is passed in, so the
 * tests are not hostage to the machine's time zone; this repo has already
 * shipped seventeen defects to that exact cause).
 *
 * ── WHAT WAS WRONG WITH THE SHIPPED BADGE ───────────────────────────────────
 * It rendered off `vendor_activity_stats.avg_response_minutes` alone, and that
 * column is a MEDIAN with no sample size beside it. Two live consequences on a
 * public page:
 *
 *   • ONE reply, once, in twelve minutes → "Usually responds in 12m", shown to
 *     every couple browsing. *Usually* is a claim about a habit. One event is
 *     not a habit, and a couple choosing a supplier on it has been misled by
 *     arithmetic that was technically correct.
 *
 *   • The column's "no data yet" value is **0**, written whenever no thread has
 *     been replied to at all. `isFirstLookEligible` reads `<= 0` as unknown; the
 *     marketplace card checked only `!== null`, so `0 < 240` passed and a shop
 *     that had **never answered anybody** was advertised as
 *     **"Usually responds in 0m"** — the strongest possible claim for the
 *     weakest possible reason.
 *
 * 🔑 A SENTINEL HELD IN ONE CONSUMER'S HEAD IS NOT A RULE. Two readers of one
 * number disagreed about what 0 meant and the one that got it wrong was the one
 * couples read. Both facts are now decided here, once, and the sample size
 * travels with the median in the database (`replied_thread_count`).
 *
 * ── THE FLOOR ───────────────────────────────────────────────────────────────
 * Three replies, matching the disclosure floor the Card Record already uses for
 * every aggregate it publishes about other people. Below it the badge is
 * ABSENT — not "based on 1 reply", not a fainter chip, not a tooltip. A hedge
 * is still a claim, and it teaches a reader to trust the ones without a hedge
 * for reasons they cannot check.
 */

/** Replies needed before "usually" is a word we are allowed to use. */
export const REPLY_TIME_MIN_SAMPLE = 3;

/** Median at or above this and the shop is not "fast" — 4 hours, in minutes. */
export const FAST_REPLY_THRESHOLD_MIN = 240;

/** A login within this window, or the badge is not about today. */
export const RECENTLY_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

export type ReplyTimeInputs = {
  /** Median minutes to first reply. `0` is the NO-DATA sentinel, never "instant". */
  avgResponseMinutes: number | null | undefined;
  /** How many threads that median came from. Absent ⇒ treated as none. */
  repliedThreadCount: number | null | undefined;
  /** Last login, ISO. A fast replier who left is not a fast replier. */
  lastActiveAt: string | null | undefined;
  /** Injected, never `Date.now()` inside — see the module note. */
  now: number;
};

/**
 * The badge text, or `null` for "say nothing".
 *
 * `null` is the common answer and the safe one: no sample, an unreadable
 * number, a stale login, or a median that is not fast all mean the same thing
 * to a couple — this card makes no promise about replies.
 */
export function replyTimeBadgeLabel(input: ReplyTimeInputs): string | null {
  const { avgResponseMinutes: avg, repliedThreadCount, lastActiveAt, now } = input;

  // THE SAMPLE FLOOR, first — before any arithmetic, so a fast-looking median
  // from one reply cannot reach the rest of this function at all.
  const sample = typeof repliedThreadCount === 'number' ? repliedThreadCount : 0;
  if (!Number.isFinite(sample) || sample < REPLY_TIME_MIN_SAMPLE) return null;

  // THE SENTINEL. 0 means "nothing to average", not "answered instantly".
  // Negative and non-finite are impossible-by-construction and refused anyway:
  // an impossible number printed on a public card is worse than no card.
  if (typeof avg !== 'number' || !Number.isFinite(avg) || avg <= 0) return null;

  if (avg >= FAST_REPLY_THRESHOLD_MIN) return null;

  // A badge about how quickly somebody replies is a claim about NOW.
  if (!lastActiveAt) return null;
  const lastActive = Date.parse(lastActiveAt);
  if (!Number.isFinite(lastActive) || now - lastActive > RECENTLY_ACTIVE_MS) return null;

  const mins = Math.round(avg);
  return mins < 60
    ? `Usually responds in ${mins}m`
    : `Usually responds in ${Math.round(mins / 60)}h`;
}
