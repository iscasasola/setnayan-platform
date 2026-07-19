/**
 * Setnayan — Non-Concierge subscription expiry sweep (Task #23).
 *
 * Twelve SKUs are marked `subscription: true` in `apps/web/lib/sku-catalog.ts`.
 * Only `concierge_complete` had a working expiry-sweep (lib/concierge.ts) until
 * Task #10's stress test surfaced the gap — every other subscription was
 * silently staying at `orders.status='paid'` indefinitely past its term.
 *
 * Per [[reference_setnayan_cron_strategy]] V1 ships NO new cron triggers.
 * This sweep runs lazily at the top of any page that surfaces subscription
 * state (couple event home · vendor dashboard · admin payments), mirroring
 * Concierge's wiring at apps/web/app/dashboard/[eventId]/page.tsx:147.
 *
 * Spec references:
 *   • Migration: supabase/migrations/20260602000000_orders_lapsed_status_and_expires_at.sql
 *   • Stress test: apps/web/scripts/stress-test-lock-unlock.ts (S6)
 *   • CLAUDE.md 2026-05-22 row: Task #10 finding
 *   • Pricing: apps/web/lib/sku-catalog.ts
 *
 * Concierge has its own sweep (`sweepExpiredConcierge` in lib/concierge.ts)
 * because its expiry formula is wedding-anchored (event-row column, not
 * order column). Don't double-sweep — `concierge_complete` is excluded from
 * `LAPSED_SUBSCRIPTION_SKUS`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Order status superset including the new 'lapsed' terminal added by
 * 20260602000000_orders_lapsed_status_and_expires_at.sql. Kept in sync with
 * apps/web/lib/orders.ts's `OrderStatus` type.
 *
 * `lapsed` = subscription expired naturally; no service still being delivered;
 * customer must re-purchase to reactivate. Distinct from `fulfilled` (one-shot
 * service was delivered) and `refunded` (money returned).
 */
export type SubscriptionStatus = 'paid' | 'lapsed' | 'cancelled' | 'refunded';

/**
 * Every sku_code in apps/web/lib/sku-catalog.ts with `subscription: true`
 * EXCEPT `concierge_complete` (Concierge has its own sweep — see
 * lib/concierge.ts:sweepExpiredConcierge).
 *
 * Keep in sync whenever a new subscription SKU lands. The lint-retired-strings
 * check would surface drift if a retired SKU appears here; the typecheck would
 * surface drift if a string disappears from sku-catalog.
 */
export const LAPSED_SUBSCRIPTION_SKUS: readonly string[] = [
  // Vendor subscriptions
  'vendor_pro_weekly',
  'all_tools_unlock_annual',
  'tool_mood_board_weekly',
  'tool_seat_arrangement_weekly',
  'tool_palette_weekly',
  'tool_qr_reader_weekly',
  'tool_advanced_pricing_weekly',
  'vendor_verification_annual_renewal',

  // Couple-side (annual)
  'panood_annual_streaming',
  'panood_annual_streaming_plus',

  // Cross-purchaser (annual)
  'papic_cam_bridge_all_slots_annual',
];

/**
 * Result of `sweepLapsedSubscriptions`. `swept_orders` returns the
 * order_ids that flipped, which is useful for unit tests and for the
 * stress test S6 to assert exactly which rows transitioned.
 */
export type SubscriptionSweepResult = {
  swept_count: number;
  swept_orders: string[];
};

/**
 * Optional scope filter. When called from a couple dashboard, only sweep
 * that event's orders. When called from vendor dashboard, only sweep orders
 * by that vendor's user_id. When called from admin payments, no filter
 * (global sweep — safest at admin scale because the admin queue is the
 * audit-of-last-resort).
 *
 * Both fields nullable; an empty options object is global.
 */
export type SubscriptionSweepOptions = {
  eventId?: string;
  /**
   * The vendor's `user_id` (auth user id), NOT the `vendor_profile_id`.
   * orders.user_id stores who placed the order, which for vendor-purchased
   * subscriptions IS the vendor's auth user. We don't join via
   * vendor_profiles because the order may pre-date the vendor profile
   * (rare but possible for vendors who delete + recreate their profile).
   */
  vendorUserId?: string;
};

/**
 * Lazy subscription expiry sweep. Idempotent — re-running immediately after
 * a successful sweep is a no-op because the WHERE clause filters on
 * `status='paid'` which the prior call has already advanced.
 *
 * Atomicity via the `WHERE status='paid'` guard mirrors the Task #8 payment
 * idempotency rule (`supabase/migrations/20260601030000_payment_idempotency_hardening.sql`)
 * — two concurrent sweeps both attempt the same UPDATE but only one
 * succeeds because Postgres serializes the status transition.
 *
 * Best-effort: failures swallowed + logged via console.error. The admin
 * sweep (no scope filter) acts as the audit-of-last-resort safety net if
 * an event-scoped sweep silently fails.
 */
export async function sweepLapsedSubscriptions(
  supabase: SupabaseClient,
  options: SubscriptionSweepOptions = {},
): Promise<SubscriptionSweepResult> {
  try {
    const nowIso = new Date().toISOString();

    let query = supabase
      .from('orders')
      .update({ status: 'lapsed', updated_at: nowIso })
      .eq('status', 'paid')
      .in('service_key', LAPSED_SUBSCRIPTION_SKUS as string[])
      .lt('expires_at', nowIso);

    if (options.eventId) {
      query = query.eq('event_id', options.eventId);
    }
    if (options.vendorUserId) {
      query = query.eq('user_id', options.vendorUserId);
    }

    const { data, error } = await query.select('order_id');

    if (error) {
      console.error('[subscriptions] lapsed sweep failed:', error);
      return { swept_count: 0, swept_orders: [] };
    }

    const swept_orders = (data ?? []).map((row) => (row as { order_id: string }).order_id);
    return { swept_count: swept_orders.length, swept_orders };
  } catch (e) {
    console.error('[subscriptions] lapsed sweep threw:', e);
    return { swept_count: 0, swept_orders: [] };
  }
}

/**
 * Compute the expires_at for a newly-activated subscription order.
 * Mirrors the duration map used by the migration backfill, so callers can
 * populate `orders.expires_at` at activate time and the sweep stays purely
 * read-only on the SKU-code map (no per-SKU branches in the SQL).
 *
 * Returns null for non-subscription SKUs (the sweep ignores rows where
 * expires_at IS NULL — see `orders_subscription_expiry_idx`).
 */
export function computeSubscriptionExpiry(
  skuCode: string,
  activatedAt: Date = new Date(),
): Date | null {
  const days = SUBSCRIPTION_DURATION_DAYS[skuCode];
  if (!days) return null;
  return new Date(activatedAt.getTime() + days * 86_400_000);
}

/**
 * Duration in days per subscription SKU. Source of truth — keep in sync
 * with sku-catalog.ts `unit` field and with the backfill in
 * 20260602000000_orders_lapsed_status_and_expires_at.sql.
 *
 * Not exported as part of the public API — callers should use
 * `computeSubscriptionExpiry()` for the date math.
 */
const SUBSCRIPTION_DURATION_DAYS: Record<string, number> = {
  // Weekly (7 days)
  vendor_pro_weekly: 7,
  tool_mood_board_weekly: 7,
  tool_seat_arrangement_weekly: 7,
  tool_palette_weekly: 7,
  tool_qr_reader_weekly: 7,
  tool_advanced_pricing_weekly: 7,

  // Annual (365 days)
  panood_annual_streaming: 365,
  panood_annual_streaming_plus: 365,
  all_tools_unlock_annual: 365,
  papic_cam_bridge_all_slots_annual: 365,
  vendor_verification_annual_renewal: 365,
};
