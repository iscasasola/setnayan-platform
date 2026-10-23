import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSetnayanAiPaywallEnabled, resolveSetnayanAiPerEventPricingEnabled } from '@/lib/integration-config';
import { resolveAiBandForEventType } from '@/lib/setnayan-ai-band-source';
import { AI_TIER_SKU, type AiPriceTier } from '@/lib/setnayan-ai-type-pricing';

/**
 * 🍎 WHICH SETNAYAN AI PRODUCT MAY THE iPHONE APP SELL FOR THIS EVENT? — one rule, asked by the page that draws the
 * Apple door (`studio/setnayan-ai/page.tsx`), the Suppliers banner, and the server before Apple's sheet opens
 * (`startAppStorePurchase`, which refuses a product of another tier).
 *
 * Owner, 2026-10-23: Setnayan AI is sold in the app as FOUR consumables, one per web tier (A · B · C · D), so every
 * event type can buy it; Tier E (simple event) stays not offered, as on the web. The tier comes from the SAME place
 * the web's charge takes it — `resolveAiBandForEventType` (`event_type_vocab.ai_price_tier`, the owner's
 * /admin/pricing screen), which `resolveSetnayanAiTypeChargeCentavos` → `resolveSetnayanAiTypePriceResolution`
 * reads — and the SAME switch decides the model: with `setnayan_ai_per_event_pricing_enabled` OFF the web charges
 * every event the flat `SETNAYAN_AI` row, so the app sells every event Tier A's product. There is no second
 * event-type → tier map here.
 *
 * Sign-up and comeback prices are web-only (Apple has one price per product); the app never mentions them.
 * Never while the paywall is OFF: then Setnayan AI is free for everyone and there is nothing to sell.
 *
 * `error` = a read failed: the caller refuses (try again), never sells on a guess.
 */
export type SetnayanAiInApp =
  | { status: 'sellable'; tier: Exclude<AiPriceTier, 'E'> }
  | { status: 'not_on_sale' }
  | { status: 'error' };

export async function setnayanAiTierInApp(admin: SupabaseClient, eventId: string): Promise<SetnayanAiInApp> {
  try {
    if (!(await resolveSetnayanAiPaywallEnabled())) return { status: 'not_on_sale' };
    const { data, error } = await admin.from('events').select('event_type').eq('event_id', eventId).maybeSingle();
    if (error) return { status: 'error' };
    if (!data) return { status: 'not_on_sale' };
    const band = await resolveAiBandForEventType(admin, (data as { event_type?: string | null }).event_type ?? null);
    if (band.status === 'read_error') return { status: 'error' };
    // Tier E has no catalogue row — Setnayan AI is not offered for it, on the web or here.
    if (band.band === 'E' || AI_TIER_SKU[band.band] === null) return { status: 'not_on_sale' };
    if (!(await resolveSetnayanAiPerEventPricingEnabled())) return { status: 'sellable', tier: 'A' };
    return { status: 'sellable', tier: band.band };
  } catch {
    return { status: 'error' };
  }
}
