import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { asVendorTier } from '@/lib/vendor-tier-caps';
import { fetchCustomUnitPrices } from '@/lib/vendor-custom-catalog';
import type { CustomComposition } from '@/lib/vendor-custom-pricing';
import { CustomConfigurator } from './_components/custom-configurator';

/**
 * /vendor-dashboard/subscription/custom — "Compose a Custom plan" (owner's
 * "custom button on subscription" · VENDOR_TIERS_AND_BENEFITS.md §11 · PR-B).
 *
 * The 9 per-unit prices are read SERVER-SIDE from the admin-managed catalog
 * (lib/vendor-custom-catalog → vendor_billing_catalog) and passed to the client
 * configurator as a plain object, so a price edit at /admin/pricing flows through
 * with no code change. The client computes the live quote with the SAME pricing
 * lib the submit re-prices from (lib/vendor-custom-pricing). Discount is
 * admin-only (PR-C) — the vendor always composes at LIST price.
 *
 * If the vendor already runs Custom with an ACTIVE plan, we show that composition
 * read-only with an "Adjust" affordance that composes a NEW pending plan.
 */

export const metadata = { title: 'Compose a Custom plan · Vendor' };

type Props = {
  searchParams: Promise<{ requested?: string; error?: string }>;
};

const NUMBER = new Intl.NumberFormat('en-PH');

export default async function VendorCustomPlanPage({ searchParams }: Props) {
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Soft-probe tier + verification (not in the shared profile select).
  const { data: vRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const currentTier = asVendorTier(
    (vRow as { tier_state?: string | null } | null)?.tier_state,
  );
  const isVerified =
    (vRow as { verification_state?: string | null } | null)?.verification_state ===
    'verified';

  const [unitPrices, settings] = await Promise.all([
    fetchCustomUnitPrices(supabase),
    fetchPlatformSettings(supabase),
  ]);

  // If the vendor already runs Custom, load their ACTIVE composition (read-only
  // + "Adjust"). Soft: any read failure just shows the fresh composer.
  let activeComposition: CustomComposition | null = null;
  if (currentTier === 'custom') {
    const { data: activeRow } = await supabase
      .from('vendor_custom_plans')
      .select('composition')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('status', 'active')
      .maybeSingle();
    activeComposition =
      (activeRow as { composition?: CustomComposition | null } | null)?.composition ??
      null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/vendor-dashboard/subscription"
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        Plans &amp; tokens
      </Link>

      <header className="mb-6 mt-3 sm:mb-8">
        <p className="sn-eye">Beyond Enterprise</p>
        <h1 className="sn-h1 mt-1 flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-orange" strokeWidth={1.75} aria-hidden />
          Compose a Custom plan.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Everything in Enterprise plus white-glove support, then dial in exactly
          the branches, reach, seats, listings, photos and tokens your business
          needs. Custom starts at{' '}
          <span className="font-semibold text-ink">
            ₱{NUMBER.format(unitPrices.base)}
          </span>{' '}
          per 28 days.
        </p>
      </header>

      {search.requested && (
        <div className="mb-6 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
          ✓ Request sent — the SETNAYAN team reviews your composition and sends
          payment instructions. Nothing is charged until you approve. Your
          reference is{' '}
          <span className="font-mono font-semibold">{search.requested}</span>.
        </div>
      )}
      {search.error && (
        <div className="mb-6 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-900">
          {search.error}
        </div>
      )}

      <CustomConfigurator
        unitPrices={unitPrices}
        canRequest={isVerified}
        activeComposition={activeComposition}
        pay={{
          bdoName: settings.bdo_account_name,
          bdoNumber: settings.bdo_account_number,
          gcashName: settings.gcash_account_name,
          gcashNumber: settings.gcash_number,
        }}
      />
    </main>
  );
}
