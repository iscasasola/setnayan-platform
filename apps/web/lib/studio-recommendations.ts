/**
 * studio-recommendations.ts — "Recommended for you now" for the Studio hub.
 *
 * The Studio hub (/dashboard/[eventId]/studio) lists ~24 add-ons across four
 * browse sections. That is the right SHELF, but a couple opening it 10 months
 * out should not have to scan a catalog to know what to set up next. This module
 * picks the handful of add-ons that fit WHERE THE COUPLE IS in their timeline —
 * the same "timed by one question: how many months until your date?" philosophy
 * the free Home roadmap uses (see lib/wedding-roadmap.ts) — so Studio can LEAD
 * with 2–3 relevant tiles and keep the full catalog below.
 *
 * Pure + deterministic: (months-to-date, eligibility, ownership) → an ordered
 * list of add-on keys. No AI, no per-couple learning — just proximity of the
 * couple's months-out to each add-on's "peak" month.
 *
 * Free add-ons are recommendable on purpose (Mood Board, Save the Date, Seat
 * Plan). This surface answers "what should I set up next," not "what should I
 * buy" — the price/free pill on each row still tells the truth.
 */

/**
 * The months-out at which each add-on is MOST relevant. Lower = closer to the
 * day. The gradient runs planning → identity → capture → after, mirroring the
 * roadmap bands (12+ · 9–12 · 6–9 · 4–6 · 2–4). Keys omitted here are never
 * auto-recommended (Orders + the PRO umbrella upsells + coming-soon shelfware) —
 * they still live in the full catalog below the strip.
 */
const STUDIO_PEAK_MONTHS: Readonly<Record<string, number>> = {
  // Foundation — decided first, far out.
  'setnayan-ai': 11,
  'mood-board': 10,
  'landing-page': 9,
  // Identity + the run-up page.
  'save-the-date': 8,
  'animated-monogram': 7,
  pakanta: 6,
  'music-creator': 6,
  'custom-qr-guest': 5,
  rsvp: 5,
  led: 4,
  // Layout + logistics, closing in.
  'indoor-blueprint': 3,
  seating: 3,
  // Capture the day itself — the last stretch.
  playlist: 2,
  papic: 2,
  panood: 2,
  event: 1,
  'photo-delivery': 1,
  patiktok: 1,
  // After the day.
  editorial: 0,
};

/**
 * Anchor used when the couple hasn't locked a date yet. Early-planning (9 months
 * out) so a date-less couple is nudged toward the foundation add-ons (AI, mood
 * board, website, save-the-date) rather than day-of capture.
 */
const NO_DATE_ANCHOR_MONTHS = 9;

export type StudioRecommendInput = {
  /**
   * Months until the couple's date, or null when no firm date is set. Compute
   * with `monthsUntil` from lib/wedding-roadmap.ts so it matches the roadmap.
   */
  monthsToDate: number | null;
  /**
   * True when the add-on is a real, still-offerable tile for THIS event — not
   * coming-soon, and (for surface-gated add-ons) enabled for the event type.
   * The caller already computes this for the catalog render.
   */
  isEligible: (key: string) => boolean;
  /** True when the couple already owns/activated the add-on — never re-recommend. */
  isOwned: (key: string) => boolean;
  /** How many to surface. Default 3. */
  limit?: number;
};

/**
 * The ordered add-on keys to feature in the "Recommended for you now" strip.
 * Scored by how close the couple's months-out is to each add-on's peak month;
 * nearer-peak wins, ties break toward the earlier-phase (higher-peak) item so
 * the strip reads front-of-timeline first. Owned / ineligible / unlisted keys
 * are dropped. Returns at most `limit` keys (possibly fewer, never padded).
 */
export function recommendStudioAddOns({
  monthsToDate,
  isEligible,
  isOwned,
  limit = 3,
}: StudioRecommendInput): string[] {
  const anchor = monthsToDate ?? NO_DATE_ANCHOR_MONTHS;
  return Object.entries(STUDIO_PEAK_MONTHS)
    .filter(([key]) => isEligible(key) && !isOwned(key))
    .map(([key, peak]) => ({ key, peak, distance: Math.abs(anchor - peak) }))
    .sort((a, b) => a.distance - b.distance || b.peak - a.peak)
    .slice(0, Math.max(0, limit))
    .map((x) => x.key);
}
