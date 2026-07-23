/**
 * studio-recommendations.ts — "Recommended for you now" for the Studio hub.
 *
 * The Studio hub (/dashboard/[eventId]/studio) lists ~24 add-ons across four
 * browse sections. That is the right SHELF, but a couple opening it should not
 * have to scan a catalog to know what to set up next. This module picks the
 * handful of add-ons that fit WHERE THE COUPLE ACTUALLY IS — so Studio can LEAD
 * with 2–3 relevant tiles and keep the full catalog below.
 *
 * "Where they are" comes from the couple's planning state (lib/wedding-roadmap-
 * signals.ts → lib/wedding-roadmap.ts): months to the earliest date PLUS the hard
 * structural signals (date locked, venue booked, guests added, capture owned…).
 * This is Studio's OWN phase-aware heuristic — not a contract shared with any
 * other surface. (It began as a shared source of truth with the Home "Things to
 * complete" list, but that surface was retired 2026-07-11; the live Home ranks by
 * a different, coarser model — progress-stages + today's-one-thing — which does
 * not recommend add-ons at all, so there's nothing here to stay "in sync" with.
 * The wedding month-band model is deliberately kept because it phases add-ons far
 * better than the 6-stage journey model would.) Two rules:
 *
 *   1. FOLLOW THE PHASES. An add-on that advances an OPEN planning item is
 *      surfaced in overdue-first order — so a couple behind on save-the-dates
 *      sees Save the Date first. (Wedding events only — see `followRoadmap`.)
 *   2. RESPECT READINESS. An add-on with an unmet prerequisite (day-of capture
 *      before the date is even locked; a seat plan before there are guests) is
 *      held OUT of the lead until the couple is ready for it. It still lives in
 *      the full catalog below — it just isn't pushed early.
 *
 * The non-anchored "delight" add-ons (monogram, Pakanta, LED, music, custom QR)
 * fill any remaining slots by proximity of the couple's months-out to the add-on's
 * peak month — this is also the ONLY ranking used for non-wedding event types,
 * whose timelines don't fit the wedding bands.
 *
 * Pure + deterministic. No AI, no per-couple learning. Free add-ons are
 * recommendable on purpose (Mood Board, Save the Date, Seat Plan) — this answers
 * "what to set up next", not "what to buy"; the price/free pill still tells the
 * truth. The peak/anchor/prerequisite/exclusion maps are drift-guarded against
 * the add-on catalog by studio-recommendations.test.ts.
 */
import {
  resolveRoadmap,
  type RoadmapItemKey,
  type RoadmapSignals,
} from '@/lib/wedding-roadmap';

/**
 * The months-out at which each add-on is MOST relevant. Lower = closer to the
 * day. The gradient runs planning → identity → capture → after, mirroring the
 * roadmap bands (12+ · 9–12 · 6–9 · 4–6 · 2–4). Membership here is also the
 * "can be recommended at all" gate — a catalog key absent from this map is never
 * auto-recommended (see STUDIO_RECOMMEND_EXCLUDED for the deliberate omissions).
 */
export const STUDIO_PEAK_MONTHS: Readonly<Record<string, number>> = {
  // Foundation — decided first, far out.
  'setnayan-ai': 11,
  'mood-board': 10,
  'landing-page': 9,
  // Identity + the run-up page.
  'save-the-date': 8,
  'animated-monogram': 7,
  pakanta: 6,
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
 * Catalog keys that are deliberately NEVER auto-recommended — Orders (a
 * receipt view, not a thing to "set up"), the PRO umbrella upsells (surfaced by
 * their own funnels, not pushed as a next step), and coming-soon shelfware. They
 * still appear in the full "Browse everything" catalog. Kept explicit so the
 * drift-guard test can prove every catalog key is either classified with a peak
 * or excluded here.
 */
export const STUDIO_RECOMMEND_EXCLUDED: ReadonlySet<string> = new Set([
  'orders',
  'website-pro',
  // 'editorial-pro' card retired 2026-07-22 (bundle-only via Website PRO) — no
  // longer a catalog entry, so it needs no exclusion.
  'supplies-marketplace',
]);

/**
 * Which planning item each add-on advances, in priority order per item. When
 * that item is OPEN (due + not done), its first recommendable add-on is surfaced
 * in overdue-first order. Add-ons with no entry here are pure date-peak fill.
 * Exported so the drift guard can assert every value is a real, peaked catalog
 * key (a typo here would silently drop an item with no failing test).
 */
export const STUDIO_ROADMAP_ANCHORS: Partial<Record<RoadmapItemKey, readonly string[]>> = {
  reception_look: ['mood-board'],
  save_the_dates: ['save-the-date'],
  invitations: ['rsvp'],
  seating: ['seating', 'indoor-blueprint'],
  setnayan_capture: ['papic', 'panood', 'patiktok', 'photo-delivery'],
};

/**
 * Readiness gate: an add-on is held out of the LEAD until this structural signal
 * is true. Don't push day-of capture before the date is even locked; don't push
 * a seat plan before there are guests to seat. Absent → no prerequisite. When
 * signals are unavailable (a failed fetch) the gate is skipped (fail-open) so a
 * hiccup never blanks the strip. Exported for the same drift guard as the anchors.
 */
export const STUDIO_PREREQUISITE: Readonly<Record<string, keyof RoadmapSignals>> = {
  'save-the-date': 'dateLocked',
  papic: 'dateLocked',
  panood: 'dateLocked',
  patiktok: 'dateLocked',
  'photo-delivery': 'dateLocked',
  event: 'dateLocked',
  seating: 'hasGuests',
  'indoor-blueprint': 'hasGuests',
};

/**
 * Anchor used when the couple hasn't set any date/window yet. Early-planning
 * (9 months out) so a date-less couple is nudged toward the foundation add-ons
 * (AI, mood board, website) rather than day-of capture.
 */
const NO_DATE_ANCHOR_MONTHS = 9;

export type StudioRecommendInput = {
  /** Months until the couple's earliest date, or null when none is set. */
  monthsToDate: number | null;
  /**
   * Hard structural signals (lib/wedding-roadmap-signals.ts). Null when they
   * couldn't be derived — the readiness gate then fails open and only date +
   * manual completions drive the roadmap ordering.
   */
  signals: RoadmapSignals | null;
  /**
   * Manually checked-off item keys (`events.roadmap_completed`). Inert for new
   * couples since the check-off UI was retired (2026-07-11) — existing values
   * still read; drops any completed item from the phase-follow pass.
   */
  completed: readonly string[];
  /**
   * True when the add-on is a real, still-offerable tile for THIS event — not
   * coming-soon, and (for surface-gated add-ons) enabled for the event type.
   */
  isEligible: (key: string) => boolean;
  /** True when the couple already owns/activated the add-on — never re-recommend. */
  isOwned: (key: string) => boolean;
  /**
   * Run the wedding phase-follow pass (Phase 1). The planning bands + anchors
   * are wedding canon, so the caller passes `false` for non-wedding event types —
   * those rank by date-peak proximity alone, which doesn't assume a 12-month
   * wedding runway. Default true.
   */
  followRoadmap?: boolean;
  /** How many to surface. Default 3. */
  limit?: number;
};

/**
 * The ordered add-on keys to feature in the "Recommended for you now" strip:
 * roadmap-anchored picks first (overdue-first, following the Home roadmap), then
 * date-peak delight add-ons to fill. Owned / ineligible / not-ready / unlisted
 * keys are dropped. Returns at most `limit` keys (possibly fewer, never padded).
 */
export function recommendStudioAddOns({
  monthsToDate,
  signals,
  completed,
  isEligible,
  isOwned,
  followRoadmap = true,
  limit = 3,
}: StudioRecommendInput): string[] {
  const prerequisiteMet = (key: string): boolean => {
    const sig = STUDIO_PREREQUISITE[key];
    if (!sig) return true;
    // Fail-open when signals are unavailable — never blank the strip on a hiccup.
    if (!signals) return true;
    return signals[sig];
  };
  const recommendable = (key: string): boolean =>
    key in STUDIO_PEAK_MONTHS
    && !STUDIO_RECOMMEND_EXCLUDED.has(key)
    && isEligible(key)
    && !isOwned(key)
    && prerequisiteMet(key);

  const picked: string[] = [];
  const seen = new Set<string>();
  const take = (key: string): boolean => {
    if (seen.has(key) || !recommendable(key)) return false;
    seen.add(key);
    picked.push(key);
    return picked.length >= limit;
  };

  // ── Phase 1: follow the planning phases (overdue-first). Wedding-only —
  // the bands + anchors are wedding canon; non-wedding events skip straight to
  // date-peak proximity so they don't inherit a 12-month wedding runway. ──────
  if (followRoadmap) {
    const openItems = resolveRoadmap(monthsToDate, completed, signals);
    for (const item of openItems) {
      const anchored = STUDIO_ROADMAP_ANCHORS[item.key] ?? [];
      for (const key of anchored) {
        if (take(key)) return picked;
      }
    }
  }

  // ── Phase 2: fill remaining slots by date-peak proximity. ──────────────────
  const anchor = monthsToDate ?? NO_DATE_ANCHOR_MONTHS;
  const byProximity = Object.entries(STUDIO_PEAK_MONTHS)
    .filter(([key]) => !seen.has(key) && recommendable(key))
    .map(([key, peak]) => ({ key, peak, distance: Math.abs(anchor - peak) }))
    .sort((a, b) => a.distance - b.distance || b.peak - a.peak);
  for (const { key } of byProximity) {
    if (take(key)) return picked;
  }

  return picked;
}
