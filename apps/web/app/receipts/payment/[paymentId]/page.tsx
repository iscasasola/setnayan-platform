import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginRedirectPath, getCurrentUser } from '@/lib/auth';
import { receiptOfPayment, type PaymentRow } from '@/lib/deal-end';
import { paymentReceiptSlip, PAYMENT_RECEIPT_KIND } from '@/lib/payment-receipt-slip';
import { ReceiptPage, ReceiptSlip, slipDate } from '../../_components/receipt-slip';
import { SaveAsPdfButton, ShareReceiptButton } from '../../_components/receipt-actions';

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
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/receipts/payment/${paymentId}`));

  const { data: one, error: oneErr } = await supabase
    .from('event_vendor_payments')
    .select('event_id, vendor_id')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (oneErr) console.error('[payment-receipt] payment read failed', oneErr.message);
  const ids = one as { event_id: string; vendor_id: string } | null;
  if (!ids) notFound();

  const [host, booking, event] = await Promise.all([
    supabase.from('event_members').select('user_id').eq('event_id', ids.event_id).eq('user_id', user.id).eq('member_type', 'couple').maybeSingle(),
    supabase.from('event_vendors').select('marketplace_vendor_id, vendor_name').eq('vendor_id', ids.vendor_id).maybeSingle(),
    supabase.from('events').select('display_name').eq('event_id', ids.event_id).maybeSingle(),
  ]);
  if (host.error) console.error('[payment-receipt] host read failed', host.error.message);
  if (!host.data) notFound();
  const b = booking.data as { marketplace_vendor_id: string | null; vendor_name: string | null } | null;
  const shopId = b?.marketplace_vendor_id ?? null;
  if (booking.error || !shopId) notFound();

  const [payments, quote] = await Promise.all([
    supabase
      .from('event_vendor_payments')
      .select('payment_id, amount_php, paid_at, method, reference, is_deposit_record, vendor_confirmed_at, payment_refused_at')
      .eq('vendor_id', ids.vendor_id)
      .not('vendor_confirmed_at', 'is', null),
    supabase
      .from('vendor_proposals')
      .select('total_centavos')
      .eq('event_id', ids.event_id)
      .eq('vendor_profile_id', shopId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (payments.error || quote.error) {
    console.error('[payment-receipt] rows read failed', (payments.error ?? quote.error)?.message);
    notFound();
  }
  const agreed = quote.data ? Math.round(Number((quote.data as { total_centavos: number | string }).total_centavos) || 0) : null;
  const receipt = receiptOfPayment({ payments: (payments.data ?? []) as PaymentRow[], paymentId, agreedCentavos: agreed });
  if (!receipt) notFound();

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
