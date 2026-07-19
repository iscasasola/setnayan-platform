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

/** Standalone à-la-carte Editorial PRO SKU (owner 2026-07-04 · ₱3,499). Unlocks
 *  the same "Editor's Desk" authorship perks as the Couple Website PRO umbrella,
 *  bought on its own. The catalog row lands via a parallel PR; until then an
 *  absent/inactive SKU simply reads false, so there's no ordering dependency. */
export const EDITORIAL_PRO_SERVICE_KEY = 'EDITORIAL_PRO';

/**
 * Editorial PRO gate — the "Editor's Desk" authorship perks (named moments +
 * per-moment write-ups + the manual chapter/order/guest-wishes editors +
 * no-watermark).
 *
 * DUAL UNLOCK (owner 2026-07-04): a couple has Editorial PRO when EITHER
 *   • the standalone à-la-carte EDITORIAL_PRO SKU (₱3,499) is active, OR
 *   • the Couple Website PRO umbrella (₱4,999, includes Editorial PRO) is active.
 * Both are checked bundle-aware + admin-approved via eventSkuActive; an absent
 * EDITORIAL_PRO catalog row just returns false (graceful-degrade in
 * lib/entitlements), so the umbrella path keeps working before the à-la-carte
 * SKU exists.
 *
 * WHY a single helper: gate ALL editor-side authorship features (chapter
 * curation, section reorder, guest-wishes editor) on THIS, so the dual-unlock
 * rule lives in ONE place (a future packaging change is a one-line edit here) —
 * exactly as the render watermark gates on eventCoupleWebsiteProActive.
 */
export async function isEditorialProActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (await eventSkuActive(supabase, eventId, EDITORIAL_PRO_SERVICE_KEY)) return true;
  return eventCoupleWebsiteProActive(supabase, eventId);
}

/**
 * BUY-SURFACE reader for Editorial PRO — bundle- + alias-aware, and it COUNTS a
 * still-in-reconciliation 'submitted' order as owned so a couple mid-review can't
 * double-buy. eventOwnsSku(EDITORIAL_PRO) already matches an order under the
 * COUPLE_WEBSITE_PRO umbrella (SKU_OWNERSHIP_ALIASES), so a couple who bought
 * the umbrella reads as owning Editorial PRO here too. Drives the Editorial PRO
 * buy surface (owned/included/pending states); the render/authoring gate stays
 * isEditorialProActive (admin-approved only).
 */
export async function eventOwnsEditorialPro(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, EDITORIAL_PRO_SERVICE_KEY);
}
