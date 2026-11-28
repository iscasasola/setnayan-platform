import Link from 'next/link';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { ORDER_STATUS_LABEL, formatPhp, isVatInclusiveServiceKey } from '@/lib/orders';
import { computeVatFromBase, computeVatFromGross, formatPhpFromString } from '@/lib/receipts';
import { isStoreShellRequest } from '@/lib/request-platform';
import { RECEIPT_CTA, ReceiptPage, ReceiptSlip, slipDateTime, slipFigure, type SlipLine, type SlipRow } from '../../_components/receipt-slip';
import { ShareReceiptButton } from '../../_components/receipt-actions';
import { gateOrderSlip } from './gate';

export const metadata = { title: 'Order' };

type Props = { params: Promise<{ orderId: string }> };

/**
 * THE SAME SLIP BEFORE THE MONEY MOVES (owner 2026-10-25, prototype "Receipt · awaiting payment"): an order of THIS
 * login that has no receipt yet. Kind "Order · awaiting payment", the AWAITING stamp, the amount owed, where to pay and
 * the reference to quote, then a gold "Pay ₱X" under the slip — which opens the event's order page, where the payment
 * is logged (apply-then-pay as shipped; HQ confirms and the receipt replaces this slip).
 *
 * 🔒 Owner-only: `order.user_id` must be the signed-in person (an admin or a co-host can READ other people's orders
 * under `orders_owner_read`; this page is for the payer). Once a receipt exists, this address forwards to it.
 * 🛍 The App Store / Play shell never sees where to pay or a Pay button (lib/store-shell.ts — the order page is refused
 * there); the slip stays as the record.
 */
export default async function OrderSlipPage({ params }: Props) {
  const { orderId } = await params;
  // Sign-in, not found and "go to the receipt" were decided by ./layout.tsx before streaming; same request, same answer.
  const { supabase, order } = await gateOrderSlip(orderId);

  const [vatRatePct, storeShell] = await Promise.all([
    getEffectiveVatRatePct(supabase),
    isStoreShellRequest(),
  ]);
  const supplierBill = isVatInclusiveServiceKey(order.service_key);
  let eventName: string | null = null;
  if (order.event_id && !supplierBill) {
    const { data } = await supabase.from('events').select('display_name').eq('event_id', order.event_id).maybeSingle();
    eventName = (data as { display_name?: string | null } | null)?.display_name?.trim() || null;
  }

  // The figures, by the same rules the order page charges: a customer SKU stores a pre-VAT base, a supplier's
  // `vendor_…` price is already gross; the rate is the effective one (0 today ⇒ no VAT line at all).
  const stored = Number(order.confirmed_total_php ?? order.requested_total_php);
  const v = supplierBill ? computeVatFromGross(stored, vatRatePct) : computeVatFromBase(stored, vatRatePct);
  const vatShown = v.vat > 0;
  const lines: SlipLine[] = [
    { what: order.description, qty: 1, amount: slipFigure(vatShown ? v.preVat : v.gross), detail: eventName ? `For ${eventName}` : null },
  ];
  if (vatShown) lines.push({ what: `VAT ${v.rate}%`, qty: null, amount: slipFigure(v.vat) });

  const waiting = order.status === 'awaiting_payment' || order.status === 'submitted';
  const payHref =
    order.status === 'awaiting_payment' && order.event_id && !supplierBill && !storeShell
      ? `/dashboard/${order.event_id}/orders/${order.order_id}`
      : null;

  const rows: SlipRow[] = [];
  if (payHref) {
    // Where the money goes is decided by the pay page alone (`pickPayerRail`, Maya first when open) — the slip never
    // names a rail of its own, which could disagree with it, nor a step that is gone (final check A2-F7).
    rows.push({ label: 'Reference', value: order.reference_code });
    rows.push({ label: 'Then', value: 'press Pay — it shows where to send it' });
  } else {
    rows.push({ label: 'Status', value: ORDER_STATUS_LABEL[order.status] });
  }

  // No "Pay by" on the AWAITING tag: orders carry no payment due date (`expires_at` is a subscription's END), so
  // `ReceiptSlip` gets no `payBy` and the line is not drawn — a date is never invented.
  return (
    <ReceiptPage
      actions={
        <>
          {payHref ? (
            <Link href={payHref} className={RECEIPT_CTA} data-receipt-action="pay">
              Pay {formatPhp(v.gross)}
            </Link>
          ) : null}
          <ShareReceiptButton title={`Setnayan order ${order.public_id}`} />
        </>
      }
    >
      <ReceiptSlip
        kind={`Order · ${ORDER_STATUS_LABEL[order.status].toLowerCase()}`}
        number={order.public_id}
        stamp={waiting ? 'awaiting' : order.status === 'paid' || order.status === 'fulfilled' ? 'paid' : null}
        amount={formatPhp(v.gross)}
        when={`Ordered ${slipDateTime(order.created_at, ' · ')}`}
        lines={lines}
        total={formatPhpFromString(v.gross)}
        vatIncluded={vatShown}
        rows={rows}
        refs={[order.public_id, order.reference_code]}
        legal={
          waiting || order.status === 'paid' || order.status === 'fulfilled'
            ? 'Becomes your transaction receipt once the payment is confirmed.'
            : 'No transaction receipt — no payment was confirmed for this order.'
        }
      />
    </ReceiptPage>
  );
}
