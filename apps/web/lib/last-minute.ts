/**
 * Last-minute mechanic — the §4 net-new layer of Setnayan AI
 * (What_Is_Setnayan_AI_2026-06-08.md). PURE + integration-agnostic, like
 * lib/compat-score.ts: it takes primitives (months-to-wedding, the platform's
 * per-leaf START, the vendor's per-service END + surcharge, and whether
 * Setnayan AI is active) and returns a zone / visibility / surcharged price.
 * The caller (category-search.ts) resolves the DB values; this module owns the
 * rules so they stay trivially reviewable and have one source of truth.
 *
 * The model (owner-locked 2026-06-08, §4):
 *   • Last-minute START — set by the PLATFORM, per taxonomy leaf. The designed
 *     month when "last-minute" begins for a category (a cake, a stylist, a
 *     venue each need different lead times). Lives in `planning_deadlines`
 *     (kind='last_minute_start', category default + leaf override).
 *   • Last-minute END (floor) — set by the VENDOR, per service. "I'll still
 *     accept a booking until this month before the wedding." Blank → 0 = until
 *     the night before. Lives on `vendor_services.last_minute_end_months`.
 *   • Last-minute = the range [START → END], measured in months remaining.
 *
 * Three zones, by R = months remaining to the wedding:
 *   • Normal      R > START          everyone (generic + AI), no surcharge
 *   • Last-minute END ≤ R ≤ START    AI couples ONLY, optional 0–100% surcharge
 *   • Expired     R < END            no one (not searchable)
 *
 * Two AI-gated edges baked in here so every surface agrees:
 *   1. A last-minute-zone vendor is searchable ONLY when Setnayan AI is on.
 *   2. When AI is OFF and a category is already in its last-minute zone
 *      (R ≤ START), the standard search shows NOTHING in that category —
 *      last-minute vendors surface only with Setnayan AI on (the sharpest
 *      pull to purchase). See categoryEmptyForGenericSearch().
 *
 * DORMANT BY DEFAULT: START is null until an admin sets it per category/leaf
 * (no seed). With no START, every zone resolves to 'normal' → no filtering, no
 * badge, no behavior change. This mirrors the PR-1/PR-2 "build behind safe
 * defaults, flip deliberately" discipline and avoids inventing the per-leaf
 * START months (a load-bearing platform-design value the owner sets).
 */

export type LastMinuteZone = 'normal' | 'last_minute' | 'expired';

/** Average days per month — fractional, for bucketing R into zones. */
const DAYS_PER_MONTH = 30.4375;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Months remaining to the wedding from an `events.event_date` (DATE,
 * 'YYYY-MM-DD'). Fractional — 92 days out ≈ 3.02 months. Null when there is no
 * locked date (candidates only) or the value won't parse → callers treat null
 * as "no last-minute" (dormant). Past dates return a negative number.
 */
export function monthsToWedding(
  eventDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!eventDate) return null;
  // Parse as a UTC midnight date so the result is timezone-stable.
  const d = new Date(`${eventDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - now.getTime()) / MS_PER_DAY / DAYS_PER_MONTH;
}

/**
 * Which zone a (leaf, vendor-service) sits in right now.
 *
 * - `monthsRemaining` null (no locked date) OR `startMonths` null/undefined
 *   (admin hasn't configured last-minute for this leaf) → always 'normal'
 *   (dormant — nothing is ever last-minute or expired).
 * - `endMonths` null/undefined → 0 (vendor accepts until the night before).
 * - Misconfig guard: an END above START leaves an empty last-minute window, so
 *   a category can only be 'normal' or 'expired' there — never a phantom
 *   last-minute zone.
 */
export function lastMinuteZone(args: {
  monthsRemaining: number | null | undefined;
  startMonths: number | null | undefined;
  endMonths?: number | null;
}): LastMinuteZone {
  const r = args.monthsRemaining;
  const start = args.startMonths;
  if (r == null || start == null) return 'normal';
  const end = args.endMonths ?? 0;
  if (r > start) return 'normal';
  if (r < end) return 'expired';
  return 'last_minute'; // end ≤ r ≤ start
}

/**
 * Can this vendor be SURFACED in search, given the zone + whether Setnayan AI
 * is active for the couple?
 *   • normal      → always
 *   • last_minute → AI couples only (edge #1)
 *   • expired     → never
 */
export function isLastMinuteSearchable(
  zone: LastMinuteZone,
  aiActive: boolean,
): boolean {
  if (zone === 'expired') return false;
  if (zone === 'last_minute') return aiActive;
  return true;
}

/**
 * Edge #2 — the AI-off-empty rule. When Setnayan AI is OFF and the category is
 * already in (or past) its last-minute zone (`R ≤ START`), the standard search
 * returns NOTHING for that category. Returns false (search proceeds normally)
 * whenever AI is on, the date is unlocked, or last-minute is dormant for the
 * category (no START). The caller short-circuits to an empty result set when
 * this is true.
 */
export function categoryEmptyForGenericSearch(args: {
  aiActive: boolean;
  monthsRemaining: number | null | undefined;
  groupStartMonths: number | null | undefined;
}): boolean {
  if (args.aiActive) return false;
  if (args.monthsRemaining == null || args.groupStartMonths == null) return false;
  return args.monthsRemaining <= args.groupStartMonths;
}

/**
 * Apply a vendor's optional last-minute surcharge (0–100%) to a base PHP price.
 * Null / 0 / out-of-range → the base price unchanged (surcharge is opt-in;
 * a vendor may use last-minute purely to stay discoverable late, §4.3).
 */
export function lastMinuteSurchargedPricePhp(
  basePhp: number,
  surchargePct: number | null | undefined,
): number {
  if (!surchargePct || surchargePct <= 0) return basePhp;
  const pct = surchargePct > 100 ? 100 : surchargePct;
  return Math.round(basePhp * (1 + pct / 100));
}
