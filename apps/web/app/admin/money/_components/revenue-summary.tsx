import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatPhp } from '@/lib/orders';
import { revenueStatement, revenueScopeNote } from '@/lib/admin/revenue-statement';

/**
 * RevenueSummary — the answer to "what have we earned?", on the page named Money.
 *
 * Register M16: `/admin/money` was a nav landing of cards. The owner could not
 * state revenue without writing SQL, with real money already collected.
 *
 * 🔑 AN UNREADABLE FIGURE RENDERS AS "—", NEVER AS ₱0. A money screen that
 * prints zero when it could not read is the defect this whole register is
 * about — and on this page it would read as "we have earned nothing", which is
 * the most alarming possible false statement to show an owner.
 */
export async function RevenueSummary() {
  const admin = createAdminClient();

  const [ordersRes, feesRes, refundsRes, receiptsRes] = await Promise.all([
    admin.from('orders').select('requested_total_php, status').in('status', ['paid', 'fulfilled']),
    admin.from('booking_fee_charges').select('amount_charged_centavos').eq('status', 'paid'),
    admin.from('order_refunds').select('refund_amount_centavos'),
    admin.from('receipts').select('gross_total_php'),
  ]);

  const unreadable =
    ordersRes.error || feesRes.error || refundsRes.error || receiptsRes.error;
  if (unreadable) {
    for (const [what, res] of [
      ['orders', ordersRes], ['booking_fee_charges', feesRes],
      ['order_refunds', refundsRes], ['receipts', receiptsRes],
    ] as const) {
      if (res.error) logQueryError(`admin/money revenue: ${what}`, res.error);
    }
    return (
      <section className="mb-6 rounded-2xl border border-warn-300/60 bg-warn-50/60 p-5">
        <h2 className="text-sm font-semibold text-ink">Revenue</h2>
        <p className="mt-1 text-2xl font-semibold text-ink/40">&mdash;</p>
        <p className="mt-1 text-xs text-ink/70">
          We couldn&rsquo;t load the money figures. This is not ₱0 &mdash; it is a failed read, and
          the reason is in the logs.
        </p>
      </section>
    );
  }

  const orders = ordersRes.data ?? [];
  const fees = feesRes.data ?? [];
  const s = revenueStatement({
    softwarePhp: orders.reduce((a, o) => a + Number(o.requested_total_php ?? 0), 0),
    bookingFeePhp: fees.reduce((a, f) => a + Number(f.amount_charged_centavos ?? 0) / 100, 0),
    refundedPhp: (refundsRes.data ?? []).reduce((a, r) => a + Number(r.refund_amount_centavos ?? 0) / 100, 0),
    receiptCount: (receiptsRes.data ?? []).length,
    receiptPhp: (receiptsRes.data ?? []).reduce((a, r) => a + Number(r.gross_total_php ?? 0), 0),
    paidOrderCount: orders.length,
    paidFeeCount: fees.length,
  });

  const Row = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-ink/70">
        {label}
        {note ? <span className="ml-1.5 text-xs text-ink/45">{note}</span> : null}
      </span>
      <span className="font-mono text-sm tabular-nums text-ink">{value}</span>
    </div>
  );

  return (
    <section className="mb-6 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">Revenue, all time</h2>
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-ink">
        {formatPhp(s.netPhp)}
      </p>
      <div className="mt-4 divide-y divide-ink/5 border-t border-ink/10 pt-2">
        <Row label="Software sales" value={formatPhp(s.softwarePhp)} note={`${s.paidOrderCount} paid order${s.paidOrderCount === 1 ? '' : 's'}`} />
        <Row label="Booking fees" value={formatPhp(s.bookingFeePhp)} note={`${s.paidFeeCount} paid`} />
        <Row label="Refunds" value={`− ${formatPhp(s.refundedPhp)}`} />
        {/* Outside the divide: it is NOT part of the sum above. */}
      </div>
      <div className="mt-3 border-t border-dashed border-ink/15 pt-2">
        <Row label="Receipts issued" value={formatPhp(s.receiptPhp)} note={`${s.receiptCount} · not counted in the total`} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink/55">{revenueScopeNote(s)}</p>
    </section>
  );
}
