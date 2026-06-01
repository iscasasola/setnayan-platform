import type { SupabaseClient } from '@supabase/supabase-js';

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
 * Statuses that mean an order no longer confers ownership. Anything else
 * (submitted · pending_approval · approved · paid · fulfilled · active) keeps
 * the capability unlocked. Mirrors the .not('status','in',...) filter at
 * website/page.tsx:130.
 */
const RELINQUISHED_STATUSES = new Set(['cancelled', 'refunded', 'lapsed']);

/**
 * Does this event own the paid Pro Website upgrade?
 *
 * Returns false on any DB shape error (missing table/column) so the Website
 * tab degrades to the upgrade CTA rather than throwing.
 */
export async function eventOwnsProWebsite(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', PRO_WEBSITE_SERVICE_KEY)
    .not('status', 'in', '("cancelled","refunded","lapsed")');

  // Pre-bootstrap / schema-drift tolerance — undefined table or column means
  // the orders substrate isn't there yet; treat as "not owned" so the page
  // shows the upgrade entry point safely. A real error still surfaces so we
  // don't silently mis-gate in production.
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(`Failed to resolve Pro Website ownership: ${error.message}`);
  }

  // Defense-in-depth: also filter client-side in case the DB-side enum filter
  // ever drifts — only a row in a live status confers ownership.
  return (data ?? []).some(
    (row) => !RELINQUISHED_STATUSES.has((row.status as string | null) ?? ''),
  );
}
