/**
 * sku-anchor.ts — the id of one price row, and nothing else.
 *
 * 🔑 A LEAF ON PURPOSE. Both halves of the link need this: the admin search
 * builds `#sku-…` into a href (server side, beside the service-role client) and
 * the row editor stamps the same id onto its element (a `'use client'`
 * component). Keeping the helper next to the database reader would have pulled
 * `createAdminClient` into the browser bundle — caught here before shipping, and
 * `lint-server-only-boundary.mjs` would have caught it after.
 *
 * 🪤 AND THE POINT OF SHARING IT AT ALL: a href written in one file and an `id`
 * typed in another is the two-hand-typed-things failure this repo keeps paying
 * for, with the quietest symptom of the family — the link works, the page opens,
 * and it simply does not scroll to anything.
 */
export function skuAnchorId(serviceCode: string): string {
  return `sku-${serviceCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * One price row of the ⌘K box — what `fetchAdminRows` builds for each `platform_retail_catalog_v2` row. Pure and here
 * (beside the anchor it uses) so the box's guards build the SAME row the box gets ("change the price of live watch" →
 * Pricing at Live Watch is pinned against this, not against a hand-typed copy).
 */
export function priceRowFor(r: { service_code: unknown; title?: unknown; is_active?: unknown }): {
  label: string;
  href: string;
  hay: string;
  hint: string;
} {
  const code = String(r.service_code);
  const title = String(r.title ?? code);
  const active = r.is_active === true;
  return {
    label: title,
    href: `/admin/pricing?tab=pricing#${skuAnchorId(code)}`,
    hay: `${title} ${code} ${code.replace(/_/g, ' ')} price prices`.toLowerCase(),
    hint: active ? 'price' : 'price · off sale',
  };
}
