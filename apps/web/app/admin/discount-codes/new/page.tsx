/**
 * /admin/discount-codes/new — create a new voucher code.
 *
 * WHY · Day 1.5 spec-aligned per CLAUDE.md 2026-05-29 Day 1.5 row.
 *       Initial state defaults to 'pct_off' (most common 3-type case) ·
 *       both pct_value + cap_centavos null on create.
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { VoucherForm, type VoucherFormInitial } from '../_components/voucher-form';
import { createDiscountCode } from '../actions';
import { fetchV2CustomerCatalog, fetchV2BundleCatalog, fetchV2VendorCatalog } from '@/lib/v2-catalog';

export const metadata = { title: 'New discount code · Admin' };

type ServiceRow = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
};

export default async function NewDiscountCodePage() {
  // Source: V2 customer catalog + bundle catalog + vendor catalog. Per owner
  // 2026-05-29 follow-up after #598: vendor SKUs (Pro Vendor monthly/annual,
  // Enterprise, verification renewal, token packs) should also be voucherable
  // even though vendor checkout UI itself is V1.x post-pilot — admin can
  // create the codes now; they activate when vendor billing surfaces ship.
  // Customer + bundle from #598 stay. Vendor SKUs added here.
  const [customers, bundles, vendors] = await Promise.all([
    fetchV2CustomerCatalog(),
    fetchV2BundleCatalog(),
    fetchV2VendorCatalog(),
  ]);

  // Map V2 shape onto the existing ServiceRow contract the form expects.
  // Pricing held in pesos in V2 (retail_price_php / price_php NUMERIC) —
  // convert to centavos for the form display layer. Category derived from
  // origin table: customers → 'Customer service' · bundles → 'Bundle' ·
  // vendor subs → 'Vendor subscription' · vendor token packs → 'Vendor tokens'.
  const services: ServiceRow[] = [
    ...customers.map((c) => ({
      sku_code: c.service_code,
      display_name: c.title,
      category: 'Customer service',
      price_centavos: Math.round(c.retail_price_php * 100),
    })),
    ...bundles.map((b) => ({
      sku_code: b.package_code,
      display_name: b.title,
      category: 'Bundle',
      price_centavos: Math.round(b.retail_price_php * 100),
    })),
    ...vendors.map((v) => ({
      sku_code: v.sku_code,
      display_name: v.title,
      category:
        v.offering_type === 'subscription_monthly'
          ? 'Vendor subscription'
          : 'Vendor tokens',
      price_centavos: Math.round(v.price_php * 100),
    })),
  ].sort((a, b) =>
    a.category === b.category
      ? a.display_name.localeCompare(b.display_name)
      : a.category.localeCompare(b.category),
  );

  const initial: VoucherFormInitial = {
    discount_code_id: null,
    code: '',
    // Day 1.5 default: 'pct_off' (simplest case, no cap input shown).
    // Admin flips to pct_off_capped or free or grant_tokens via radio.
    discount_type: 'pct_off',
    pct_value: null,
    cap_centavos: null,
    // grant_tokens initial state: NULL on create. Form defaults TTL display
    // to 45 days when the admin flips the radio (matches founder-bonus
    // convention from migration 20260703500000 PART 4).
    token_grant_count: null,
    token_grant_ttl_days: null,
    covered_service_keys: [],
    effective_from: null,
    expires_at: null,
    max_uses: null,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb back to list */}
      <Link
        href="/admin/discount-codes"
        className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
        style={{ color: 'var(--m-slate)' }}
      >
        <ChevronLeft className="h-4 w-4" />
        All codes
      </Link>

      <div>
        <h1
          className="m-display-tight text-3xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Create discount code
        </h1>
        <p
          className="mt-1 max-w-2xl text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          Couples paste the code at checkout to unlock the special price.
          Effective-until is required so codes can&apos;t hang around forever.
        </p>
      </div>

      <VoucherForm
        initial={initial}
        services={services}
        action={createDiscountCode}
        submitLabel="Create code"
        submitPendingLabel="Creating…"
      />
    </div>
  );
}
