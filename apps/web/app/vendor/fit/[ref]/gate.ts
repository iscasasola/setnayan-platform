import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export type MarketRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  location_city: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  avg_rating_overall: number | string | null;
  review_count: number | null;
  services: string[] | null;
};

/**
 * The one answer the fit check gives that is not the fit check — "no such shop" (404) — decided by `./layout.tsx`
 * BEFORE `./loading.tsx` streams, so it is never sent as a 200, a skeleton and a client hop.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateVendorFit = cache(async (ref: string) => {
  const admin = createAdminClient();
  const cols =
    'vendor_profile_id, business_name, business_slug, logo_url, location_city, hq_latitude, hq_longitude, avg_rating_overall, review_count, services';

  // Resolve the public ref → a market vendor: business slug first, else public_id.
  let market: MarketRow | null = null;
  {
    const bySlug = await admin
      .from('vendor_market_stats')
      .select(cols)
      .eq('business_slug', ref)
      .maybeSingle();
    market = (bySlug.data as MarketRow | null) ?? null;
    if (!market) {
      const { data: prof } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .eq('public_id', ref)
        .maybeSingle();
      if (prof?.vendor_profile_id) {
        const byId = await admin
          .from('vendor_market_stats')
          .select(cols)
          .eq('vendor_profile_id', prof.vendor_profile_id)
          .maybeSingle();
        market = (byId.data as MarketRow | null) ?? null;
      }
    }
  }
  if (!market) notFound();
  return { admin, market };
});
