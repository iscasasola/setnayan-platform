import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { readLogoFrame } from '@/lib/open-shop-logo';
import { resolveOwnedActiveShop } from '@/lib/active-shop';
import { AddYourLogo } from './_components/add-your-logo';

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

export default async function OpenShopLogoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fopen-shop%2Flogo&as=vendor');

  // 🔀 THE SHOP THIS SCREEN SAVES TO is the one `updateVendorProfileField` writes: the ACTIVE shop, owner-only
  // (`resolveOwnedActiveShop`, lib/active-shop.ts) — never a second "find my shop by user id" here.
  const shop = await resolveOwnedActiveShop(supabase, user.id);
  if (!shop.ok) redirect('/open-shop');
  // The shop's own definer view (never the table — see app/open-shop/page.tsx). A refused read is not "no shop".
  const { data, error } = await supabase
    .from('vendor_profiles_self')
    .select('vendor_profile_id, business_name, logo_url, logo_focal_x, logo_focal_y, logo_zoom')
    .eq('vendor_profile_id', shop.vendorProfileId)
    .maybeSingle();
  if (error) throw new Error(`open-shop/logo: could not read your shop (${error.message})`);
  const row = data as {
    vendor_profile_id: string;
    business_name: string | null;
    logo_url: string | null;
    logo_focal_x: number | null;
    logo_focal_y: number | null;
    logo_zoom: number | null;
  } | null;
  // No named shop yet → the wizard is the next step, not this one.
  if (!row?.business_name?.trim()) redirect('/open-shop');

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
    />
  );
}
