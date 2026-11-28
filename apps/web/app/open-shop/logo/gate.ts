import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveOwnedActiveShop } from '@/lib/active-shop';

/**
 * Every answer "Add your logo" gives that is not the screen — sign in, no active shop, a shop with no name yet —
 * decided by `./layout.tsx` BEFORE `./loading.tsx` streams, so each stays a 307 instead of a 200, a skeleton and a
 * client hop. `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateOpenShopLogo = cache(async () => {
  const supabase = await createClient();
  const user = await getCurrentUser();
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
  return { row };
});
