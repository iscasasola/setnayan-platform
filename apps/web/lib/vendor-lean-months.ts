/**
 * Lean-month derivation for the Off-Season Promos nudge (Wave 5 "Soon"
 * vendor benefit).
 *
 * WHAT IT IS — in plain English: a vendor's "lean months" are the calendar
 * months when their bookings dry up. Surfacing them lets us nudge the vendor
 * to launch an off-peak discount on the EXISTING per-service `off_peak`
 * discount fields (no new pricing schema) so couples shopping those months
 * see a deal.
 *
 * HOW WE DERIVE THEM — two sources, in priority order:
 *
 *   1. The vendor's OWN booking calendar (authoritative). We tally the
 *      vendor's confirmed pool bookings + manual/external calendar blocks
 *      per month-of-year across the next 12 months. The months with the
 *      FEWEST commitments are the lean ones. This is the truest signal —
 *      it's the vendor's real demand curve.
 *
 *   2. `wedding_season_factors` troughs (fallback). When the vendor has too
 *      little booking history to be meaningful (< MIN_BOOKINGS_FOR_SELF
 *      data points), we fall back to the admin-seeded per-(region, month)
 *      seasonality multipliers — the months with the LOWEST factor are the
 *      regional off-season. This table ships EMPTY (neutral), so when no
 *      rows exist for the vendor's region we fall through to (3).
 *
 *   3. A conservative PH off-season default (last resort). The Philippine
 *      wedding lull is the rainy stretch — June, July, August, September —
 *      so when neither the vendor's calendar nor the seasonality table can
 *      speak, we surface those. This is a generic hint, never invented
 *      pricing: the vendor still chooses whether and how much to discount.
 *
 * The result is a small, ranked list of month numbers (1–12) plus the source
 * we used, so the dashboard nudge can explain itself honestly to the vendor.
 *
 * This module is pure-ish: it takes already-fetched booking/block entries
 * (so it stays testable + the caller controls the DB reads) plus an optional
 * Supabase client for the seasonality fallback read.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** How many distinct booking/block month-data-points we need before we trust
 *  the vendor's own calendar over the regional fallback. Below this, the
 *  calendar is too sparse to call any month "lean" with confidence. */
const MIN_BOOKINGS_FOR_SELF = 4;

/** How many lean months we surface in the nudge. Two-to-three reads as a
 *  focused "these months look light" hint without sprawling. */
const LEAN_MONTH_COUNT = 3;

/** Conservative PH wedding off-season (rainy months) — the last-resort hint
 *  when neither the vendor's calendar nor the seasonality table can speak. */
const PH_DEFAULT_LEAN_MONTHS: readonly number[] = [6, 7, 8, 9];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type LeanMonthsSource = 'own_calendar' | 'season_factors' | 'ph_default';

export type LeanMonthsResult = {
  /** Month numbers 1–12, ranked lightest-first. */
  months: number[];
  /** Which derivation produced this. Drives honest nudge copy. */
  source: LeanMonthsSource;
};

/** A minimal booking/block entry — only the date string matters here. */
export type DatedEntry = { date: string };

/** Human label for a list of month numbers, e.g. [6,7] → "June and July",
 *  [6,7,8] → "June, July, and August". Returns '' for an empty list. */
export function formatLeanMonths(months: readonly number[]): string {
  const names: string[] = [];
  for (const m of months) {
    const name = MONTH_NAMES[m - 1];
    if (name) names.push(name);
  }
  if (names.length === 0) return '';
  if (names.length === 1) return names.join('');
  if (names.length === 2) return names.join(' and ');
  const last = names[names.length - 1] ?? '';
  return `${names.slice(0, -1).join(', ')}, and ${last}`;
}

/** A YYYY-MM-DD (or ISO) date → its month number 1–12, or null when unparseable. */
function monthOf(dateStr: string): number | null {
  // Prefer the leading YYYY-MM token so a bare PH civil date never shifts a
  // timezone boundary. Fall back to Date parsing for full ISO timestamps.
  const m = /^\d{4}-(\d{2})/.exec(dateStr.trim());
  if (m && m[1]) {
    const n = Number(m[1]);
    return n >= 1 && n <= 12 ? n : null;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCMonth() + 1;
}

/**
 * Tally commitments per month-of-year from the vendor's bookings + blocks.
 * Returns a 12-slot array (index 0 = January) of counts.
 */
function tallyByMonth(entries: readonly DatedEntry[]): number[] {
  const counts = new Array(12).fill(0) as number[];
  for (const e of entries) {
    const month = monthOf(e.date);
    if (month !== null) {
      counts[month - 1] = (counts[month - 1] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Derive the vendor's lean months.
 *
 * @param bookings  the vendor's confirmed pool bookings (date = bookedDate)
 * @param blocks    the vendor's calendar blocks (date = each block's start)
 * @param opts.client       Supabase client for the seasonality fallback read
 * @param opts.regionHint    the vendor's region/city for the season_factors lookup
 */
export async function deriveLeanMonths(
  bookings: readonly DatedEntry[],
  blocks: readonly DatedEntry[],
  opts: {
    client?: SupabaseClient;
    regionHint?: string | null;
  } = {},
): Promise<LeanMonthsResult> {
  const entries = [...bookings, ...blocks];

  // 1. Own calendar — trusted when there's enough signal.
  if (entries.length >= MIN_BOOKINGS_FOR_SELF) {
    const counts = tallyByMonth(entries);
    // Rank months lightest-first. Ties break toward the earlier month so the
    // output is deterministic. We surface the lightest LEAN_MONTH_COUNT.
    const ranked = counts
      .map((count, idx) => ({ month: idx + 1, count }))
      .sort((a, b) => (a.count - b.count) || (a.month - b.month))
      .slice(0, LEAN_MONTH_COUNT)
      .map((r) => r.month);
    return { months: ranked, source: 'own_calendar' };
  }

  // 2. Seasonality troughs — admin-seeded per-(region, month) multipliers.
  if (opts.client && opts.regionHint && opts.regionHint.trim().length > 0) {
    try {
      const { data, error } = await opts.client
        .from('wedding_season_factors')
        .select('month, factor')
        .ilike('region', opts.regionHint.trim());
      if (!error && data && data.length > 0) {
        const rows = data as { month: number; factor: number }[];
        const ranked = rows
          .slice()
          .sort((a, b) => (a.factor - b.factor) || (a.month - b.month))
          .slice(0, LEAN_MONTH_COUNT)
          .map((r) => r.month);
        if (ranked.length > 0) {
          return { months: ranked, source: 'season_factors' };
        }
      }
    } catch {
      // Table absent / read hiccup → fall through to the PH default.
    }
  }

  // 3. PH off-season default.
  return {
    months: PH_DEFAULT_LEAN_MONTHS.slice(0, LEAN_MONTH_COUNT),
    source: 'ph_default',
  };
}

/**
 * Suggest an off-peak promo expiry date that covers the lean window.
 *
 * We anchor on the NEXT occurrence of the latest lean month and return the
 * last day of that month as an ISO YYYY-MM-DD. This pre-fills the vendor's
 * `discount_expires_at` so the offer is live through the lull and naturally
 * lapses afterwards — the couple-facing filter requires a FUTURE expiry to
 * count an off-peak offer as a live promo window.
 */
export function suggestPromoExpiry(
  months: readonly number[],
  now: Date = new Date(),
): string | null {
  const valid = months.filter((m) => m >= 1 && m <= 12);
  if (valid.length === 0) return null;
  const currentMonth = now.getUTCMonth() + 1; // 1–12
  const currentYear = now.getUTCFullYear();
  // For each lean month, find its next occurrence (this year if still ahead,
  // else next year) and keep the furthest-out one so the window fully closes.
  let bestYear = currentYear;
  let bestMonth = valid[0];
  let bestStamp = -Infinity;
  for (const m of valid) {
    const year = m >= currentMonth ? currentYear : currentYear + 1;
    const stamp = year * 12 + m;
    if (stamp > bestStamp) {
      bestStamp = stamp;
      bestYear = year;
      bestMonth = m;
    }
  }
  // Last day of bestMonth/bestYear (UTC). Day 0 of the next month = last day.
  const lastDay = new Date(Date.UTC(bestYear, bestMonth, 0));
  return lastDay.toISOString().slice(0, 10);
}
