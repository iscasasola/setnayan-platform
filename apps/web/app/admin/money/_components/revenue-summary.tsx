import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatPhp } from '@/lib/orders';
import { revenueStatement, revenueScopeNote } from '@/lib/admin/revenue-statement';
import { formatCount } from '@/lib/format-number';
import { TEMPLATE_MONEY, TEMPLATE_SUBLINE, TemplateFail, TemplateSection } from '@/app/_components/template-rows';

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
    // `lapsed` is paid money too: a subscription whose term ran out, or a service
    // switched off when its value became Papic credits (owner 2026-11-05). Only a
    // `paid` order is ever lapsed, and nothing was sent back — so it stays revenue.
    admin.from('orders').select('requested_total_php, status').in('status', ['paid', 'fulfilled', 'lapsed']),
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
      <TemplateSection label="Revenue, all time" first data="revenue">
        <p className="text-[32px] font-bold leading-none tabular-nums text-ink">&mdash;</p>
        <TemplateFail retryHref="/admin/money" data="revenue">
          Couldn&rsquo;t load the money figures &mdash; this is not ₱0, it is a failed read.
        </TemplateFail>
      </TemplateSection>
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
    <div className="flex min-h-11 items-center justify-between gap-4 py-1.5">
      <span className="text-[15px] text-ink">
        {label}
        {note ? <span className={`ml-1.5 ${TEMPLATE_SUBLINE}`}>{note}</span> : null}
      </span>
      <span className={`text-[15px] ${TEMPLATE_MONEY}`}>{value}</span>
    </div>
  );

  // 📐 Design template rule 13 (owner-approved 2026-11-14): the one strong number on the warm surface, money in the
  // words' own font (never a typewriter font), the lines under it as hairline rows, the scope note behind ⓘ.
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-2 sm:px-6">
      <TemplateSection label="Revenue, all time" tip={revenueScopeNote(s)} first data="revenue">
        <div className="rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] px-4 py-3">
          <p className="text-[32px] font-bold leading-none tabular-nums text-ink">{formatPhp(s.netPhp)}</p>
        </div>
        <div className="mt-2 divide-y divide-[color:var(--m-line)]">
          <Row label="Software sales" value={formatPhp(s.softwarePhp)} note={`${formatCount(s.paidOrderCount)} paid order${s.paidOrderCount === 1 ? '' : 's'}`} />
          <Row label="Booking fees" value={formatPhp(s.bookingFeePhp)} note={`${formatCount(s.paidFeeCount)} paid`} />
          <Row label="Refunds" value={`− ${formatPhp(s.refundedPhp)}`} />
        </div>
        {/* Outside the divide: it is NOT part of the sum above. */}
        <div className="mt-1 border-t border-dashed border-[color:var(--m-line)]">
          <Row label="Receipts issued" value={formatPhp(s.receiptPhp)} note={`${formatCount(s.receiptCount)} · not counted in the total`} />
        </div>
      </TemplateSection>
    </div>
  );
}
