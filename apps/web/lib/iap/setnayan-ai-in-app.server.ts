import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSetnayanAiPaywallEnabled, resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import { resolveAiBandForEventType } from '@/lib/setnayan-ai-band-source';
import { AI_TIER_SKU } from '@/lib/setnayan-ai-type-pricing';
import { SETNAYAN_AI_SKU } from '@/lib/setnayan-ai-event-pricing';

/**
 * 🍎 MAY THE iPHONE APP SELL SETNAYAN AI FOR THIS EVENT? — one rule, asked by the page that draws the Apple door
 * (`studio/setnayan-ai/page.tsx`) and by the server before Apple's sheet opens (`startAppStorePurchase`).
 *
 * 💰 WHY THIS EXISTS (2026-10-23, no guessing on money). Apple sells ONE price per product, and the App Store price
 * is web ÷ 0.85 of the product's catalogue row (DECISION_LOG 2026-10-18, ruling 4 — `appStorePriceFloorPhp`, and
 * the fulfilment's floor check reads exactly that row, `SETNAYAN_AI`). On the web, with the per-event-type switch on,
 * Setnayan AI is priced from the event's BAND row (`SETNAYAN_AI_B/_C/_D`, `lib/setnayan-ai-type-pricing.ts`). One
 * Apple price cannot honour four web rungs: a band-D event would pay the band-A figure in the app. So the app sells
 * Setnayan AI ONLY to an event whose web price row IS the product's row:
 *
 *   · per-event-type switch OFF → every event is charged the flat `SETNAYAN_AI` row on the web → sold in the app
 *     (except a band with no product at all — Tier E, no suppliers to reach);
 *   · switch ON → only an event in the band whose row is `SETNAYAN_AI` (Tier A today).
 *
 * Every other event sees no Apple door — the app as it was before 23 Oct for that event. Selling the other bands in
 * the app needs an owner decision (one more product per band, or one price for all) — flagged, not decided here.
 *
 * And never while the paywall is OFF: then Setnayan AI is free for everyone and there is nothing to sell.
 *
 * `error` = a read failed: the caller refuses (try again), never sells on a guess.
 */
export type SetnayanAiInApp = 'sellable' | 'not_on_sale' | 'error';

export async function setnayanAiSoldInApp(admin: SupabaseClient, eventId: string): Promise<SetnayanAiInApp> {
  try {
    if (!(await resolveSetnayanAiPaywallEnabled())) return 'not_on_sale';
    const { data, error } = await admin.from('events').select('event_type').eq('event_id', eventId).maybeSingle();
    if (error) return 'error';
    if (!data) return 'not_on_sale';
    const band = await resolveAiBandForEventType(admin, (data as { event_type?: string | null }).event_type ?? null);
    if (band.status === 'read_error') return 'error';
    const bandSku = AI_TIER_SKU[band.band];
    if (bandSku === null) return 'not_on_sale';
    if (!(await resolveSetnayanAiPerEventPricingEnabled())) return 'sellable';
    return bandSku === SETNAYAN_AI_SKU ? 'sellable' : 'not_on_sale';
  } catch {
    return 'error';
  }
}
