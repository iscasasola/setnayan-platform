/**
 * /admin/discount-codes/new — create a new voucher code.
 *
 * WHY · Day 1 voucher system per CLAUDE.md 2026-05-29 Day 1 row.
 *       Sub-route off the list page (reached via [Create code] CTA).
 *       Reuses the shared VoucherForm with empty `initial` shape so the
 *       form renders a blank create surface.
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { VoucherForm, type VoucherFormInitial } from '../_components/voucher-form';
import { createDiscountCode } from '../actions';

export const metadata = { title: 'New discount code · Admin' };

type ServiceRow = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
};

export default async function NewDiscountCodePage() {
  const admin = createAdminClient();

  // Fetch active service_catalog rows for the multi-checkbox. Active-only
  // because admin should not be able to attach a voucher to a retired SKU
  // (would silently never apply at checkout).
  const { data: services, error } = await admin
    .from('service_catalog')
    .select('sku_code, display_name, category, price_centavos')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('display_name', { ascending: true });
  if (error) {
    throw new Error(`Could not load service catalog: ${error.message}`);
  }

  const initial: VoucherFormInitial = {
    discount_code_id: null,
    code: '',
    discount_type: 'amount_off',
    discount_value: null,
    covered_service_keys: [],
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
        services={(services ?? []) as ServiceRow[]}
        action={createDiscountCode}
        submitLabel="Create code"
        submitPendingLabel="Creating…"
      />
    </div>
  );
}
