import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath } from '@/lib/auth';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { fetchOrderById, fetchPaymentsForOrder, formatPhp, isVatInclusiveServiceKey, type OrderRow, type PaymentRow } from '@/lib/orders';
import { fetchReceiptById, formatReceiptNumber, formatPhpFromString } from '@/lib/receipts';
import { ReceiptPage, ReceiptSlip, slipDateTime, slipFigure, type SlipLine, type SlipRow } from '../_components/receipt-slip';
import { SaveAsPdfButton, ShareReceiptButton } from '../_components/receipt-actions';

export const metadata = { title: 'Transaction Receipt' };

type Props = { params: Promise<{ receiptId: string }> };

/**
 * A TRANSACTION RECEIPT — the paper slip (owner 2026-10-25, approved from
 * `prototypes/ceremo_deltas_2026-10-25/03_account_menu.html`; the anatomy is `_components/receipt-slip.tsx`).
 * Same data and RLS as before: the receipt row (owner-only, `receipts_owner_read`), plus — read on the same client —
 * its order (what was bought, the references) and the order's payments (how it was paid). A refused order or payment
 * read leaves those lines out; it never invents them. The figures come from the RECEIPT row only.
 */
export default async function ReceiptPageRoute({ params }: Props) {
  const { receiptId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Receipts are deep-linked from emails. Without preserving `next=`,
  // a click from an unauthed tab lands the user on `/` after login
  // and they have to dig the email back up.
  if (!user) redirect(loginRedirectPath(`/receipts/${receiptId}`));

  const [receipt, settings] = await Promise.all([
    fetchReceiptById(supabase, receiptId),
    fetchPlatformSettings(supabase),
  ]);
  if (!receipt) notFound();

  // RLS allows only the owner to SELECT — defense in depth at the route layer
  // in case the policy changes.
  if (receipt.user_id !== user.id) notFound();

  const [order, payments] = await Promise.all([
    fetchOrderById(supabase, receipt.order_id).catch((): OrderRow | null => null),
    fetchPaymentsForOrder(supabase, receipt.order_id).catch((): PaymentRow[] => []),
  ]);
  const paid = payments.find((p) => p.status === 'matched') ?? null;
  let eventName: string | null = null;
  if (order?.event_id && !isVatInclusiveServiceKey(order.service_key)) {
    const { data } = await supabase.from('events').select('display_name').eq('event_id', order.event_id).maybeSingle();
    eventName = (data as { display_name?: string | null } | null)?.display_name?.trim() || null;
  }

  const receiptNumber = formatReceiptNumber(receipt.or_serial, receipt.issued_at);
  // Was VAT actually assessed on THIS receipt? Read from the row, never from a
  // constant. Both halves are checked: a rate of 0 and an amount of 0 each mean
  // "no VAT", and a row that carries a rate with no amount prints no VAT line
  // rather than a contradiction. A NON-VAT SELLER MUST NOT PRINT A VAT LINE —
  // "VAT @ 0%  ₱0.00" tells the reader a tax was assessed. The day the threshold
  // is crossed the rate is set in settings, new receipts carry it, and the line
  // (and "VAT included") appears by itself; old receipts keep what they were issued at.
  const vatWasCharged = Number(receipt.vat_rate_pct) > 0 && Number(receipt.vat_amount_php) > 0;

  const lines: SlipLine[] = [
    {
      what: order?.description?.trim() || 'Setnayan services',
      qty: 1,
      amount: slipFigure(Number(vatWasCharged ? receipt.pre_vat_php : receipt.gross_total_php)),
      detail: eventName ? `For ${eventName}` : null,
    },
  ];
  if (vatWasCharged) {
    lines.push({ what: `VAT ${Number(receipt.vat_rate_pct)}%`, qty: null, amount: slipFigure(Number(receipt.vat_amount_php)) });
  }

  const rows: SlipRow[] = [{ label: 'Paid by', value: receipt.issued_to_name ?? receipt.issued_to_email }];
  if (receipt.issued_to_tin) rows.push({ label: 'TIN', value: receipt.issued_to_tin });
  if (paid) {
    rows.push({ label: 'Method', value: paid.reference_number ? `${paid.channel} · ref ${paid.reference_number}` : paid.channel });
    rows.push({ label: 'Logged', value: slipDateTime(paid.paid_at ?? paid.created_at) });
  }
  rows.push({ label: 'Confirmed', value: slipDateTime(receipt.issued_at) });

  const refs = [receiptNumber, order?.public_id, order?.reference_code].filter((r): r is string => !!r);
  if (settings.business_tin) refs.push(`${settings.business_name} · TIN ${settings.business_tin}`);

  return (
    <ReceiptPage
      actions={
        <>
          <SaveAsPdfButton />
          <ShareReceiptButton title={`Setnayan receipt ${receiptNumber}`} />
        </>
      }
    >
      <ReceiptSlip
        kind="Transaction receipt"
        number={receiptNumber.replace(/^TXN-/, '')}
        stamp="paid"
        amount={formatPhp(Number(receipt.gross_total_php))}
        when={[slipDateTime(receipt.issued_at, ' · '), paid?.channel].filter(Boolean).join(' · ')}
        lines={lines}
        total={formatPhpFromString(receipt.gross_total_php)}
        vatIncluded={vatWasCharged}
        rows={rows}
        refs={refs}
        legal="Transaction receipt — not a BIR Official Receipt."
      />
    </ReceiptPage>
  );
}
