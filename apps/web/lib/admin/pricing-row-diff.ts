/**
 * pricing-row-diff.ts — validates ONE catalog row's already-extracted field
 * values and decides whether it changed. `saveRetailRow` (actions.ts) reads
 * every `formData.get(...)` itself — deliberately, so `scan-admin-jobs.ts`
 * (the generator behind the committed admin job checklist, see CLAUDE.md
 * "THE ADMIN HAS A MAP") can still see what this job asks for by reading its
 * source — and hands the raw strings here for validation + diffing. This file
 * takes plain values, not FormData, so it is testable with no request context
 * (no `cookies()`, no Supabase client, no DOM).
 *
 * ── THE BUG THIS SHAPE FIXES ─────────────────────────────────────────────
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 2: "Save all changes" blanked
 * the description of any row whose ⓘ panel was closed at save time, because
 * the OLD bulk editor rendered the description textarea only while that panel
 * was open — so a closed panel meant the field was never in the DOM, never in
 * the POSTed FormData, and the diff read the missing key as `''`, which
 * `desc === '' ? null : desc` turns into `null`. 32 of 34 audited bulk saves
 * wiped a row's note this exact way.
 *
 * The per-row card (catalog-editor.tsx) renders EVERY field this validates
 * unconditionally while the card is open — there is no collapsible panel any
 * more. A field this never receives is a field the form never had, not a
 * field whose value happened to be blank.
 */

export type RawRetailRowFields = {
  title: string;
  desc: string;
  price: string;
  cost: string;
  active: boolean;
  onboardingPrice: string;
  billingPeriod: string;
  isPaxPriced: boolean;
  paxFloor: string;
  paxFloorPrice: string;
  paxIncrementSize: string;
  paxIncrementPrice: string;
};

export type RetailRowPrior = {
  title: string;
  description: string | null;
  retail_price_php: number;
  saas_overhead_cost_php: number;
  is_active: boolean;
  onboarding_price_php: number | null;
  billing_period: string;
  is_pax_priced: boolean;
  pax_floor: number | null;
  pax_floor_price_php: number | null;
  pax_increment_size: number | null;
  pax_increment_price_php: number | null;
};

export type RetailRowNext = {
  title: string;
  description: string | null;
  retail_price_php: number;
  saas_overhead_cost_php: number;
  is_active: boolean;
  onboarding_price_php: number | null;
  billing_period: string;
  is_pax_priced: boolean;
  pax_floor: number | null;
  pax_floor_price_php: number | null;
  pax_increment_size: number | null;
  pax_increment_price_php: number | null;
};

export type ValidatedRetailRow = { ok: true; next: RetailRowNext } | { ok: false; message: string };

const BILLING_PERIODS = new Set(['one_time', 'per_28d', 'per_day', 'per_year']);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Validates and normalizes one row's already-read field values. Returns
 * `{ ok: false }` with a plain-English message for anything the DB's own
 * CHECK constraints would otherwise reject with a raw Postgres error.
 */
export function validateRetailRowFields(raw: RawRetailRowFields): ValidatedRetailRow {
  const title = raw.title.trim();
  if (!title) return { ok: false, message: 'A price needs a name customers can read.' };

  const price = Number(raw.price);
  const cost = Number(raw.cost);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: 'Price must be a number, ₱0 or more.' };
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, message: 'Cost must be a number, ₱0 or more.' };
  }

  const descTrimmed = raw.desc.trim();
  const description = descTrimmed === '' ? null : descTrimmed;

  const onboardingTrimmed = raw.onboardingPrice.trim();
  let onboardingPrice: number | null = null;
  if (onboardingTrimmed !== '') {
    const n = Number(onboardingTrimmed);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: 'Sign-up price must be blank or ₱0 or more.' };
    }
    onboardingPrice = round2(n);
  }

  if (!BILLING_PERIODS.has(raw.billingPeriod)) {
    return { ok: false, message: 'Unrecognized billing period.' };
  }

  let paxFloor: number | null = null;
  let paxFloorPrice: number | null = null;
  let paxIncrementSize: number | null = null;
  let paxIncrementPrice: number | null = null;
  if (raw.isPaxPriced) {
    // Mirrors platform_retail_catalog_v2_pax_config_complete exactly, so a
    // bad value is refused here in plain English instead of the DB CHECK
    // throwing a raw Postgres error at the admin.
    paxFloor = Number(raw.paxFloor);
    paxFloorPrice = Number(raw.paxFloorPrice);
    paxIncrementSize = Number(raw.paxIncrementSize);
    paxIncrementPrice = Number(raw.paxIncrementPrice);
    const valid =
      Number.isFinite(paxFloor) && paxFloor > 0 &&
      Number.isFinite(paxFloorPrice) && paxFloorPrice >= 0 &&
      Number.isFinite(paxIncrementSize) && paxIncrementSize > 0 &&
      Number.isFinite(paxIncrementPrice) && paxIncrementPrice >= 0;
    if (!valid) {
      return {
        ok: false,
        message:
          'Per-head pricing needs a floor count, a floor price, a step size and a step price — all positive.',
      };
    }
    paxFloorPrice = round2(paxFloorPrice);
    paxIncrementPrice = round2(paxIncrementPrice);
  }

  return {
    ok: true,
    next: {
      title,
      description,
      retail_price_php: round2(price),
      saas_overhead_cost_php: round2(cost),
      is_active: raw.active,
      onboarding_price_php: onboardingPrice,
      billing_period: raw.billingPeriod,
      is_pax_priced: raw.isPaxPriced,
      pax_floor: paxFloor,
      pax_floor_price_php: paxFloorPrice,
      pax_increment_size: paxIncrementSize,
      pax_increment_price_php: paxIncrementPrice,
    },
  };
}

/** True when nothing the row card can edit actually changed. */
export function retailRowUnchanged(prior: RetailRowPrior, next: RetailRowNext): boolean {
  return (
    prior.title === next.title &&
    (prior.description ?? null) === next.description &&
    Number(prior.retail_price_php) === next.retail_price_php &&
    Number(prior.saas_overhead_cost_php) === next.saas_overhead_cost_php &&
    prior.is_active === next.is_active &&
    (prior.onboarding_price_php != null ? Number(prior.onboarding_price_php) : null) ===
      next.onboarding_price_php &&
    prior.billing_period === next.billing_period &&
    prior.is_pax_priced === next.is_pax_priced &&
    prior.pax_floor === next.pax_floor &&
    (prior.pax_floor_price_php != null ? Number(prior.pax_floor_price_php) : null) ===
      next.pax_floor_price_php &&
    prior.pax_increment_size === next.pax_increment_size &&
    (prior.pax_increment_price_php != null ? Number(prior.pax_increment_price_php) : null) ===
      next.pax_increment_price_php
  );
}
