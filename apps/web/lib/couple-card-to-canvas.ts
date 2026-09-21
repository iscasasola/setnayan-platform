/**
 * coupleCardToCanvasInitial — the MAPPING half of
 * `buildCanvasInitialFromCoupleCard`, split out so it can be EXECUTED.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * Its sibling imports `server-only`, which is the right guard for a module
 * that takes a Supabase client — and which makes the module impossible to
 * `import` from a `node:test` run (`Cannot find module 'server-only'`). A
 * decision nobody can execute in a test is a decision nobody checks, and every
 * interesting way this feature can be wrong lives in the mapping, not in the
 * one-row read around it: what gets copied, what deliberately does not, and
 * when the seed should be withheld entirely.
 *
 * So the fetch stays behind `server-only` and the judgement lives here, pure,
 * with `vendor-card-from-couple.test.ts` running the truth table over it.
 */

import type { CanvasInitial } from './canvas-initial';

/** The couple-side columns the mapping reads. Narrow on purpose. */
export type CoupleCardRow = {
  vendor_name: string | null;
  category: string | null;
  transport_php: number | string | null;
  food_allowance_php: number | string | null;
  crew_size: number | null;
  crew_meal_covered: boolean | null;
  host_inclusions: string[] | null;
  marketplace_vendor_id: string | null;
};

/** PostgREST hands numerics back as strings. `null` stays `null`. */
function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A well-formed `event_vendors.vendor_id`. Checked before any read. */
export function isEventVendorId(id: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

/**
 * Turn one couple-recorded booking into the maker's seed, or `null` when the
 * maker should simply open blank.
 *
 * ⚠ NOTHING TO SAY ⇒ SAY NOTHING. Without the `hasAnything` floor the maker
 * would announce "started from what the couple told us" over a card identical
 * to a blank one — a claim with no content behind it.
 */
export function coupleCardToCanvasInitial(
  src: CoupleCardRow,
  eventVendorId: string,
  category: string,
  /**
   * 🔑 THE AGREED TOTAL **NOW**, RESOLVED BY THE CALLER — never the raw
   * `event_vendors.total_cost_php`.
   *
   * The supplier SEES this number, in the most consequential field on the card
   * they are about to publish. `total_cost_php` is the headline at lock; any
   * change the couple and supplier agreed since lives in
   * `event_vendor_line_items` as a delta, so the raw column can be stale by
   * exactly the amount they most recently renegotiated. Seeding a stale price
   * would have the supplier publish a number neither side still holds.
   *
   * Owner 2026-09-11, "Show the total now". `agreed-total-and-its-changes.test.ts`
   * keeps a roster of every reader of that column and refused this file until
   * the total came through `agreedTotalNow` — the guard was right, and this
   * parameter is the fix rather than a roster entry.
   */
  agreedTotalPhp: number | null,
): CanvasInitial | null {
  const price = agreedTotalPhp;
  const transport = num(src.transport_php);
  const crewMealCovered = src.crew_meal_covered === true;
  const inclusionLabels = (src.host_inclusions ?? [])
    .map((l) => (typeof l === 'string' ? l.trim() : ''))
    .filter((l) => l.length > 0);

  const hasAnything =
    (price != null && price > 0) ||
    (transport != null && transport > 0) ||
    crewMealCovered ||
    src.crew_size != null ||
    inclusionLabels.length > 0;
  if (!hasAnything) return null;

  return {
    // `sourceServiceId` names the row this seed came from. It is an
    // `event_vendors.vendor_id`, not a `vendor_service_id` — the field is
    // carried for the on-screen note only (see CanvasInitial), and the maker
    // never dereferences it.
    sourceServiceId: eventVendorId,
    sourceTitle: src.vendor_name?.trim() || null,
    // The couple filed this booking under `src.category`; the route fixed
    // `category`. Same meaning as the `?from=` builder's flag: the words and
    // the money travel, the taxonomy does not.
    sourceWasOtherCategory: src.category !== category,

    // Blank on purpose — see the docblock on the fetch half. The supplier
    // names their own service.
    title: '',
    includesSetnayanGift: false,
    coverageId: '',
    crewSize: src.crew_size != null ? String(src.crew_size) : '',
    recommendedLeadTimeMonths: '',
    lastMinuteEndMonths: '',
    lastMinuteSurchargePct: '',

    pricing: {
      // The couple recorded ONE agreed total, which is a fixed price. Guessing
      // per-pax or per-hour from a single number would invent a rate card.
      pricing_basis: 'fixed',
      starting_price_php: price,
      base_pax: null,
      added_pax_price_php: null,
      per_pax_price_php: null,
      min_pax: null,
      hour_base_php: null,
      min_hours: null,
      extra_hour_php: null,
    },
    included: {
      // `crew_meal_covered` on the booking means the EVENT feeds this crew —
      // so from the supplier's side the meal is part of the arrangement.
      crew_meal_included: crewMealCovered,
      // A recorded transport figure means transport was part of the deal. Zero
      // and null both mean "nothing recorded", never "included at ₱0".
      transport_included: transport != null && transport > 0,
      transport_flat_fee_php: transport != null && transport > 0 ? transport : null,
    },

    brackets: [],
    discounts: [],
    // `worth` is the supplier's own valuation of a line and the couple never
    // stated one. Blank, not a fabricated number.
    inclusions: inclusionLabels.map((label) => ({ label, worth: '' })),
    // Not derivable — see the docblock on the fetch half.
    linkedCategories: [],

    coverPhotoR2Key: null,
    showcaseVideoR2Key: null,
    showcasePhotoR2Keys: [],
    mediaDisplayUrls: {},
    // The couple has no `vendor_packages` row to copy ★ lines from, and this
    // is not a read that failed. `none_linked` is the honest one of the three.
    customization: { status: 'none_linked' },
  };
}
