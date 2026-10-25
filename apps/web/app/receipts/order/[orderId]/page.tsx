import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath } from '@/lib/auth';
import { fetchPlatformSettings, getEffectiveVatRatePct } from '@/lib/platform-settings';
import { ORDER_STATUS_LABEL, fetchOrderById, formatPhp, isVatInclusiveServiceKey } from '@/lib/orders';
import { computeVatFromBase, computeVatFromGross, fetchReceiptByOrderId, formatPhpFromString } from '@/lib/receipts';
import { isStoreShellRequest } from '@/lib/request-platform';
import { RECEIPT_CTA, ReceiptPage, ReceiptSlip, slipDateTime, slipFigure, type SlipLine, type SlipRow } from '../../_components/receipt-slip';
import { ShareReceiptButton } from '../../_components/receipt-actions';

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginRedirectPath(`/receipts/order/${orderId}`));

  const order = await fetchOrderById(supabase, orderId);
  if (!order || order.user_id !== user.id || order.status === 'draft') notFound();
  const receipt = await fetchReceiptByOrderId(supabase, orderId);
  if (receipt) redirect(`/receipts/${receipt.receipt_id}`);

  const [settings, vatRatePct, storeShell] = await Promise.all([
    fetchPlatformSettings(supabase),
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
    const payTo = settings.gcash_enabled && settings.gcash_number
      ? `GCash ${mask(settings.gcash_number)}`
      : settings.bdo_enabled && settings.bdo_account_number
        ? `BDO ${mask(settings.bdo_account_number)}`
        : null;
    if (payTo) rows.push({ label: 'Pay to', value: payTo });
    rows.push({ label: 'Reference', value: order.reference_code });
    rows.push({ label: 'Then', value: 'log the payment below' });
  } else {
    rows.push({ label: 'Status', value: ORDER_STATUS_LABEL[order.status] });
  }

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

/** "0917 ··· 4821" — enough to recognise the account on the slip; the full number and QR are on the pay page. */
function mask(n: string): string {
  const d = n.replace(/\s+/g, '');
  return d.length > 8 ? `${d.slice(0, 4)} ··· ${d.slice(-4)}` : d;
}
