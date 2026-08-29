/**
 * setnayan-ai-event-pricing.ts — server-side Setnayan AI price resolution.
 *
 * CURRENT MODEL — per-EVENT-TYPE pricing (owner-locked 2026-07-22 "go"): the
 * price is set by the event's TYPE on a discrete load-based ladder (₱1,499
 * Wedding · ₱899 Debut/Corporate · ₱499 standard · ₱99 light · ₱0 no-vendors).
 * The pure classification (type → tier → catalog SKU) lives in
 * lib/setnayan-ai-type-pricing.ts; `resolveSetnayanAiType*` below read the tier
 * SKU's catalog price. Gated by `setnayan_ai_per_event_pricing_enabled` at the
 * checkout call site (default OFF → the flat SETNAYAN_AI catalog charge stands).
 *
 * SUPERSEDED — the intro/renewal cadence (₱499 first 28-day cycle / ₱799 after,
 * `resolveSetnayanAiEventChargeCentavos` + lib/setnayan-ai-pricing.ts) is kept
 * for lineage but NO LONGER wired into checkout: the 2026-07-22 per-type ladder
 * replaced it as the meaning of "per-event pricing". Prices stay catalog-
 * authoritative (never hardcoded); the code carries only last-resort fallbacks.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveSetnayanAiOrderPricePhp } from './setnayan-ai-pricing';
import {
  AI_TIER_ONBOARDING_FALLBACK_PHP,
  AI_TIER_FALLBACK_PHP,
  AI_TIER_SKU,
  setnayanAiTierFallbackPhp,
  type AiPriceContext,
} from './setnayan-ai-type-pricing';
import { resolveAiBandForEventType } from './setnayan-ai-band-source';

/** The intro catalog SKU (₱499 first cycle) — the live per-event AI row. */
export const SETNAYAN_AI_SKU = 'SETNAYAN_AI';
/** The renewal catalog SKU (₱799 per cycle after the first). */
export const SETNAYAN_AI_RENEW_SKU = 'SETNAYAN_AI_RENEW';

/**
 * A price resolution that keeps a READ ERROR and an ABSENT ROW apart.
 *
 * 🔑 THE WHOLE POINT OF THIS TYPE. The old code destroyed that distinction by
 * discarding Supabase's `error` and testing only `data`, so "the database
 * refused to answer" and "this row legitimately has no price" arrived at the
 * same branch — and both charged the hardcoded ladder. One of those is a fact
 * the fallback was written for; the other is a guess with somebody's money on
 * it. Owner 2026-08-27: REFUSE THE SALE. Better to say "try again in a minute"
 * than take their money at a figure nobody chose.
 */
export type AiPriceResolution =
  | { status: 'resolved'; php: number }
  | { status: 'read_error'; message: string };

/**
 * Resolve a tier's price from the catalog, HONESTLY — the core both the display
 * helper and the charge path are built on.
 *
 * `is_active` is deliberately not filtered: the B/C/D tier rows are price
 * SOURCES, not sellable cards, and ship inactive on purpose.
 *
 * -- WHY AN ABSENT ROW STILL FALLS BACK, AND A FAILED READ NO LONGER DOES -----
 * They are different facts:
 *
 *   - READ ERROR: network, timeout, an RLS refusal, a malformed response. No
 *     price is knowable. Anything charged here is invented, so this REFUSES.
 *   - ABSENT ROW / NULL PRICE: legitimate, and precisely what the locked ladder
 *     in `setnayan-ai-type-pricing.ts` exists for. An environment where the
 *     seeding migration has not run (CI, a preview build) must still quote the
 *     owner-locked number rather than block a sale. Verified against production
 *     2026-08-27: all four tier rows exist AND match that ladder exactly
 *     (A 2499/1499 - B 1499/899 - C 899/499 - D 199/99), so in prod this branch
 *     is unreachable anyway; refusing on it would buy nothing and break every
 *     unseeded environment.
 *
 * WHETHER AN ABSENT ROW SHOULD *ALSO* REFUSE IS A SEPARATE OWNER DECISION and is
 * deliberately NOT folded in here. His ruling was about the failed read.
 */
export async function resolveSetnayanAiTypePriceResolution(
  client: SupabaseClient,
  eventType: string | null | undefined,
  context: AiPriceContext = 'regular',
): Promise<AiPriceResolution> {
  /*
    THE BAND COMES FROM THE OWNER'S SCREEN, NOT FROM A MAP IN THIS REPO.
    Until 2026-08-29 this line read a hardcoded TypeScript map, so the tick-box
    on /admin/pricing?tab=setnayan-ai wrote a column that NOTHING charging ever
    read. Moving a kind of celebration into another band changed the admin
    screen and not one peso. See lib/setnayan-ai-band-source.ts.

    ⚠ A FAILED READ REFUSES, exactly as the catalog read below does. Letting it
    fall through to the map would re-create the collapse SEC-7 removed: an
    unanswerable question quietly answered with a number nobody chose.
  */
  const bandRes = await resolveAiBandForEventType(client, eventType);
  if (bandRes.status === 'read_error') {
    return { status: 'read_error', message: bandRes.message };
  }
  const band = bandRes.band;
  const sku = AI_TIER_SKU[band];
  // Tier E - Setnayan AI is not present for this type. A product fact, so there
  // is nothing to charge and nothing further that can fail.
  if (sku === null) return { status: 'resolved', php: 0 };

  const { data, error } = await client
    .from('platform_retail_catalog_v2')
    .select('retail_price_php, onboarding_price_php')
    .eq('service_code', sku)
    .maybeSingle();

  // THE LINE THIS FIX IS ABOUT. `error` used to be destructured away.
  // `.maybeSingle()` reports "no such row" as data:null WITH error:null, so a
  // non-null error here is a genuine failure to read and never an empty result.
  if (error) {
    return {
      status: 'read_error',
      message: `platform_retail_catalog_v2(${sku}): ${error.message}`,
    };
  }

  const row = data as
    | { retail_price_php?: number | null; onboarding_price_php?: number | null }
    | null;

  const usable = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;

  // THE SIGN-UP PRICE FALLS BACK TO THE REGULAR ONE, NEVER TO ZERO OR TO FREE.
  // `onboarding_price_php` is nullable and means "no sign-up discount for this
  // service" - most rows have none. Reading NULL as 0 would hand the product
  // away; reading it as "skip the discount" is the only safe direction, and it
  // is also what a service with no discount genuinely wants.
  if (context === 'onboarding' && usable(row?.onboarding_price_php)) {
    return { status: 'resolved', php: row!.onboarding_price_php as number };
  }
  if (usable(row?.retail_price_php)) {
    // An onboarding read with no discount on the row pays the regular price.
    return { status: 'resolved', php: row!.retail_price_php as number };
  }
  // The locked ladder, for the band we actually resolved — NOT re-derived from
  // the map, which would discard the owner's choice at the last step and quote
  // a different band's price than the one this function just used to pick the SKU.
  return {
    status: 'resolved',
    php:
      context === 'onboarding'
        ? AI_TIER_ONBOARDING_FALLBACK_PHP[band]
        : AI_TIER_FALLBACK_PHP[band],
  };
}

/**
 * The price to DISPLAY for an event type. Never throws, always yields a number.
 *
 * DISPLAY ONLY - DO NOT CHARGE FROM THIS. On a read error it degrades to the
 * locked ladder so a page renders a number instead of exploding, which is the
 * right trade for a screen and the WRONG one for money. The charge path uses
 * {@link resolveSetnayanAiTypeChargeCentavos}, which refuses instead;
 * `sec7-refuse-rather-than-guess.test.ts` pins that the money path never reaches
 * this function.
 *
 * A page may therefore show the ladder price while checkout says "try again in a
 * moment". That is deliberate and is the safe direction: the customer is never
 * charged a figure nobody chose, and the number shown is the owner-locked one.
 */
export async function resolveSetnayanAiTypePricePhp(
  client: SupabaseClient,
  eventType: string | null | undefined,
  context: AiPriceContext = 'regular',
): Promise<number> {
  const r = await resolveSetnayanAiTypePriceResolution(client, eventType, context);
  if (r.status === 'resolved') return r.php;
  return setnayanAiTierFallbackPhp(eventType, context);
}

/**
 * How a charge resolution can come out. THREE facts, not two.
 *
 * The old signature was `number | null`, and `null` meant "the event could not
 * be read, so keep the normal catalog charge". That collapsed a refusal into a
 * DIFFERENT PRICE: a failed read fell through and billed the flat SETNAYAN_AI
 * row. Splitting `absent` from `read_error` is what lets the caller keep the old
 * fall-through for the harmless case and refuse for the dangerous one.
 */
export type AiChargeResolution =
  /** A server-resolved amount. Charge this. */
  | { status: 'resolved'; centavos: number }
  /**
   * The event row genuinely is not there. Not an error - the caller keeps its
   * ordinary catalog charge, exactly as it did when this returned `null`.
   */
  | { status: 'absent' }
  /** The read FAILED. No price is knowable, so nothing may be charged. */
  | { status: 'read_error'; message: string };

/**
 * The authoritative per-event Setnayan AI charge in CENTAVOS, resolved from the
 * event's STORED type (server-authoritative - a tampered client cannot force a
 * cheaper tier).
 *
 * REFUSES rather than guesses. Every read here reports its `error`, and an error
 * becomes `read_error`, which `resolveOrderChargeCentavos` turns into the
 * customer-facing "We could not confirm the price for this right now. Please try
 * again in a moment." Owner-ruled 2026-08-27.
 */
export async function resolveSetnayanAiTypeChargeCentavos(
  admin: SupabaseClient,
  eventId: string,
  context: AiPriceContext = 'regular',
): Promise<AiChargeResolution> {
  const { data: ev, error } = await admin
    .from('events')
    .select('event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    return { status: 'read_error', message: `events(${eventId}): ${error.message}` };
  }
  if (!ev) return { status: 'absent' };

  const eventType = (ev as { event_type?: string | null }).event_type ?? null;
  // The RESOLUTION form, not the display helper - so a catalog read error
  // propagates as a refusal instead of being papered over with the ladder.
  const price = await resolveSetnayanAiTypePriceResolution(admin, eventType, context);
  if (price.status === 'read_error') {
    return { status: 'read_error', message: price.message };
  }
  return { status: 'resolved', centavos: Math.round(price.php * 100) };
}

/**
 * Resolve the per-event Setnayan AI charge in CENTAVOS - the intro on the
 * event's first cycle, the renewal after - server-authoritative (re-resolves
 * `introUsed` from stored event state, so a tampered client cannot force the
 * intro price on a renewal).
 *
 * SUPERSEDED and currently callerless (the 2026-07-22 per-type ladder replaced
 * this model), but fixed in the same pass as its live twin ON PURPOSE: leaving
 * the swallow here would keep a worked example of the defect in the file for
 * whoever revives it. `(rows ?? [])` used to turn a failed read into "no such
 * row", which then priced off the hardcoded intro/renewal constants.
 */
export async function resolveSetnayanAiEventChargeCentavos(
  admin: SupabaseClient,
  eventId: string,
): Promise<AiChargeResolution> {
  const { data: ev, error: evError } = await admin
    .from('events')
    .select('setnayan_ai_intro_used')
    .eq('event_id', eventId)
    .maybeSingle();
  if (evError) {
    return { status: 'read_error', message: `events(${eventId}): ${evError.message}` };
  }
  if (!ev) return { status: 'absent' };
  const introUsed =
    (ev as { setnayan_ai_intro_used?: boolean | null }).setnayan_ai_intro_used === true;

  const { data: rows, error: rowsError } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, retail_price_php')
    .in('service_code', [SETNAYAN_AI_SKU, SETNAYAN_AI_RENEW_SKU]);
  if (rowsError) {
    return {
      status: 'read_error',
      message: `platform_retail_catalog_v2(intro/renew): ${rowsError.message}`,
    };
  }

  const priceOf = (code: string): number | null | undefined =>
    (rows ?? []).find(
      (r) => (r as { service_code?: string }).service_code === code,
    )?.retail_price_php as number | null | undefined;

  const pricePhp = resolveSetnayanAiOrderPricePhp({
    introUsed,
    introPricePhp: priceOf(SETNAYAN_AI_SKU),
    renewalPricePhp: priceOf(SETNAYAN_AI_RENEW_SKU),
  });
  return { status: 'resolved', centavos: Math.round(pricePhp * 100) };
}
