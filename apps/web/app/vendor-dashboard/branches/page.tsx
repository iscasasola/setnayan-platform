import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/branches — RETIRED 2026-07-16.
 *
 * Branch management (add / renew / cancel) is the shared <BranchManager>, which
 * already renders INLINE on My Shop's Branch tile (ManageTiles + Collapsible).
 * This standalone route rendered the same component on a second live URL — and
 * its header + EnterpriseGate said "Enterprise" twice for non-Enterprise
 * vendors. It now redirects to My Shop (mirroring /profile → /shop, 2026-07-05),
 * where the Branch tile is the single branch surface. Old bookmarks / deep-links
 * land there; incoming query params are preserved.
 */
export default async function VendorBranchesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const query = qs.toString();
  redirect(`/vendor-dashboard/shop${query ? `?${query}` : ''}`);
}
