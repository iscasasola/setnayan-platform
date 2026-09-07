/**
 * card-dates.ts — what a bench card says about a vendor's dates.
 *
 * ── TWO RULINGS, ONE MODULE (owner 2026-09-06) ──────────────────────────────
 * 1. *"i also need to know what if the vendor has multiple dates available"* —
 *    a card must not imply a lock settles the date when it does not.
 * 2. *"if there are more than 4 dates available, we can control what shows and
 *    make a small popup to show their dates"* — cap the inline list at FOUR and
 *    put the rest behind a disclosure.
 *
 * ── THE RULE THIS MIRRORS, AND MUST NEVER CONTRADICT ────────────────────────
 * `actions.ts` gates the wedding date on **`viable.length === 1`** —
 * "date-as-output, force-to-one". A vendor free on several days does NOT set
 * the date; locking them narrows the candidate set, and the date is finalized
 * only when the intersection across every locked vendor collapses to one day.
 *
 * 🔑 So `dateOutcome` may only say "sets your date" for a SINGLETON viable set.
 * The binding prototype gets this wrong — every card there carries a hardcoded
 * `note` string, and The Glasshouse Alta (free Sep 12 AND Sep 26) claims "Sets
 * your date to Sat · Sep 12" because a fixture author picked one by hand; its
 * `doLock` then hardcodes `2027-09-12` for ANY reception lock, so locking a
 * venue free only in October would have set the wedding to September. Do not
 * port the prototype here — this module computes.
 *
 * ── WHY THE PARTS, NOT A STRING ─────────────────────────────────────────────
 * `freeDaysLine` (build-date-window.ts) already renders "Free: A · B · C +2
 * more" and is live on every card. It returns ONE STRING, so "+2 more" cannot
 * be a button. This returns the parts instead, so the overflow can open the
 * popup. `freeDaysLine` is left exactly as it is — other callers depend on it.
 */

/** How many days are named inline before the rest go behind the disclosure. */
export const MAX_INLINE_DATES = 4;

/**
 * A window wider than this is a month, not a shortlist of candidate dates: the
 * card shows a COUNT rather than a list, because 28 date chips on a 206px card
 * is not information. Mirrors `freeDaysLine`'s own threshold deliberately — if
 * these two ever disagree, one line on the card contradicts the other.
 */
export const WIDE_WINDOW_DAYS = 8;

export type CardDates = {
  /** Days named inline. Empty when the window is wide (a count is shown). */
  shown: readonly string[];
  /** How many are NOT named inline. > 0 ⇒ render the disclosure trigger. */
  hidden: number;
  /** Every free day, for the popup. Never truncated. */
  all: readonly string[];
  /** True ⇒ the card shows "Free N of M days" instead of naming any. */
  wide: boolean;
  /** The window this was measured against — the popup says so. */
  windowSize: number;
};

/**
 * Split a vendor's free days into what the card names inline and what the
 * popup holds. Returns null when there is nothing honest to say: no calendar
 * signal (`null`) or no free day at all (`[]`) — the amber clash badge already
 * covers the second, and a "Free:" line with nothing after it reads as a
 * rendering bug.
 */
export function cardDates(args: {
  freeDays: readonly string[] | null;
  windowSize: number;
  maxInline?: number;
}): CardDates | null {
  const { freeDays, windowSize } = args;
  if (!freeDays || freeDays.length === 0) return null;
  const maxInline = args.maxInline ?? MAX_INLINE_DATES;
  const wide = windowSize > WIDE_WINDOW_DAYS;
  if (wide) {
    return { shown: [], hidden: freeDays.length, all: freeDays, wide: true, windowSize };
  }
  const shown = freeDays.slice(0, maxInline);
  return {
    shown,
    hidden: freeDays.length - shown.length,
    all: freeDays,
    wide: false,
    windowSize,
  };
}

export type DateOutcome =
  /** Exactly one day survives — locking this DOES settle the wedding date. */
  | { kind: 'sets'; day: string }
  /** Several survive — the lock narrows, and the date stays open. */
  | { kind: 'narrows'; count: number }
  /** Nothing to say: no signal, no overlap, or the date is already anchored. */
  | null;

/**
 * What locking this vendor would do to the couple's date.
 *
 * `viableDays` is the vendor's free days INTERSECTED with the build's current
 * shared window — the caller passes the intersection rather than re-deriving
 * it, so this can never disagree with `convergenceBanner` or with the bench's
 * sink, which are drawn from that same window.
 *
 *   • already anchored → null. The date is settled; the `dateFit` badge answers
 *     the only remaining question ("is this vendor free that day").
 *   • 0 viable → null. The amber "no shared date" badge says it better, and
 *     naming a consequence for a vendor the couple cannot pick is noise.
 *   • 1 viable → `sets`. The ONLY case that may claim the date.
 *   • ≥2 viable → `narrows`.
 */
export function dateOutcome(args: {
  viableDays: readonly string[] | null;
  dateAnchored: boolean;
}): DateOutcome {
  if (args.dateAnchored) return null;
  const v = args.viableDays;
  if (!v || v.length === 0) return null;
  if (v.length === 1) return { kind: 'sets', day: v[0]! };
  return { kind: 'narrows', count: v.length };
}
