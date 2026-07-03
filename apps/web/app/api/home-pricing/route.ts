import { NextResponse } from 'next/server';
import { getHomePricingData } from '@/app/_components/home/pricing-data';

/**
 * GET /api/home-pricing — the live-catalog pricing payload the Prices /
 * Vendors nav overlays render (the same getHomePricingData() the homepage
 * resolves server-side). Exists so the persistent marketing chrome
 * (site-chrome.tsx), a client component mounted in the root layout, can fetch
 * pricing lazily on marketing routes without forcing a catalog read into the
 * root layout's SSR path for every surface (dashboards included).
 *
 * Prices are admin-managed in platform_retail_catalog_v2 — the short s-maxage
 * keeps edits propagating within minutes while absorbing the fetch burst.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const pricing = await getHomePricingData();
  return NextResponse.json(pricing, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
