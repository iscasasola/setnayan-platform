/**
 * setnayan-ai-event-pricing.ts — the server resolver for per-EVENT Setnayan AI
 * pricing (owner-locked 2026-07-02: ₱499 first 28-day cycle per event, ₱799
 * every cycle after).
 *
 * The pure intro-vs-renewal DECISION lives in lib/setnayan-ai-pricing.ts. This
 * thin server wrapper reads the two inputs that decision needs — the event's
 * stored `setnayan_ai_intro_used` state and BOTH catalog prices (admin-managed,
 * never hardcoded) — and returns the charge in centavos.
 *
 * The CALLER gates on `setnayan_ai_per_event_pricing_enabled`
 * (lib/integration-config.ts): this only runs when per-event pricing is live, so
 * while the flag is off the normal flat ₱499 catalog charge stands, unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveSetnayanAiOrderPricePhp } from './setnayan-ai-pricing';

/** The intro catalog SKU (₱499 first cycle) — the live per-event AI row. */
export const SETNAYAN_AI_SKU = 'SETNAYAN_AI';
/** The renewal catalog SKU (₱799 per cycle after the first). */
export const SETNAYAN_AI_RENEW_SKU = 'SETNAYAN_AI_RENEW';

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
