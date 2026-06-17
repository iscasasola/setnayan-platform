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
 * GATE WIRING (additive · DORMANT until the owner activates):
 *   RevealOverlay shows an opening when ANY of: the admin global toggle
 *   (config.enabled, the Reveal Studio master) · the ?reveal= preview override ·
 *   THIS per-event ownership. So today (no STD_PREMIUM_OPENINGS is sold) it's a
 *   no-op — the admin global stays the live control. When the owner is ready to
 *   sell openings as the ₱1,499 à-la-carte unlock, the activation runbook is:
 *     (1) seed the STD_PREMIUM_OPENINGS price into platform_retail_catalog_v2
 *         (admin-managed; PROVISIONAL — reconcile vs the ₱3,999 PRO unlock in
 *         the holistic pricing pass);
 *     (2) surface the buy-CTA (InlineCheckoutDrawer) on /add-ons/save-the-date;
 *     (3) turn the admin global toggle OFF so only owners get openings.
 *   The free film stays free throughout.
 *
 * ⚠ PRICE IS NOT SET HERE. Per the admin-managed-pricing rule the amount lives
 * in the catalog (never hardcoded). This change seeds NO price and adds NO
 * paywall — it is the gate plumbing only.
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
