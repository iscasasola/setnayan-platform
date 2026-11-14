import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';
import { CANVAS_LEFT_PRO_AT, EVENT_ULTRA_SKU, canvasPrintsUnlockedFrom, type PlanOrderFact } from '@/lib/event-ultra';

/**
 * apps/web/lib/event-ultra-gates.ts — the server gates for what ONLY Event Ultra unlocks (owner 2026-11-13).
 *
 * Pro, Live Watch and Patiktok need no gate here: their existing gates (`eventCoupleWebsiteProActive`,
 * `eventSkuActive(LIVE_STUDIO)`, `patiktokSaveUnlocked`) already answer yes for an Ultra event through
 * `SKU_OWNERSHIP_ALIASES` (a gifted Ultra: through `event_has_comp_for_sku`). The 12-month originals need none either:
 * `papic_events_past_fullres_clock` reads the row, for an order or a gift/comp (20271348181787).
 */

/** Is Event Ultra ACTIVE (admin-approved) on this event? The feature gate — a pending order confers nothing. */
export function eventUltraActive(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  return eventSkuActive(supabase, eventId, EVENT_ULTRA_SKU);
}

/**
 * 🖼 May this event print on CANVAS (the Our Day poster builder's canvas sizes)? Ultra — through the whole chain
 * (order, a supplier's GIFTED Ultra from its delivery (owner 2026-11-15: a gifted Ultra is FULL Ultra — it reaches
 * `eventSkuActive` through `event_has_comp_for_sku`), comp, internal host, founder seat) — or an Event Pro bought before
 * canvas left Pro. One rule decides both: `canvasPrintsUnlockedFrom`.
 * Fails CLOSED on a refused orders read (no canvas offered; nothing is taken from a paid order, which still reads on
 * the next request).
 */
export async function eventCanvasPrintsActive(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  if (canvasPrintsUnlockedFrom([], CANVAS_LEFT_PRO_AT, await eventUltraActive(supabase, eventId))) return true;
  const { data, error } = await supabase
    .from('orders')
    .select('service_key, status, created_at')
    .eq('event_id', eventId)
    .in('service_key', ['COUPLE_WEBSITE_PRO', EVENT_ULTRA_SKU])
    .in('status', ['paid', 'fulfilled']);
  if (error) {
    console.error('[supabase-error] lib/event-ultra-gates.ts · from:orders.select', error);
    return false;
  }
  return canvasPrintsUnlockedFrom((data ?? []) as PlanOrderFact[]);
}
