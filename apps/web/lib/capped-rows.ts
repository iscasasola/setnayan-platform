/**
 * capped-rows.ts — a list that cannot push the page it sits on out of reach.
 *
 * ─── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────
 * Owner, 2026-09-22: *"if i have 100 vendors and i am inquire to all… i have 100
 * messages from suppliers. i will not be able to see the bench anymore."*
 *
 * He was right, and it was not a hypothetical. `waiting-for-quotes.tsx` and
 * `pending-lock-proposals.tsx` each rendered a bare `items.map(...)` with no
 * ceiling and no remainder line, and `vendors/page.tsx` renders BOTH of them
 * above `<ShortlistCategories>`. `waitingForQuotes` is pushed once per pending
 * inquiry with no limit upstream either. Measured in the approved prototype at
 * phone width: the bench began **4,806px** down with 100 pending inquiries,
 * against **757px** capped — about five screens of scrolling before a couple
 * could look for anybody.
 *
 * 🔑 THE RULE: a list that grows without bound may never sit between the top of
 * the page and something the reader needs. A page's height must not depend on
 * how busy the couple has been.
 *
 * ─── TWO THINGS THIS MODULE REFUSES TO DO ───────────────────────────────────
 *
 * 1. **It will not say "…and 0 more".** `hiddenMoreLabel` returns `null` for a
 *    zero remainder, so the phrase is *unrepresentable* rather than merely
 *    discouraged — a caller cannot render the row because there is no string to
 *    put in it. A list of exactly the ceiling length looks like an uncapped
 *    list, which is what it is.
 *
 * 2. **It will not hide anything on a broken ceiling.** A non-positive or
 *    non-finite ceiling returns everything, uncapped. Failing open is the only
 *    safe direction: a bad constant must not swallow a couple's suppliers, and
 *    "hidden by arithmetic" is indistinguishable on screen from "they are not
 *    there" — the failure shape this project has shipped seven fixes for.
 *
 * ⚠ EMPTY IS STILL EMPTY, AND THAT IS DELIBERATE. Both strips render `null` on
 * an empty list today and still do; this module never invents a header for
 * nothing. It also cannot distinguish "no pending inquiries" from "the read
 * that would have found them refused" — neither strip is given an error signal
 * by `vendors/page.tsx`, so both cases arrive here as an empty array. That gap
 * is real and is NOT fixed here: closing it needs an upstream error flag, which
 * is its own slice.
 */

/** What a caller renders: the visible rows, and how many it is not showing. */
export type CappedRows<T> = {
  /** The rows to render before the remainder line. */
  shown: T[];
  /** How many rows are NOT in `shown`. Zero means nothing was hidden. */
  hiddenCount: number;
};

/**
 * How many rows a strip above the bench may show before the rest fold away.
 *
 * Three, because these strips are informational and sit ABOVE the thing the
 * couple came for. The number is a ceiling on the page's geometry, not a
 * judgement about how much the couple wants to read — everything hidden stays
 * one tap away in the same place.
 */
export const DEFAULT_ROW_CEILING = 3;

/**
 * Split a list into what to show and what to count.
 *
 * Total and pure: no throw for a null list, an empty list, a fractional ceiling
 * or a ceiling larger than the list. Order is preserved exactly — these strips
 * are oldest-first and the couple reads the wait times as a sequence.
 */
export function capRows<T>(
  items: readonly T[] | null | undefined,
  ceiling: number = DEFAULT_ROW_CEILING,
): CappedRows<T> {
  if (!items || items.length === 0) return { shown: [], hiddenCount: 0 };
  // Fail OPEN on a broken ceiling — see the header. Never hide on arithmetic.
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return { shown: [...items], hiddenCount: 0 };
  }
  const limit = Math.floor(ceiling);
  if (items.length <= limit) return { shown: [...items], hiddenCount: 0 };
  return { shown: items.slice(0, limit), hiddenCount: items.length - limit };
}

/**
 * The remainder line's words, or `null` when there is no remainder.
 *
 * 🔑 RETURNING `null` IS THE MECHANISM, not a convenience. It is what makes
 * "…and 0 more" impossible to render: there is no string for the caller to put
 * in the row, so the row cannot exist. Both strips word the remainder through
 * this one function, so they cannot drift into two spellings of one idea.
 *
 * `noun` is the plural the strip counts — "waiting for a quote", "proposals".
 */
export function hiddenMoreLabel(hiddenCount: number, noun: string): string | null {
  if (!Number.isFinite(hiddenCount) || hiddenCount <= 0) return null;
  const n = Math.floor(hiddenCount);
  return `…and ${n} more ${noun}`;
}
