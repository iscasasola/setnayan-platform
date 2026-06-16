import type { SupabaseClient } from '@supabase/supabase-js';
import { eventOwnsSku } from '@/lib/entitlements';

/**
 * apps/web/lib/pro-website.ts
 *
 * Ownership gate for the paid PRO_WEBSITE SKU (₱5,499 · "Your wedding, on
 * its own website" · CLAUDE.md 2026-05-30 "V2.1 Amendment #3" + Onboarding
 * Blueprint §3.3). The couple's FREE wedding website ships with every event;
 * this resolves whether the event has also bought the Pro Website upgrade.
 *
 * WHY · v2-catalog.ts marks PRO_WEBSITE 'partial' — "free baseline live · Pro
 *       gating not built". The free site works; this is the missing gating so
 *       a couple who owns a paid PRO_WEBSITE order unlocks the Pro capability.
 *
 * Detection — same owned-orders pattern the Website tab already uses for the
 * iteration-0004 widget upgrades (apps/web/app/dashboard/[eventId]/website/
 * page.tsx:124 + _components/pro-upgrade-panel.tsx): an `orders` row with the
 * matching service_key whose status is NOT cancelled / refunded / lapsed.
 * A still-in-reconciliation 'submitted' order counts as owned so the couple
 * can't double-buy while their payment is being verified — identical to the
 * existing widget-upgrade behavior.
 *
 * The canonical service_key is the V2 catalog code 'PRO_WEBSITE' (uppercase),
 * which is exactly what the inline-checkout drawer stamps on the order via
 * submitOrderAction (apps/web/app/dashboard/[eventId]/checkout/actions.ts:383).
 *
 * SAFETY · This helper runs ONLY behind auth on the Website tab (a dashboard
 * surface), never on the public ISR-cached landing page. It queries the
 * existing `orders` table — no new table, no migration. Graceful-degrade on a
 * missing/changed `orders` table (42P01 undefined_table · 42703 undefined_
 * column) so a pre-bootstrap database surfaces the upgrade CTA as the safe
 * default instead of crashing — matches the PR #380/#390 + website/page.tsx
 * hotfix pattern.
 */

export const PRO_WEBSITE_SERVICE_KEY = 'PRO_WEBSITE';

/**
 * Does this event own the paid Pro Website upgrade?
 *
 * Delegates to the shared bundle-aware eventOwnsSku() reader (lib/entitlements.ts)
 * — refund-aware, graceful-degrade on a missing orders table (42P01/42703) so
 * the Website tab shows the upgrade CTA rather than throwing. Bundle-aware so a
 * GUIDED_PACK/MEDIA_PACK buyer (PRO_WEBSITE is in both) isn't denied — matches
 * the other couple-SKU gates after the PR4/PR4b dead-unlock repair.
 *
 * NOTE: this helper currently has NO live callers (the Website-tab Pro gating
 * was never wired up, and PRO_WEBSITE is being collapsed into COUPLE_WEBSITE_PRO
 * — see the PR4b CHANGELOG owner note). Kept bundle-aware so it's correct the
 * moment it IS wired up; the lint-entitlement-gates GUARD keeps it that way.
 */
export async function eventOwnsProWebsite(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, PRO_WEBSITE_SERVICE_KEY);
}
