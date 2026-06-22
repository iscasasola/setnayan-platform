import type { SupabaseClient } from '@supabase/supabase-js';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';

/**
 * apps/web/lib/couple-website-pro.ts
 *
 * Ownership / active gate for the paid COUPLE_WEBSITE_PRO SKU (₱3,999 · the
 * single "Pro website" unlock · migration 20270103020000). Mirrors
 * lib/animated-monogram.ts exactly — a thin, bundle-aware wrapper over the
 * shared lib/entitlements.ts readers so this couple SKU gates orders ONE way
 * (refund-aware, graceful-degrade, defense-in-depth).
 *
 * CANONICAL SKU (load-bearing): COUPLE_WEBSITE_PRO is the ONE website-Pro key.
 * It COLLAPSED the three dead/never-wired keys PRO_WEBSITE, PRO_RSVP and
 * EVENT_WEBSITE (owner 2026-06-14 · "free 4-in-1 couple website + ONE ₱3,999
 * PRO unlock" — Pricing.md §00 + memory project_setnayan_pricing_tiers). Gate
 * EVERY couple-website Pro perk on THIS key, not the legacy ones. The legacy
 * lib/pro-website.ts (PRO_WEBSITE_SERVICE_KEY) is dead-but-inert — do not gate
 * new perks on it.
 *
 * THE V1 PERK · removing the freemium "Powered by Setnayan · setnayan.com"
 * footer WATERMARK from the couple's wedding site + recap + editorial colophon
 * when the SKU is ACTIVE (admin-approved). The free baseline website keeps the
 * watermark; a Pro couple's site sheds it. (The editorial "Powered by Setnayan"
 * SERVICE-CREDITS strip — the chip row listing the SKUs the couple availed — is
 * CONTENT, not a watermark, and is intentionally NOT gated.) Bigger Pro perks
 * (premium templates · custom domain · theme systems) remain an owner product
 * decision and are NOT built here.
 *
 * SAFETY · queries the existing `orders` table via lib/entitlements.ts — no new
 * table, no migration. Graceful-degrade on a missing/changed `orders` table
 * resolves to "not owned" (the safe default — KEEP the watermark) rather than
 * crashing the public page.
 */

export const COUPLE_WEBSITE_PRO_SERVICE_KEY = 'COUPLE_WEBSITE_PRO';

/**
 * Does this event own the paid Couple Website Pro upgrade? Bundle-aware buy-
 * surface reader — counts a still-in-reconciliation 'submitted' order as owned
 * so a couple mid-review can't double-buy. Use this to drive buy/upsell UI.
 */
export async function eventOwnsCoupleWebsitePro(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, COUPLE_WEBSITE_PRO_SERVICE_KEY);
}

/**
 * Is the paid Couple Website Pro ACTIVE (admin-approved)? THE FEATURE GATE —
 * the watermark drops only after the Setnayan team verifies the payment (owner
 * 2026-06-18 handshake). Render gates call THIS; buy surfaces call
 * eventOwnsCoupleWebsitePro.
 */
export async function eventCoupleWebsiteProActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventSkuActive(supabase, eventId, COUPLE_WEBSITE_PRO_SERVICE_KEY);
}
