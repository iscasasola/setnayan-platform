import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, resolveVendorStanding, canManageVendor } from '@/lib/vendor-role';
import { RoleLock } from '@/app/vendor-dashboard/_components/role-lock';
import { canSeeTheftWatch } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VendorTierGate } from '../_components/tier-gate';
import { fetchVendorReposts } from '@/lib/vendor-theft-watch';
import { TheftWatchView } from './_components/theft-watch-view';

export const metadata = { title: 'Theft Watch · Supplier' };

export default async function VendorTheftWatchPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const role = await resolveVendorRole(supabase, user.id);
  // 🔒 A role that does not open the shop's numbers is TOLD so — Problem and Solution — never bounced in silence.
  if (!canManageVendor(role)) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:px-6" data-role-locked-page="insights">
        <h1 className="sn-h1">Theft Watch</h1>
        <RoleLock duty={(await resolveVendorStanding(supabase, user.id).catch(() => null))?.duty ?? null} capability="insights" className="mt-4" />
      </section>
    );
  }

  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  if (isVendorFeatureGateEnabled() && !canSeeTheftWatch(tier)) {
    return (
      <VendorTierGate
        feature="Theft Watch"
        requiredTier="pro"
        blurb="We fingerprint every photo you upload and scan the marketplace for copies, flagging reposts as yours. Portfolio protection is a Pro feature."
        icon={<ShieldAlert aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  // null = the read did not run (refused, or no key) — said as such, never as a clean result (controller 21 Nov).
  const reposts = await fetchVendorReposts(profile.vendor_profile_id);

  return <TheftWatchView reposts={reposts} />;
}
