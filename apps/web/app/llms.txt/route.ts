/**
 * /llms.txt — the AI-crawler surface, rendered from the LIVE catalog.
 *
 * Replaces the former static `public/llms.txt` (deleted in the same commit —
 * Next serves `public/` ahead of route handlers, so leaving the file in place
 * would silently shadow this route and nothing would change).
 *
 * All copy + the render logic live in `lib/llms-txt.ts`, which is pure and unit
 * tested. This handler only does the I/O: read both catalogs, hand the rows over,
 * return text/plain.
 *
 * FAIL-SAFE. If a SKU the copy names is missing from the catalog, `renderLlmsTxt`
 * throws `MissingSkuError` and we serve a SHORT pointer file instead of a
 * half-true one. Publishing "₱undefined" or a silently-dropped service to every
 * answer engine is worse than publishing less: a thin file costs us a little
 * visibility, a wrong file costs us a misquote we cannot retract from a model's
 * cache. The same reasoning applies to an unreadable catalog.
 *
 * Cached for an hour like the sitemaps — a catalog edit reaches crawlers within
 * one revalidate cycle, and the admin SEO audit re-checks daily regardless.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { renderLlmsTxt, type RetailRow, type VendorRow } from '@/lib/llms-txt';

export const revalidate = 3600;

const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const;

/**
 * Served when the catalog cannot produce a complete, truthful file. Deliberately
 * carries NO peso figures — a crawler that reads this learns where to look
 * rather than learning a wrong number.
 */
const FALLBACK = `# Setnayan

> Setnayan (SET-na-yan) is the Philippines-first life-events platform — plan a
> celebration, capture it with the people who came, and keep it together.
> Built and operated in the Philippines. 0% commission on vendor bookings.

Live pricing could not be resolved for this render, and this file never quotes a
price it cannot verify against the catalog. Current pricing is always at
https://www.setnayan.com/pricing.

- Home: https://www.setnayan.com/
- Pricing: https://www.setnayan.com/pricing
- Vendor marketplace: https://www.setnayan.com/explore
- Help: https://www.setnayan.com/help
`;

export async function GET(): Promise<Response> {
  try {
    const admin = createAdminClient();

    // Retail: ALL rows, not just active — the Setnayan AI tier ladder resolves
    // through B/C/D rows that are is_active=FALSE by design (price-source only,
    // see lib/setnayan-ai-type-pricing.ts). Filtering here would silently flatten
    // the ladder back to a single price, which is the exact bug this replaces.
    const [retailRes, vendorRes] = await Promise.all([
      admin
        .from('platform_retail_catalog_v2')
        .select('service_code, title, retail_price_php, is_active'),
      admin
        .from('vendor_billing_catalog')
        .select('sku_code, title, price_php, is_active')
        .eq('is_active', true),
    ]);

    if (retailRes.error || vendorRes.error || !retailRes.data || !vendorRes.data) {
      return new Response(FALLBACK, { headers: HEADERS });
    }

    const body = renderLlmsTxt({
      retail: retailRes.data as RetailRow[],
      vendor: vendorRes.data as VendorRow[],
      refreshedOn: new Date().toISOString().slice(0, 10),
    });

    return new Response(body, { headers: HEADERS });
  } catch {
    // MissingSkuError, or anything else. Serve less rather than serve wrong.
    return new Response(FALLBACK, { headers: HEADERS });
  }
}
