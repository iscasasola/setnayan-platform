import type { SupabaseClient } from '@supabase/supabase-js';

// Aggregate stats that drive the App Store-style stat carousel on the
// add-on detail page (apps/web/app/dashboard/[eventId]/studio/[addon]/page.tsx).
//
// Cheap reads — three indexed COUNT/AVG queries against `orders` +
// `feature_reviews` + `events`. No materialized views in V1; if the
// hero stat carousel ever becomes a hot path, swap to a refresh_every_hour
// view keyed by feature_key.

export type AddOnStats = {
  // Number of distinct events that have purchased at least one SKU under
  // this feature (the customer-facing "events that used it" count).
  eventsWithFeature: number;
  // Total active wedding events on the platform — denominator for the
  // "% of weddings use this" tile.
  totalEvents: number;
  // Total paid orders against this feature's SKUs (multi-purchase SKUs
  // accumulate). Drives the "purchased" tile.
  paidOrderCount: number;
  // Mean rating from feature_reviews (1.0–5.0) + sample size.
  avgRating: number | null;
  reviewCount: number;
  // True when we've crossed enough usage / reviews that the carousel
  // should show real numbers. Below thresholds, the page renders a
  // "Just launched" chip per the launch-honesty rule from the
  // 2026-05-17 decision log.
  hasLaunchSignal: boolean;
};

const JUST_LAUNCHED_ORDER_THRESHOLD = 5;
const JUST_LAUNCHED_REVIEW_THRESHOLD = 3;

// Maps the launcher manifest's `addon.key` → the `orders.service_key` values
// that count toward this feature.
//
// ⚠ These MUST be V2 `platform_retail_catalog_v2.service_code` values, not the
// legacy v1 `service_catalog.sku_code` values — `orders.service_key` has stored
// V2 codes since the catalog cutover, and this map is matched against it with
// `.in('service_key', skus)` here AND (via `lib/add-on-state.ts`) in
// `resolveAddOnState`, which decides whether a couple sees "Launch" or a buy
// button. A stale v1 code here does not merely under-count stats: it LOCKS a
// paid couple out of the feature they bought.
//
// Fixed 2026-07-21 (admin-pricing council audit): `panood` still listed seven
// v1 codes (`panood_daily_broadcast`, `ai_video_highlight_60s`, …), none of
// which can ever match, while prod holds 2 paid `PANOOD_SYSTEM` orders on one
// event — that event was being shown a buy button instead of its control room.
// Keep in sync when SKUs land or retire; verify against
// `platform_retail_catalog_v2`, never against `sku-catalog.ts`.
export const ADD_ON_SKU_MAP: Record<string, ReadonlyArray<string>> = {
  panood: [
    // Live Studio, repackaged 2026-07-20 into two controller SKUs
    // (Desktop ₱2,500/day · Mobile ₱1,500/day). Both grant the feature.
    'PANOOD_SYSTEM',
    'PANOOD_SYSTEM_MOBILE',
  ],
  papic: [
    // 0012 SKUs slot in here once the iteration's catalog rows land.
  ],
  'mood-board': [],
  'save-the-date': [], // now the free page-opening reveal (no SKU); video render retired 2026-06-16
  led: [],
  patiktok: [],
  'photo-delivery': [],
  'supplies-marketplace': [],
};

export async function fetchAddOnStats(
  supabase: SupabaseClient,
  featureKey: string,
): Promise<AddOnStats> {
  const skus = ADD_ON_SKU_MAP[featureKey] ?? [];

  const ordersQuery =
    skus.length === 0
      ? Promise.resolve({ data: [], error: null } as {
          data: { event_id: string | null }[] | null;
          error: unknown;
        })
      : supabase
          .from('orders')
          .select('event_id')
          .in('service_key', skus)
          .eq('status', 'paid');

  const totalEventsQuery = supabase
    .from('events')
    .select('event_id', { count: 'exact', head: true });

  const reviewsQuery = supabase
    .from('feature_reviews')
    .select('rating')
    .eq('feature_key', featureKey);

  const [orderRes, totalRes, reviewRes] = await Promise.all([
    ordersQuery,
    totalEventsQuery,
    reviewsQuery,
  ]);

  const orderRows = (orderRes.data ?? []) as { event_id: string | null }[];
  const paidOrderCount = orderRows.length;
  const eventsWithFeature = new Set(
    orderRows.map((r) => r.event_id).filter((id): id is string => Boolean(id)),
  ).size;

  const totalEvents = totalRes.count ?? 0;

  const reviewRows = (reviewRes.data ?? []) as { rating: number }[];
  const reviewCount = reviewRows.length;
  const avgRating =
    reviewCount === 0
      ? null
      : reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewCount;

  const hasLaunchSignal =
    paidOrderCount >= JUST_LAUNCHED_ORDER_THRESHOLD ||
    reviewCount >= JUST_LAUNCHED_REVIEW_THRESHOLD;

  return {
    eventsWithFeature,
    totalEvents,
    paidOrderCount,
    avgRating,
    reviewCount,
    hasLaunchSignal,
  };
}

// Did *this* event purchase any SKU under the feature? Drives the
// "OPEN" vs "GET" hero-CTA flip on the detail page.
export async function eventOwnsFeature(
  supabase: SupabaseClient,
  eventId: string,
  featureKey: string,
): Promise<boolean> {
  const skus = ADD_ON_SKU_MAP[featureKey] ?? [];
  if (skus.length === 0) return false;
  const { count } = await supabase
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('service_key', skus)
    .eq('status', 'paid');
  return (count ?? 0) > 0;
}
