import Link from 'next/link';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Payment methods · Admin' };

type PaymentMethodRow = {
  method_code: string;
  display_name: string;
  gateway_fee_pct: number;
  setnayan_pay_pct: number;
  // Minimum convenience-fee floor in centavos. Added by migration
  // 20260608000000 per CLAUDE.md decision-log 2026-05-17 ninth row to
  // ensure sub-₱1,000 bookings still clear Setnayan's per-transaction
  // operating cost. Nullable in the read shape only because pre-migration
  // envs would return NULL; post-migration every row carries 5000 (₱50)
  // by default. We coalesce in the cell render so a NULL doesn't break
  // the table layout.
  min_fee_centavos: number | null;
  is_active: boolean;
  display_order: number;
  effective_at: string;
  updated_at: string;
};

/**
 * Read-only scaffold for the legacy Setnayan Pay payment methods table.
 *
 * Source: `public.setnayan_pay_methods` (seeded 2026-05-16, spec corpus
 * commit a0fa3c7).
 *
 * Retired 2026-05-28 V2 cutover — Setnayan Pay 5% convenience fee is
 * RETIRED ENTIRELY under V2 (per CLAUDE.md 2026-05-28 V1→V2 cutover
 * decision-log rows). Setnayan is now a software publisher, not a
 * marketplace intermediary; vendor bookings settle directly off-platform
 * with 0% commission, and the 18 customer software SKUs + 2 bundles sell at
 * sticker price with no convenience fee. The fee rows below are historical
 * configuration kept for audit; the underlying checkout flow no longer
 * consults this table for new V2 orders.
 *
 * Follow-up engineering work tracked separately to either retire the table
 * outright once legacy V1 orders have all resolved, or fold it into the
 * V2 publisher accounting surface.
 */
export default async function PaymentMethodsAdminPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('setnayan_pay_methods')
    .select(
      'method_code,display_name,gateway_fee_pct,setnayan_pay_pct,min_fee_centavos,is_active,display_order,effective_at,updated_at',
    )
    .order('display_order', { ascending: true });

  const rows = ((data ?? []) as PaymentMethodRow[]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to settings
      </Link>

      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">
            Legacy Setnayan Pay methods
          </h1>
        </div>
        <p className="text-sm text-ink/65">
          Historical configuration for the per-payment-method convenience fee
          + per-rail minimum floor that ran during the V1 launch period. Each
          row records the gateway fee, the Setnayan Pay platform fee, and the
          minimum floor that protected sub-₱1,000 bookings.
        </p>
        <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Retired 2026-05-28 V2 cutover —
          read-only historical view.</span> Setnayan Pay is no longer the
          checkout rail. Setnayan is now a software publisher — customer SKUs
          sell at sticker price with no convenience fee, and vendor bookings
          settle directly off-platform with 0% commission. The rows below stay
          for audit only; new V2 orders don&apos;t consult this table.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Could not load payment methods: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink/15 bg-cream p-3 text-sm text-ink/55">
          No historical Setnayan Pay rows recorded. (V2 doesn&apos;t write to
          this table; this is expected on fresh environments.)
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
          <table className="min-w-full divide-y divide-ink/10 text-sm">
            <thead className="bg-ink/5">
              <tr>
                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Method
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Gateway fee
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Setnayan Pay
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Min fee
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Total
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((m) => {
                const gatewayPct = Number(m.gateway_fee_pct) * 100;
                const setnayanPct = Number(m.setnayan_pay_pct) * 100;
                const totalPct = gatewayPct + setnayanPct;
                // Coalesce a NULL (pre-migration env) to the canonical ₱50
                // floor for display — keeps the cell stable across mixed
                // migration states. Post-migration every row carries 5000
                // by default.
                const minFeeCentavos = m.min_fee_centavos ?? 5000;
                const minFeePhp = Math.round(minFeeCentavos / 100);
                return (
                  <tr key={m.method_code} className={m.is_active ? '' : 'opacity-50'}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">{m.display_name}</div>
                      <div className="font-mono text-[11px] text-ink/55">
                        {m.method_code}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {gatewayPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {setnayanPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      ₱{minFeePhp.toLocaleString('en-PH')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {totalPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {m.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 font-medium text-ink/55">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · spec corpus 2026-05-16 (a0fa3c7) · flat 5.0% lock 2026-05-16
        row 16 · ₱50 min-fee floor 2026-05-17 row 9 · table{' '}
        <code>setnayan_pay_methods</code> · retired 2026-05-28 V2 cutover
        (historical audit only).
      </p>
    </div>
  );
}
