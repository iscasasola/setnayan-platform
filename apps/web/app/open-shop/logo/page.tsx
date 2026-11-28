
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { readLogoFrame } from '@/lib/open-shop-logo';
import { AddYourLogo } from './_components/add-your-logo';
import { planOfferPath } from '@/lib/supplier-plan-offer';
import { gateOpenShopLogo } from './gate';

/**
 * /open-shop/logo — "Add your logo", the screen RIGHT AFTER "Open my shop" (owner, the 2026-11-06 gate walk, A2).
 *
 * The logo used to sit on step 1, where a signed-out person could not upload it at all ("You must be signed in to
 * upload") — owner: *"if it does not want to upload, then it has no use here"*. Here the shop exists and the person
 * is signed in, so the upload works: a round preview, the Event Hub Maker photo control (9-point align + zoom
 * 100 / 120 / 150) and Skip. Skipped → Today, where "Add your logo" stays a first step until it is done.
 *
 * Saves through My Shop's own logo save (`updateVendorProfileField`, field `logo`) — one writer for one column.
 */
export const metadata = { title: 'Add your logo' };

export default async function OpenShopLogoPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // W1-B21: the plan a supplier picked on /for-suppliers rides through to its offer.
  const offer = planOfferPath((await searchParams).plan);
  // Sign-in, "no shop" and "no name yet" were decided by ./layout.tsx before streaming; same request, same answer.
  const { row } = await gateOpenShopLogo();

  // A presign hiccup is a missing thumbnail, never a 500 (the same rule as /open-shop's logo read).
  let displayUrl: string | null = null;
  if (row.logo_url) {
    try {
      displayUrl = await displayUrlForStoredAsset(row.logo_url);
    } catch {
      displayUrl = null;
    }
  }

  return (
    <AddYourLogo
      vendorProfileId={row.vendor_profile_id}
      shopName={row.business_name!.trim()}
      storedLogoRef={row.logo_url}
      displayUrl={displayUrl}
      frame={readLogoFrame(row)}
      doneHref={offer ?? '/vendor-dashboard'}
    />
  );
}
