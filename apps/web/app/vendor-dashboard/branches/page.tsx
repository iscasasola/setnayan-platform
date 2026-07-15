import { redirect } from 'next/navigation';
import { Building2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import {
  fetchVendorBranches,
  fetchBranchFeePhp,
  branchAutoRadiusKm,
  BRANCH_FEE_PHP,
  BRANCH_PERIOD_DAYS,
} from '@/lib/vendor-branches';
import { BranchManager, type PayInfo } from '../_components/branch-manager';

export const metadata = { title: 'Branches · Vendor' };

function peso(n: number): string {
  return '₱' + n.toLocaleString('en-PH');
}

export default async function VendorBranchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // owner/admin only — agents/viewers never see this surface.
  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  // Enterprise-only (owner-locked 2026-06-05). tier_state isn't in the shared
  // profile select, so soft-probe it.
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    tier = (data as { tier_state?: string } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }
  // Enterprise-or-higher (Custom runs as Enterprise) may manage branches —
  // rank-derived so Custom inherits without a hard equality. The branches
  // server action (branches/actions.ts) gates on the same isTierAtLeast, so the
  // page gate and the action stay consistent for Custom vendors.
  const isEnterprise = isTierAtLeast(tier, 'enterprise');

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Building2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Branches</h1>
        <p className="max-w-prose text-base text-ink/65">
          Run more than one location? Add a branch sub-account so each site has its
          own service area. Each branch is{' '}
          <span className="font-medium text-ink">
            {peso(BRANCH_FEE_PHP)} every {BRANCH_PERIOD_DAYS} days
          </span>{' '}
          and is available on the <span className="font-medium text-ink">Enterprise</span> plan.
        </p>
      </header>

      {!isEnterprise ? (
        <EnterpriseGate />
      ) : (
        <EnterpriseBody supabase={supabase} vendorProfileId={profile.vendor_profile_id} hqLat={profile.hq_latitude ?? null} hqLng={profile.hq_longitude ?? null} />
      )}
    </section>
  );
}

function EnterpriseGate() {
  return (
    <div className="sn-tile p-8 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink/5 text-ink/50">
        <Lock aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <h2 className="text-lg font-semibold text-ink">Branches are an Enterprise feature</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">
        Upgrade your business to the Enterprise plan to add branch sub-accounts —
        each with its own city and service area. Talk to the Setnayan team to switch
        your plan, then come back here to add your first branch.
      </p>
    </div>
  );
}

async function EnterpriseBody({
  supabase,
  vendorProfileId,
  hqLat,
  hqLng,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  vendorProfileId: string;
  hqLat: number | null;
  hqLng: number | null;
}) {
  const [branches, settings, feePhp] = await Promise.all([
    fetchVendorBranches(supabase, vendorProfileId),
    fetchPlatformSettings(supabase).catch(() => null),
    fetchBranchFeePhp(supabase).catch(() => BRANCH_FEE_PHP),
  ]);

  const pay: PayInfo = {
    bdoName: settings?.bdo_account_name ?? null,
    bdoNumber: settings?.bdo_account_number ?? null,
    gcashName: settings?.gcash_account_name ?? null,
    gcashNumber: settings?.gcash_number ?? null,
  };

  // Pin map opens on the HQ, or Metro Manila as a national fallback.
  const initialCenter =
    hqLat !== null && hqLng !== null
      ? { lat: hqLat, lng: hqLng }
      : { lat: 14.5995, lng: 120.9842 };

  return (
    <BranchManager
      branches={branches}
      feePhp={feePhp}
      autoRadiusKm={branchAutoRadiusKm()}
      initialCenter={initialCenter}
      pay={pay}
    />
  );
}
