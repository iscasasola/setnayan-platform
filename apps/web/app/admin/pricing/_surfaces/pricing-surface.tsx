// Money-split studio surface — the body of the former pricing page,
// re-homed here (2026-07-10). actions/_components stay in /admin/pricing; the
// legacy route is now a redirect (or, for pricing/settings, the studio shell).
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';
import { saveOnboardingDiscount, saveFeeSetting } from '@/app/admin/pricing/actions';
import { computeRetailRemovabilityMap } from '@/lib/admin/pricing-removability';
import { fetchPricingAuditHistory } from '@/lib/admin/pricing-audit-history';
import {
  PriceCatalogBrowser,
  type PriceRowProp,
  type RetailRowProp,
  type BundleRowProp,
  type VendorRowProp,
} from '@/app/admin/pricing/_components/catalog-editor';
import { FeeForm } from '@/app/admin/pricing/_components/fee-form';
import { SetupDiscountForm } from '@/app/admin/pricing/_components/setup-discount-form';
import { readOnboardingDiscountPct } from '@/lib/onboarding-discount';
import { LegacyCatalogDisclosure } from '@/app/admin/pricing/_components/legacy-catalog';

import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * /admin/pricing — the price catalog browser (2026-08-26 rebuild).
 *
 * Ported from WHATS_NEXT_Managing_Prices_2026-08-26.md § 6 /
 * prototypes/admin_pricing_manager_2026-08-26.html's "What we recommend"
 * pane. REPLACES the single-form "Save all changes" bulk editor — see
 * catalog-editor.tsx's docblock for why that shape was the description-
 * blanking bug, not just its symptom.
 *
 * This server component does exactly the data work: fetch every row across
 * the three catalogue tables, compute which retired customer rows are
 * measurably safe to remove (never trusting a stale render), pull each row's
 * saved-from-this-screen history out of `admin_audit_log`, then hand it all
 * to the one client browser component that owns search/view/scope state.
 *
 * Canonical V2 tables: platform_retail_catalog_v2 · platform_package_catalog
 * · vendor_billing_catalog · platform_settings.setnayan_pay_fee_pct.
 */

type RetailRow = {
  service_code: string;
  title: string;
  description: string | null;
  retail_price_php: number;
  saas_overhead_cost_php: number;
  is_active: boolean;
  onboarding_price_php: number | null;
  billing_period: string;
  is_pax_priced: boolean;
  pax_floor: number | null;
  pax_floor_price_php: number | null;
  pax_increment_size: number | null;
  pax_increment_price_php: number | null;
  retired_at: string | null;
  retirement_reason: string | null;
  replaced_by_service_code: string | null;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type BundleRow = {
  package_code: string;
  title: string;
  description: string | null;
  retail_price_php: number;
  is_active: boolean;
  retired_at: string | null;
  retirement_reason: string | null;
  replaced_by_package_code: string | null;
  updated_at: string;
  updated_by_admin_id: string | null;
};

type VendorRow = {
  sku_code: string;
  title: string;
  description: string | null;
  price_php: number;
  offering_type: 'subscription_monthly' | 'subscription_annual' | 'token_pack';
  is_active: boolean;
  retired_at: string | null;
  retirement_reason: string | null;
  replaced_by_sku_code: string | null;
  updated_at: string;
};

type Props = {
  searchParams: Promise<{
    saved?: string;
    skipped?: string;
    error?: string;
  }>;
};

const VENDOR_OFFERING_LABEL: Record<VendorRow['offering_type'], string> = {
  subscription_monthly: 'Subscription · monthly',
  subscription_annual: 'Subscription · annual',
  token_pack: 'Token pack',
};

export async function PricingSurface(_props: Props) {
  await requireAdmin();

  const admin = createAdminClient();

  const [retailRes, bundleRes, vendorRes, settingsRes] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select(
        'service_code,title,description,retail_price_php,saas_overhead_cost_php,is_active,onboarding_price_php,billing_period,is_pax_priced,pax_floor,pax_floor_price_php,pax_increment_size,pax_increment_price_php,retired_at,retirement_reason,replaced_by_service_code,updated_at,updated_by_admin_id',
      )
      .order('is_active', { ascending: false })
      .order('retail_price_php', { ascending: true }),
    admin
      .from('platform_package_catalog')
      .select(
        'package_code,title,description,retail_price_php,is_active,retired_at,retirement_reason,replaced_by_package_code,updated_at,updated_by_admin_id',
      )
      .order('is_active', { ascending: false })
      .order('retail_price_php', { ascending: true }),
    admin
      .from('vendor_billing_catalog')
      .select(
        'sku_code,title,description,price_php,offering_type,is_active,retired_at,retirement_reason,replaced_by_sku_code,updated_at',
      )
      .order('is_active', { ascending: false })
      .order('display_order', { ascending: true }),
    admin
      .from('platform_settings')
      .select('setnayan_pay_fee_pct, onboarding_discount_pct')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  if (retailRes.error) logQueryError('AdminPricingPage (retail)', retailRes.error);
  if (bundleRes.error) logQueryError('AdminPricingPage (bundle)', bundleRes.error);
  if (vendorRes.error) logQueryError('AdminPricingPage (vendor)', vendorRes.error);
  if (settingsRes.error) logQueryError('AdminPricingPage (settings)', settingsRes.error);

  const retailRows = (retailRes.data ?? []) as RetailRow[];
  const bundleRows = (bundleRes.data ?? []) as BundleRow[];
  const vendorRows = (vendorRes.data ?? []) as VendorRow[];

  const settingsFee = settingsRes.data?.setnayan_pay_fee_pct;
  const feeIsFromDb = settingsFee != null && Number.isFinite(Number(settingsFee));
  const feePct = feeIsFromDb ? Number(settingsFee) : SETNAYAN_PAY_FEE_PCT;
  // The house set-up discount. Owner 2026-08-28 — editable at any moment, so it
  // is READ here every time rather than baked into any catalog row.
  const storedDiscount = settingsRes.data?.onboarding_discount_pct;
  const discountIsFromDb = storedDiscount != null && Number.isFinite(Number(storedDiscount));
  const discountPct = readOnboardingDiscountPct(storedDiscount);

  const retiredRetailCodes = retailRows.filter((r) => !r.is_active).map((r) => r.service_code);
  const allCodes = [
    ...retailRows.map((r) => r.service_code),
    ...bundleRows.map((r) => r.package_code),
    ...vendorRows.map((r) => r.sku_code),
  ];

  const [removability, history] = await Promise.all([
    computeRetailRemovabilityMap(admin, retiredRetailCodes),
    fetchPricingAuditHistory(admin, allCodes),
  ]);

  const rows: PriceRowProp[] = [
    ...retailRows.map((r): RetailRowProp => {
      const rm = !r.is_active ? removability.get(r.service_code) ?? null : null;
      return {
        kind: 'retail',
        code: r.service_code,
        title: r.title,
        description: r.description,
        price: Number(r.retail_price_php),
        cost: Number(r.saas_overhead_cost_php),
        isActive: r.is_active,
        onboardingPrice: r.onboarding_price_php != null ? Number(r.onboarding_price_php) : null,
        billingPeriod: r.billing_period,
        isPaxPriced: r.is_pax_priced,
        paxFloor: r.pax_floor,
        paxFloorPrice: r.pax_floor_price_php != null ? Number(r.pax_floor_price_php) : null,
        paxIncrementSize: r.pax_increment_size,
        paxIncrementPrice: r.pax_increment_price_php != null ? Number(r.pax_increment_price_php) : null,
        retiredAt: r.retired_at,
        retirementReason: r.retirement_reason,
        replacedByCode: r.replaced_by_service_code,
        editedAgo: timeAgoLabel(r.updated_at),
        removability: rm
          ? { safeToRemove: rm.safeToRemove, reasons: rm.reasons, papicConfigPointer: rm.papicConfigPointer }
          : null,
        history: history.get(r.service_code) ?? [],
      };
    }),
    ...bundleRows.map(
      (r): BundleRowProp => ({
        kind: 'bundle',
        code: r.package_code,
        title: r.title,
        description: r.description,
        price: Number(r.retail_price_php),
        isActive: r.is_active,
        retiredAt: r.retired_at,
        retirementReason: r.retirement_reason,
        replacedByCode: r.replaced_by_package_code,
        editedAgo: timeAgoLabel(r.updated_at),
        history: history.get(r.package_code) ?? [],
      }),
    ),
    ...vendorRows.map(
      (r): VendorRowProp => ({
        kind: 'vendor',
        code: r.sku_code,
        title: r.title,
        description: r.description,
        price: Number(r.price_php),
        offeringLabel: VENDOR_OFFERING_LABEL[r.offering_type],
        isActive: r.is_active,
        retiredAt: r.retired_at,
        retirementReason: r.retirement_reason,
        replacedByCode: r.replaced_by_sku_code,
        editedAgo: timeAgoLabel(r.updated_at),
        history: history.get(r.sku_code) ?? [],
      }),
    ),
  ];

  const retailTitlesForReplacement: [string, string][] = retailRows
    .filter((r) => r.is_active)
    .map((r) => [r.service_code, r.title]);

  return (
    <div>
      {/* The tab strip already says "Pricing". The name stays in the document
          at zero pixels (owner-locked 2026-08-21 — every admin page "starts
          straight at its content"; no eyebrow, no lede, no back chevron) but
          the download link beside it does NOT go with it — `HELD_IN_THE_OLD_
          HEADER` in admin-page-starts-at-its-content.test.ts pins this as the
          ONLY export path for the legacy v1 `service_catalog`. */}
      <PageMasthead
        title="Pricing & Catalog"
        className="mb-4"
        actions={
          <a
            href="/admin/addons/pricing-report"
            className="button-secondary self-start whitespace-nowrap text-sm"
            download
          >
            Download legacy catalog report
          </a>
        }
      />

      {(retailRes.error || bundleRes.error || vendorRes.error) && (
        <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger-900">Catalog load error</p>
          <p className="mt-1 text-sm text-danger-900">
            The pricing catalog couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment.
          </p>
        </div>
      )}

      <PriceCatalogBrowser rows={rows} retailTitlesForReplacement={retailTitlesForReplacement} />

      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">Set-up discount</h2>
        <p className="mb-3 text-sm text-ink/60">
          How much off anything a customer buys while they are still setting up their
          celebration. Order the same thing afterwards and they pay the normal price.
          One number — every set-up price on the platform follows it.
        </p>
        <SetupDiscountForm
          action={saveOnboardingDiscount}
          discountPct={discountPct}
          isFromDb={discountIsFromDb}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight">Platform fee</h2>
        <p className="mb-3 text-sm text-ink/60">
          Setnayan Pay convenience fee added to a customer invoice when they pay a vendor booking
          through Setnayan. The vendor still receives the full booking amount — the fee is the
          customer&apos;s cost. Code constant {SETNAYAN_PAY_FEE_PCT}% is the fallback.
        </p>
        <FeeForm action={saveFeeSetting} feePct={feePct} feeIsFromDb={feeIsFromDb} />
      </section>

      <section className="mt-10">
        <LegacyCatalogDisclosure />
      </section>
    </div>
  );
}

function timeAgoLabel(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  return `${Math.floor(d / 365)} year${Math.floor(d / 365) === 1 ? '' : 's'} ago`;
}
