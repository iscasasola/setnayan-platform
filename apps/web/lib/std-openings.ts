import type { SupabaseClient } from '@supabase/supabase-js';
import { eventOwnsSku } from '@/lib/entitlements';

/**
 * apps/web/lib/std-openings.ts
 *
 * Ownership gate for the (premium) Save-the-Date cinematic OPENINGS — the
 * envelope / door / veil reveal that lifts to uncover the couple's wedding page
 * (iteration 0024 · PR4 P5).
 *
 * The owner-settled model (2026-06-17): the auto-playing content FILM is FREE
 * (it always plays — lib/save-the-date-content.ts + save-the-date-film.tsx); the
 * cinematic openings layered ON TOP are the PREMIUM. This resolves whether an
 * event has bought that premium opening unlock.
 *
 * GATE WIRING (additive):
 *   RevealOverlay shows an opening when ANY of: the admin global toggle
 *   (config.enabled, the Reveal Studio master) · the ?reveal= preview override ·
 *   THIS per-event ownership. With the admin global toggle OFF (the default),
 *   ownership is the live gate → only couples who bought the unlock get openings.
 *
 * ✅ ACTIVATED 2026-06-17 (owner-priced ₱799): the catalog row is seeded
 *   (migration 20270113942330 · platform_retail_catalog_v2 · STD_PREMIUM_OPENINGS)
 *   and the buy-CTA is LIVE on /add-ons/save-the-date (the InlineCheckoutDrawer
 *   flow, mirroring Animated Monogram). The admin global toggle stays OFF, so it's
 *   purchase-gated. The free content film stays free throughout.
 *
 * PRICE IS ADMIN-MANAGED — ₱799 is the owner-set seed; change it anytime at
 * /admin/pricing?edit=STD_PREMIUM_OPENINGS. Read at runtime via formatV2Sku,
 * never hardcoded. PROVISIONAL — reconcile vs the ₱3,999 PRO unlock (à-la-carte
 * vs included) in the holistic pricing pass.
 *
 * SAFETY · queries the existing `orders` table via the shared bundle-aware
 * eventOwnsSku() reader — no new table, no migration, graceful-degrade to "not
 * owned" on a missing orders table (matches eventOwnsAnimatedMonogram).
 */

export const STD_PREMIUM_OPENINGS_SERVICE_KEY = 'STD_PREMIUM_OPENINGS';

/**
 * Does this event own the premium Save-the-Date openings unlock?
 * Dormant until the SKU is sellable (see the activation runbook above).
 */
export async function eventOwnsStdOpenings(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, STD_PREMIUM_OPENINGS_SERVICE_KEY);
}
