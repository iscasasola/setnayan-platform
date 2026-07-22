/**
 * setnayan-ai-event-pricing.ts — server-side Setnayan AI price resolution.
 *
 * CURRENT MODEL — per-EVENT-TYPE pricing (owner-locked 2026-07-22 "go"): the
 * price is set by the event's TYPE on a discrete load-based ladder (₱1,499
 * Wedding · ₱999 Debut/Corporate · ₱499 standard · ₱99 light · ₱0 no-vendors).
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
  setnayanAiTierSkuForEventType,
  setnayanAiTierFallbackPhp,
} from './setnayan-ai-type-pricing';

/** The intro catalog SKU (₱499 first cycle) — the live per-event AI row. */
export const SETNAYAN_AI_SKU = 'SETNAYAN_AI';
/** The renewal catalog SKU (₱799 per cycle after the first). */
export const SETNAYAN_AI_RENEW_SKU = 'SETNAYAN_AI_RENEW';

/**
 * Resolve the Setnayan AI price (PHP) for an event TYPE from the catalog. Reads
 * the tier SKU's `retail_price_php` directly — `is_active` is irrelevant here
 * (the B/C/D tier rows are price sources, not sellable cards), same as the
 * intro/renew resolver. Falls back to the locked ladder value only when the row
 * is unreadable, so the charge degrades to the right number instead of ₱0. Tier
 * E (no vendors) → 0.
 */
export async function resolveSetnayanAiTypePricePhp(
  client: SupabaseClient,
  eventType: string | null | undefined,
): Promise<number> {
  const sku = setnayanAiTierSkuForEventType(eventType);
  if (sku === null) return 0; // Tier E — Setnayan AI is not present for this type.
  const { data } = await client
    .from('platform_retail_catalog_v2')
    .select('retail_price_php')
    .eq('service_code', sku)
    .maybeSingle();
  const catalogPhp = (data as { retail_price_php?: number | null } | null)?.retail_price_php;
  return typeof catalogPhp === 'number' && Number.isFinite(catalogPhp) && catalogPhp > 0
    ? catalogPhp
    : setnayanAiTierFallbackPhp(eventType);
}

/**
 * The authoritative per-event Setnayan AI charge in CENTAVOS, resolved from the
 * event's STORED type (server-authoritative — a tampered client can't force a
 * cheaper tier). Returns null when the event can't be read, so the caller keeps
 * the normal catalog charge rather than mis-billing.
 */
export async function resolveSetnayanAiTypeChargeCentavos(
  admin: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { data: ev } = await admin
    .from('events')
    .select('event_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return null;
  const eventType = (ev as { event_type?: string | null }).event_type ?? null;
  const pricePhp = await resolveSetnayanAiTypePricePhp(admin, eventType);
  return Math.round(pricePhp * 100);
}

/**
 * Resolve the per-event Setnayan AI charge in CENTAVOS — the intro on the
 * event's first cycle, the renewal after — server-authoritative (re-resolves
 * `introUsed` from stored event state, so a tampered client can't force the
 * intro price on a renewal). Returns null when the event can't be read, so the
 * caller keeps the normal catalog charge rather than mis-billing.
 */
export async function resolveSetnayanAiEventChargeCentavos(
  admin: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { data: ev } = await admin
    .from('events')
    .select('setnayan_ai_intro_used')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return null;
  const introUsed = (ev as { setnayan_ai_intro_used?: boolean | null }).setnayan_ai_intro_used === true;

  const { data: rows } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, retail_price_php')
    .in('service_code', [SETNAYAN_AI_SKU, SETNAYAN_AI_RENEW_SKU]);
  const priceOf = (code: string): number | null | undefined =>
    (rows ?? []).find(
      (r) => (r as { service_code?: string }).service_code === code,
    )?.retail_price_php as number | null | undefined;

  const pricePhp = resolveSetnayanAiOrderPricePhp({
    introUsed,
    introPricePhp: priceOf(SETNAYAN_AI_SKU),
    renewalPricePhp: priceOf(SETNAYAN_AI_RENEW_SKU),
  });
  return Math.round(pricePhp * 100);
}
