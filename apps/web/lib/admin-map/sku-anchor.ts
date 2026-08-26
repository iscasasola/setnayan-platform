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
