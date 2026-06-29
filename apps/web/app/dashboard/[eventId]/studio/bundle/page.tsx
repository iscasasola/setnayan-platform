import { notFound } from 'next/navigation';

export const metadata = { title: 'Wedding Bundle · Setnayan' };

/**
 * /dashboard/[eventId]/studio/bundle?code=GUIDED_PACK|MEDIA_PACK
 *
 * RETIRED 2026-06-29 (owner "no more essentials and complete"). The Essentials
 * (GUIDED_PACK) + Complete (MEDIA_PACK) bundles are deactivated (is_active=false)
 * and the onboarding bundle screen that used to route here has been dropped from
 * the flow, so nothing links here anymore.
 *
 * The route is KEPT (not deleted) so the build never breaks and any stale or
 * hand-typed link (e.g. ?code=GUIDED_PACK) degrades cleanly to a 404 instead of
 * rendering a checkout drawer for an unbuyable bundle. The pricing model is now
 * Free → Setnayan AI → à-la-carte SKUs — no packaged bundles.
 *
 * (Historical: this was the server-side checkout landing for the onboarding-only
 *  bundle offer — price resolved from platform_package_catalog via
 *  fetchV2BundleCatalog(), which now returns [] for the deactivated bundles.)
 */

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ code?: string }>;
};

export default async function BundleCheckoutPage(_props: Props) {
  // Permanently unbuyable — bundles retired. Always 404.
  notFound();
}
