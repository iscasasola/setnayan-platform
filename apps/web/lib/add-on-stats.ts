import type { SupabaseClient } from '@supabase/supabase-js';

// Aggregate stats that drive the App Store-style stat carousel on the
// add-on detail page (apps/web/app/dashboard/[eventId]/add-ons/[addon]/page.tsx).
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

// Maps the launcher manifest's `addon.key` → service_catalog.sku_codes that
// count toward this feature. Mirrors the V1 SKU lock in
// supabase/migrations/20260516000000_v1_sku_lock_service_catalog.sql.
// Keep in sync when SKUs land or retire.
export const ADD_ON_SKU_MAP: Record<string, ReadonlyArray<string>> = {
  panood: [
    'panood_daily_broadcast',
    'panood_camera_sync',
    'panood_annual_streaming',
    'panood_annual_streaming_plus',
    'ai_video_highlight_60s',
    'ai_edited_highlight_3min',
    'same_day_edit',
    'custom_monogram_pack',
    'broadcast_style_pack',
    'pro_camera_bridge_addon',
  ],
  papic: [
    // 0012 SKUs slot in here once the iteration's catalog rows land.
  ],
  'mood-board': [],
  'save-the-date': ['save_the_date_render'],
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
