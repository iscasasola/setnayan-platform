import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * apps/web/lib/entitlements.ts
 *
 * Single source of truth for couple-SKU ownership ("does this event own a
 * paid <serviceKey> order?"). Extracted from the 5 identical eventOwns*
 * helpers (pro-website / indoor-blueprint / animated-monogram / papic-seats /
 * papic-guest) + the inline custom-qr-guest gates so every couple SKU gate
 * reads orders ONE way: refund-aware, graceful-degrade, defense-in-depth.
 *
 * Behavior preserved verbatim from eventOwnsProWebsite():
 *   • a row with the matching service_key whose status is NOT in
 *     {cancelled, refunded, lapsed} confers ownership;
 *   • a still-in-reconciliation order (submitted / awaiting_payment / paid /
 *     fulfilled) counts as owned so the couple can't double-buy mid-review;
 *   • 42P01 (undefined_table) / 42703 (undefined_column) → false (safe
 *     pre-bootstrap default = "not owned" = show upgrade CTA), never throws;
 *   • any OTHER DB error still throws so we don't silently mis-gate in prod.
 *
 * NO migration — activation state IS orders.status. This helper does NOT
 * read or write any new column.
 */

/**
 * Statuses that mean an order no longer confers ownership. Anything else
 * (submitted · awaiting_payment · paid · fulfilled) keeps the capability
 * unlocked. Values align with OrderStatus (lib/orders.ts).
 */
export const RELINQUISHED_STATUSES = new Set<string>([
  'cancelled',
  'refunded',
  'lapsed',
]);

export async function checkOrderOwnership(
  supabase: SupabaseClient,
  eventId: string,
  serviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', serviceKey)
    .not('status', 'in', '("cancelled","refunded","lapsed")');

  // Pre-bootstrap / schema-drift tolerance — undefined table or column means
  // the orders substrate isn't there yet; treat as "not owned" so gated
  // surfaces show the upgrade entry point safely. A real error still surfaces.
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(
      `Failed to resolve ownership for ${serviceKey}: ${error.message}`,
    );
  }

  // Defense-in-depth: also filter client-side in case the DB-side enum filter
  // ever drifts — only a row in a live status confers ownership.
  return (data ?? []).some(
    (row) => !RELINQUISHED_STATUSES.has((row.status as string | null) ?? ''),
  );
}
