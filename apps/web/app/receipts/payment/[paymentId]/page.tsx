import { paymentReceiptSlip, PAYMENT_RECEIPT_KIND } from '@/lib/payment-receipt-slip';
import { ReceiptPage, ReceiptSlip, slipDate } from '../../_components/receipt-slip';
import { SaveAsPdfButton, ShareReceiptButton } from '../../_components/receipt-actions';
import { gatePaymentReceipt } from './gate';

export const metadata = { title: PAYMENT_RECEIPT_KIND };

type Props = { params: Promise<{ paymentId: string }> };

/**
 * 🧾 THE SUPPLIER-PAYMENT RECEIPT — the document the hosts' Receipt card opens with "PDF" (Unichat drawing
 * `unichat_live_v3_2026-11-20.html`, "Receipt card · Hosts: Sees · PDF"). The house slip (`receipt-slip.tsx`), Save
 * as PDF (the browser's print of the slip) and Share — no new service, no new table.
 *
 * 🔒 THE HOSTS ONLY: the signed-in person must be a host (`event_members.member_type = 'couple'`) of the payment's
 * event. The drawing gives the coordinator the card and not the PDF, and the supplier neither; every read is on the
 * reader's own session, so row security still decides what can be read at all.
 * Only a CONFIRMED, unrefused payment has a receipt — anything else is not found, never a slip with a guessed figure.
 * A refused read of the quote or the payments is not found too: a slip missing "what is left" would read as complete.
 */
export default async function PaymentReceiptPage({ params }: Props) {
  const { paymentId } = await params;
  // Sign-in and every "not found" were decided by ./layout.tsx before streaming; same request, same answer.
  const { ids, b, event, receipt } = await gatePaymentReceipt(paymentId);

  const shopName = b?.vendor_name?.trim() || 'Your supplier';
  const eventName = (event.data as { display_name: string | null } | null)?.display_name?.trim() || null;
  const slip = paymentReceiptSlip(receipt, { shop: shopName, eventName, date: slipDate });

  return (
    <ReceiptPage
      back={{ href: `/dashboard/${ids.event_id}/vendors/${ids.vendor_id}/workspace?tab=chat`, label: shopName }}
      actions={
        <>
          <SaveAsPdfButton />
          <ShareReceiptButton title={`${PAYMENT_RECEIPT_KIND} · ${shopName}`} />
        </>
      }
    >
      <ReceiptSlip
        kind={slip.kind}
        number={null}
        stamp="paid"
        amount={slip.amount}
        when={slip.when}
        lines={slip.lines}
        total={slip.total}
        vatIncluded={false}
        rows={slip.rows}
        refs={slip.refs}
        legal={slip.legal}
      />
    </ReceiptPage>
  );
}
