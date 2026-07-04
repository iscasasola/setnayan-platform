import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchCustomUnitPrices } from '@/lib/vendor-custom-catalog';
import type {
  CustomComposition,
  CustomDiscount,
} from '@/lib/vendor-custom-pricing';
import {
  CustomComposer,
  type VendorOption,
  type LoadedPlan,
} from './_components/custom-composer';

export const metadata = { title: 'Custom plans · Admin' };

type Props = { searchParams: Promise<{ vendor?: string }> };

/**
 * /admin/custom-plans — HQ Custom-tier composer (VENDOR_TIERS_AND_BENEFITS.md §11).
 *
 * The admin picks any vendor org, dials the SAME 7 composition knobs the vendor
 * configurator exposes (branches · reach±nationwide · seats · slots · photos ·
 * tokens · domain), optionally overrides the 9 unit prices FOR THIS QUOTE ONLY
 * (the persistent catalog stays authoritative at /admin/pricing), and applies a
 * partner discount. A composition-first preview shows what the vendor GETS in
 * plain words, then the price block. "Send quote" upserts the vendor_custom_plans
 * row + opens the apply-then-pay order so it lands in /admin/payments; approving
 * that payment provisions the Custom tier (lib/sku-activation.ts, service key
 * vendor_custom_plan__{id}). An explicit "Mark active" lever provisions comp /
 * off-platform-settled deals without the payment round-trip.
 *
 * Unit prices are read SERVER-SIDE from the admin-managed vendor_billing_catalog
 * so a price edit flows through with no code change; the composer only overrides
 * them in-memory for the preview + the (server-recomputed) quote.
 */
export default async function AdminCustomPlansPage({ searchParams }: Props) {
  const { vendor: selectedVendorId = null } = await searchParams;
  const admin = createAdminClient();

  // Vendor orgs (claimed) + their tier, and the live catalog unit prices.
  const [vendorRes, catalogPrices] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, tier_state')
      .not('user_id', 'is', null)
      .order('business_name', { ascending: true })
      .limit(500),
    fetchCustomUnitPrices(admin),
  ]);
  if (vendorRes.error) logQueryError('AdminCustomPlansPage (vendors)', vendorRes.error);

  const vendors: VendorOption[] = (
    (vendorRes.data ?? []) as Array<{
      vendor_profile_id: string;
      business_name: string | null;
      tier_state: string | null;
    }>
  ).map((v) => ({
    id: v.vendor_profile_id,
    name: v.business_name ?? '(unnamed vendor)',
    tier: v.tier_state ?? null,
  }));

  // Load the selected org's newest non-terminal plan (draft/quoted/pending/active).
  let loadedPlan: LoadedPlan = null;
  if (selectedVendorId) {
    const { data: plan } = await admin
      .from('vendor_custom_plans')
      .select('custom_plan_id, composition, discount_type, discount_value, quoted_28d_php, status')
      .eq('vendor_profile_id', selectedVendorId)
      .in('status', ['draft', 'quoted', 'pending_payment', 'active'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (plan) {
      const row = plan as {
        custom_plan_id: string;
        composition: CustomComposition | null;
        discount_type: 'amount' | 'percent' | null;
        discount_value: number | string | null;
        quoted_28d_php: number | string | null;
        status: string;
      };
      const discount: CustomDiscount | null =
        row.discount_type && row.discount_value != null && Number(row.discount_value) > 0
          ? { type: row.discount_type, value: Number(row.discount_value) }
          : null;
      loadedPlan = {
        planId: row.custom_plan_id,
        composition: (row.composition ?? {}) as CustomComposition,
        discount,
        status: row.status,
        quoted28: row.quoted_28d_php != null ? Number(row.quoted_28d_php) : null,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Custom plans</h1>
        <p className="max-w-2xl text-sm text-ink/60">
          Compose a negotiated Custom tier for any vendor org — the SETNAYAN
          rate card, scoped to one partner, with a discount and a
          composition-first quote you send for apply-then-pay approval. Unit
          prices are read live from{' '}
          <Link href="/admin/pricing" className="underline underline-offset-2">
            /admin/pricing
          </Link>
          ; overrides here are per-quote only.
        </p>
      </header>

      <CustomComposer
        vendors={vendors}
        selectedVendorId={selectedVendorId}
        catalogPrices={catalogPrices}
        loadedPlan={loadedPlan}
      />
    </div>
  );
}
