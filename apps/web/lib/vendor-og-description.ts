import { displayServiceLabel } from '@/lib/vendors';

/**
 * lib/vendor-og-description.ts — the "what they do · city" line on a shop's share card (`app/api/og/v/[slug]/route.tsx`,
 * `lib/social/vendor-card.tsx`).
 *
 * Shop share card v2 (owner, 21 Nov 2026; DECISION_LOG "SHOP SHARE CARD v2 — APPROVED TO BUILD"): the card keeps the
 * "category · city" half of the old descriptive line and drops the rest —
 *   · the tagline branch: the tagline still shows as the text UNDER the picture (the page's og:description);
 *   · the word "Verified": the seal on the logo and the top line say it now (drawing "Removes").
 *
 * Pure (no `server-only`, no SDK) so it is node:test-able. Each part only when it is true — never a fabricated
 * placeholder (row-3838): no service and no city is NO line (null), and the card leaves the line out.
 */
export function composeVendorTradeLine(vendor: {
  services: readonly string[] | null | undefined;
  location_city: string | null;
}): string | null {
  const category = vendor.services?.[0] ? displayServiceLabel(vendor.services[0]) : null;
  const city = vendor.location_city?.trim() || null;
  const parts = [category, city].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' · ') : null;
}
