/**
 * Vendors sitemap at /sitemap-vendors.xml.
 *
 * SEO/GEO Bucket 3 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row).
 *
 * Queries `vendor_profiles` for every publicly-visible non-demo vendor
 * row and emits one URL per `/v/<business_slug>` with honest per-row
 * `<lastmod>` from `updated_at`. This is the compounding-flywheel
 * surface — every newly-verified vendor lands here within the next
 * cache cycle (1hr revalidate · future enhancement: revalidateTag
 * hook on verifyVendor server action).
 *
 * Schema source (per supabase/migrations/20260513120000_iteration_0022_*
 * + 20260515000000_vendor_public_visibility + 20260603201000_demo_vendor_*):
 *   business_slug         TEXT  (the URL slug · NULL allowed but filtered)
 *   public_visibility     TEXT  (= 'verified' means publicly indexable)
 *   is_demo               BOOLEAN  (TRUE on test-seed rows · filtered out)
 *   updated_at            TIMESTAMPTZ NOT NULL
 *
 * Filter chain (must satisfy ALL):
 *   1. business_slug IS NOT NULL                — the URL is constructable
 *   2. public_visibility = 'verified'           — marketplace exposes them
 *   3. is_demo IS NOT TRUE                      — not a test-seed row
 *
 * Per v2.1 brief § 3 + CLAUDE.md tenth 2026-05-28 row: Free vendors get
 * marketplace listing only (no `/v/[slug]` microsite). Verified+ vendors
 * get the microsite. The `public_visibility = 'verified'` filter is the
 * proxy for "this vendor has a real microsite at /v/<slug>".
 *
 * Failure mode: empty `<urlset>` on DB error or empty result.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  firstVendorSitemapQuery,
  nextVendorSitemapQuery,
  vendorSeoPlanForVendor,
  type VendorSitemapQuery,
} from '@/lib/vendor-seo-tier';
import { isVendorSeoTierGateEnabled } from '@/lib/vendor-seo-tier-flag';

export const revalidate = 3600;

type VendorSitemapRow = {
  business_slug: string | null;
  updated_at: string;
  tier_state?: string | null;
  tier_expires_at?: string | null;
};

export async function GET(): Promise<Response> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';

  // Priority-sitemap tiering (Vendor_Monetization_Model_LOCKED_2026-07-25 § 8)
  // — FLAG-DARK. While dark we neither READ nor USE the tier columns: the
  // select string is the original two columns and every row keeps the flat 0.8
  // priority, so the emitted XML is byte-identical to today. (Gating the READ
  // too, not just the use, is deliberate — PostgREST answers a select naming an
  // unknown column with 42703 and fails the WHOLE query, so a schema/deploy
  // skew must not be able to empty the sitemap while the feature is off.)
  //
  // The fallback ladder lives in lib/vendor-seo-tier.ts as a pure planner
  // (`firstVendorSitemapQuery` / `nextVendorSitemapQuery`) so it is unit-
  // testable without a database. Its load-bearing invariant: a missing TIER
  // column costs us only the tier columns — it must NEVER cost us the
  // `verification_state` / `is_demo` filters, because dropping those
  // republishes demo fixtures and unverified vendors to crawlers.
  const seoGateOn = isVendorSeoTierGateEnabled();

  let urls = '';

  try {
    const admin = createAdminClient();

    const runQuery = (query: VendorSitemapQuery) => {
      const base = admin
        .from('vendor_profiles')
        .select(query.cols)
        .eq('public_visibility', 'verified');
      // PR-B — exclude UNVERIFIED and DEMO vendors from the sitemap. An
      // unverified vendor has no public website (mirrored in /v/[slug] +
      // Explore), so it must not be advertised to crawlers. The reconcile
      // migration 20270331400000 marked the founder + every paid vendor
      // 'verified'.
      const filtered = query.visibilityFilters
        ? base.eq('verification_state', 'verified').or('is_demo.is.null,is_demo.eq.false')
        : base;
      return filtered.order('updated_at', { ascending: false }).limit(50_000);
    };

    let query = firstVendorSitemapQuery(seoGateOn);
    let result = await runQuery(query);
    // Bounded at three attempts — the planner strictly narrows and returns null
    // once there is nothing left to drop.
    for (;;) {
      const next = result.error
        ? nextVendorSitemapQuery(query, result.error.message)
        : null;
      if (!next) break;
      query = next;
      result = await runQuery(query);
    }

    if (result.error) {
      console.error('[sitemap-vendors] query error', result.error.message);
    }

    const rows = result.data as unknown as VendorSitemapRow[] | null;

    if (rows && rows.length > 0) {
      urls = rows
        .filter(
          (row): row is VendorSitemapRow & { business_slug: string } =>
            typeof row.business_slug === 'string' && row.business_slug.length > 0,
        )
        .map((row) => {
          // Dark (or tier columns unread) ⇒ legacy plan ⇒ 0.8 for every row,
          // today's constant. A LAPSED paid tier collapses to free inside
          // vendorSeoPlanForVendor — nobody is logged in on a crawler hit, so
          // the login-driven expiry sweep has not run.
          const priority = vendorSeoPlanForVendor(row, seoGateOn).sitemapPriority;
          return `  <url>\n    <loc>${baseUrl}/${encodeURIComponent(row.business_slug)}</loc>\n    <lastmod>${new Date(row.updated_at).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
        })
        .join('\n');
    }
  } catch (e) {
    console.error('[sitemap-vendors] threw', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
