import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import PaymentOptionsSurface from '../payment-options/surface';
import { BranchPanel } from '../shop/_components/branch-panel';
import { loadDetailsData } from './details-data';
import { DetailsScreen } from './_components/details-screen';

export const metadata = { title: 'Your details' };

/**
 * /vendor-dashboard/profile — YOUR DETAILS (simpler supplier dashboard step 5, 2026-10-14).
 *
 * ⏮ RETIRED 2026-07-05, BACK 2026-10-14. It became a redirect into My Shop when the identity fields and the media
 * editors moved onto Shop's tiles. The approved prototype (moment 6) gives the details their own list again —
 * profile picture › Your details, or Shop › Page › the first row — so this address is that list. The editors are the
 * same ones the tiles held (see `details-screen.tsx`); the old `?saved=1` / `?error=` / `?msg=` targets that still
 * point here land on it, and `/verify` (`#docs`), `/payment-options` (`#pay`) and `/branches` (`#where`) forward
 * into its folds.
 */
export default async function YourDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // No shop resolved (or the read failed): back to the dashboard, whose layout tells the two apart — never to
  // /open-shop on a read that might simply have failed (`the-open-shop-redirect-is-a-proven-absence`).
  if (!profile) redirect('/vendor-dashboard');

  const d = await loadDetailsData(supabase, profile);

  return (
    <DetailsScreen
      d={d}
      payBody={<PaymentOptionsSurface searchParams={searchParams} embedded preloaded={d.pay} />}
      branchBody={<BranchPanel {...d.branch} />}
    />
  );
}
