/**
 * /admin/discount-codes/[id]/edit — edit an existing voucher code.
 *
 * WHY · Day 1.5 spec-aligned per CLAUDE.md 2026-05-29 Day 1.5 row. Row
 *       type + initial state now read pct_value + cap_centavos columns
 *       (replacing the retired generic discount_value). Editing is still
 *       gated to is_active=TRUE rows + the code identifier itself is
 *       still immutable for historical redemption audit integrity.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { VoucherForm, type VoucherFormInitial } from '../../_components/voucher-form';
import { updateDiscountCode } from '../../actions';

export const metadata = { title: 'Edit discount code · Admin' };

type DiscountCodeRow = {
  discount_code_id: string;
  code: string;
  discount_type: 'pct_off' | 'pct_off_capped' | 'free';
  // Day 1.5 spec · pct_value + cap_centavos replace generic discount_value.
  pct_value: number | null;
  cap_centavos: number | null;
  covered_service_keys: string[];
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
};

type ServiceRow = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditDiscountCodePage({ params }: Props) {
  const { id } = await params;

  const admin = createAdminClient();

  // Fetch the row + service catalog in parallel.
  const [codeRes, servicesRes] = await Promise.all([
    admin
      .from('discount_codes')
      .select(
        // Day 1.5 schema · pct_value + cap_centavos replace discount_value.
        'discount_code_id, code, discount_type, pct_value, cap_centavos, covered_service_keys, expires_at, max_uses, uses_count, is_active',
      )
      .eq('discount_code_id', id)
      .maybeSingle(),
    admin
      .from('service_catalog')
      .select('sku_code, display_name, category, price_centavos')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('display_name', { ascending: true }),
  ]);

  if (codeRes.error) {
    throw new Error(`Could not load code: ${codeRes.error.message}`);
  }
  const code = codeRes.data as DiscountCodeRow | null;
  if (!code) {
    notFound();
  }

  if (servicesRes.error) {
    throw new Error(`Could not load service catalog: ${servicesRes.error.message}`);
  }
  const services = (servicesRes.data ?? []) as ServiceRow[];

  // Build initial state for the shared form.
  // pct_value is INT (returns as number) · cap_centavos is BIGINT (Supabase
  // can return as number for V1 small magnitudes · coerce defensively).
  const initial: VoucherFormInitial = {
    discount_code_id: code.discount_code_id,
    code: code.code,
    discount_type: code.discount_type,
    pct_value: code.pct_value === null ? null : Number(code.pct_value),
    cap_centavos:
      code.cap_centavos === null ? null : Number(code.cap_centavos),
    covered_service_keys: code.covered_service_keys,
    expires_at: code.expires_at,
    max_uses: code.max_uses,
  };

  return (
    <div className="space-y-6">
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
          Edit{' '}
          <span
            className="font-mono text-2xl"
            style={{ color: 'var(--m-orange-2)' }}
          >
            {code.code}
          </span>
        </h1>
        <p
          className="mt-1 max-w-2xl text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          Used {code.uses_count} time{code.uses_count === 1 ? '' : 's'} so far.
          Code identifier itself isn&apos;t editable — disable this one and
          create a fresh code if you need to rename it.
        </p>
      </div>

      {!code.is_active && (
        <div
          className="rounded-md border px-4 py-3 text-sm"
          style={{
            background: 'var(--m-paper-2)',
            borderColor: 'var(--m-line)',
            color: 'var(--m-slate)',
          }}
        >
          This code is disabled. Re-enable it from the list page before
          editing.
        </div>
      )}

      <VoucherForm
        initial={initial}
        services={services}
        action={updateDiscountCode}
        submitLabel="Save"
        submitPendingLabel="Saving…"
      />
    </div>
  );
}
