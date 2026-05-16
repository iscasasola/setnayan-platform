import Link from 'next/link';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Payment methods · Admin' };

type PaymentMethodRow = {
  method_code: string;
  display_name: string;
  gateway_fee_pct: number;
  setnayan_pay_pct: number;
  is_active: boolean;
  display_order: number;
  effective_at: string;
  updated_at: string;
};

/**
 * Read-only scaffold for the Setnayan Pay payment methods table.
 *
 * Source: `public.setnayan_pay_methods` (seeded 2026-05-16, spec corpus
 * commit a0fa3c7). The edit flow is intentionally deferred — admins
 * currently change fees via a service-role SQL update; the table here
 * exists so the values are at least visible at a glance.
 *
 * Follow-up engineering work tracked separately to add the edit form +
 * audit log.
 */
export default async function PaymentMethodsAdminPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('setnayan_pay_methods')
    .select(
      'method_code,display_name,gateway_fee_pct,setnayan_pay_pct,is_active,display_order,effective_at,updated_at',
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
          <h1 className="text-2xl font-semibold tracking-tight">Setnayan Pay methods</h1>
        </div>
        <p className="text-sm text-ink/65">
          Per-payment-method convenience-fee configuration. Each rail charges a
          gateway fee (passed through to the underlying processor) plus the
          Setnayan Pay platform fee. Couples see the combined rate at checkout.
        </p>
        <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Read-only V1.</span> Edit flow is
          deferred — to change a rate, run a service-role SQL update against
          <code className="mx-1 font-mono text-[11px]">setnayan_pay_methods</code>
          and the change is live everywhere.
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
          No payment methods configured yet. Run the
          <code className="mx-1 font-mono text-[11px]">setnayan_pay_methods</code>
          migration to seed the V1 defaults.
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
        Source · spec corpus 2026-05-16 (a0fa3c7) · table{' '}
        <code>setnayan_pay_methods</code>
      </p>
    </div>
  );
}
