import { displayServiceLabel } from '@/lib/vendors';

/**
 * lib/vendor-og-description.ts — the one descriptive line on a shop's share
 * card (`app/api/og/v/[slug]/route.tsx`, E1 "a shop's link preview never
 * breaks").
 *
 * Pure (no `server-only`, no SDK) so it is directly node:test-able — split out
 * per the house rule that `server-only` is not installed for node:test and a
 * route file pulling in `next/server` should not be the only place this logic
 * lives.
 *
 * The shop's own tagline when it has one; otherwise "category · city ·
 * Verified" — each part present only when it is actually true. Never a
 * fabricated placeholder: this is the same row-3838 house rule ("never a
 * stock photo, a zero, or an empty chart") D2 already enforces on the public
 * page itself.
 */
export function composeVendorOgDescription(vendor: {
  tagline: string | null;
  services: readonly string[] | null | undefined;
  location_city: string | null;
  verification_state?: string | null;
}): string {
  const tagline = vendor.tagline?.trim();
  if (tagline) return tagline;
  const category = vendor.services?.[0] ? displayServiceLabel(vendor.services[0]) : null;
  const city = vendor.location_city?.trim() || null;
  const parts = [category, city].filter((p): p is string => Boolean(p));
  if (vendor.verification_state === 'verified') parts.push('Verified');
  return parts.length > 0 ? parts.join(' · ') : 'A Setnayan shop.';
}
