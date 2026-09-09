/**
 * format-date.ts — one long-form date, for every screen that shows one.
 *
 * ── WHY THIS MODULE EXISTS (owner, 2026-09-08) ────────────────────────────
 * *"Date should be more specific with Name of date instead of 2026-12-18, it
 * should be December 18, 2026."*
 *
 * A single vendor screen was showing the same wedding day THREE ways at once:
 * the raw ISO key `2026-12-18` on the inquiry chip, `18 Dec.` in the
 * "you're chasing N customers" line, and a third form in the header. A supplier
 * deciding whether they are free on a date should not have to notice that all
 * three are the same day.
 *
 * The formatter already existed — `formatLongDate` in `lib/paperwork.ts`,
 * producing exactly "December 18, 2026". It was in a DOMAIN module, so five
 * other screens rolled their own `toLocaleDateString(..., { month: 'long' })`
 * rather than import "paperwork" to print a date. That is how a shared
 * definition becomes five definitions.
 *
 * 🔑 A HOME DECIDES WHETHER SOMETHING GETS REUSED. Moving it here costs
 * nothing and removes the reason to copy it.
 *
 * Pure: no React, no I/O. `paperwork.ts` re-exports it so every existing
 * importer keeps working.
 */

/**
 * A `YYYY-MM-DD` key as "December 18, 2026". Returns "—" for null, and the
 * input unchanged when it is not a parseable date — a screen must never print
 * "Invalid Date" at a supplier.
 *
 * ⚠ PARSED AS LOCAL MIDNIGHT, deliberately. `new Date('2026-12-18')` is UTC
 * midnight, which in Manila (UTC+8) is still the 18th — but west of Greenwich
 * it renders as the 17th. A wedding day that shifts by a day depending on where
 * the reader sits is the kind of error nobody reports and everybody distrusts.
 */
export function formatLongDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * A `date` column as "18 Dec" — for a chip, where the full sentence does not fit.
 *
 * ⚠ BUILT BY HAND, NOT BY `toLocaleDateString`. The ICU data behind `en-PH`
 * differs between Node builds — the CI runner says "18 Dec", a Mac says
 * "Dec 18" — and a date that renders two ways is not a fact. Same reasoning,
 * and the same shape, as the copy in `lib/plan3d-control.ts`, which got there
 * first; that one and `lib/save-the-date-content.ts` are left alone rather than
 * re-pointed, because moving a date formatter under two shipped surfaces is its
 * own change. This is the canonical home for the next caller.
 *
 * ⚠ Feed it a DATE, never a `timestamptz` — see {@link formatLongTimestamp}.
 */
export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

/**
 * A TIMESTAMP as "June 19, 2026" — the Manila calendar day it happened on.
 *
 * ⚠ NOT THE SAME FUNCTION AS {@link formatLongDate}, AND THE DIFFERENCE IS A
 * WHOLE DAY. `formatLongDate` takes the leading `YYYY-MM-DD` of its input and
 * builds LOCAL midnight from it, which is exactly right for a `date` column —
 * a wedding day is a calendar day and carries no instant. A `timestamptz` is
 * an instant, and its leading characters are the **UTC** date, so anything that
 * happened after 16:00 Manila renders one day early.
 *
 * 🔑 THIS IS NOT HYPOTHETICAL — it was measured on the first event the feature
 * would ever render. `events.created_at = 2026-06-18 23:24:45+00` is
 * **2026-06-19 07:24 in Manila**; `formatLongDate` on it prints "June 18,
 * 2026", telling a supplier the couple started planning the day before they
 * did. Roughly a third of every day falls in that window.
 *
 * So this converts to Manila FIRST, then reuses the one formatter. Hard-coded
 * to `Asia/Manila` rather than the reader's zone deliberately: this is a fact
 * about when a Filipino couple opened their event, not about where the supplier
 * is sitting, and the whole V1 market is in one zone.
 */
export function formatLongTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatLongDate(value);
  // en-CA yields ISO-ordered `YYYY-MM-DD`, which is what formatLongDate parses.
  const manilaKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return formatLongDate(manilaKey);
}
