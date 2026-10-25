import Link from 'next/link';
import { formatPhp } from '@/lib/orders';
import { notFound } from 'next/navigation';
import { RECEIPT_CTA, ReceiptPage, ReceiptSlip } from '@/app/receipts/_components/receipt-slip';
import { SaveAsPdfButton, ShareReceiptButton } from '@/app/receipts/_components/receipt-actions';

/**
 * 🧾 THE RECEIPT LAB — the shipped `ReceiptSlip` on fixture figures, no database.
 * `?state=paid|novat|awaiting|awaiting-dated` (awaiting-dated = the tag's "Pay by" line, drawn only when an order
 * carries a real due date — none does today; novat = a receipt issued at a 0% rate: no VAT line, no "VAT included").
 * Dark: add `dark` to <html> (/dev is never on the dark ready-list). The stamp is `ReceiptStamp` — placeholder look.
 */
export default async function ReceiptLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : 'paid';

  if (state === 'awaiting' || state === 'awaiting-dated') {
    return (
      <ReceiptPage
        actions={
          <>
            <Link href="#" className={RECEIPT_CTA} data-receipt-action="pay">
              Pay {formatPhp(2500)}
            </Link>
            <ShareReceiptButton title="Setnayan order" />
          </>
        }
      >
        <ReceiptSlip
          kind="Order · awaiting payment"
          number="S89O-7K2M9QX4TB"
          stamp="awaiting"
          payBy={state === 'awaiting-dated' ? '30 Oct 2026' : null}
          amount={formatPhp(2500)}
          when="Ordered 23 Oct 2026 · 09:31"
          lines={[{ what: 'Live Watch', qty: 1, amount: '2,500.00', detail: 'For Cale & Ice — Wedding' }]}
          total={`${formatPhp(2500)}.00`}
          vatIncluded={false}
          rows={[
            { label: 'Pay to', value: 'GCash 0917 ··· 4821' },
            { label: 'Reference', value: 'STN-LIVE-4821' },
            { label: 'Then', value: 'log the payment below' },
          ]}
          refs={['S89O-7K2M9QX4TB', 'STN-LIVE-4821']}
          legal="Becomes your transaction receipt once the payment is confirmed."
        />
      </ReceiptPage>
    );
  }

  const vat = state !== 'novat';
  return (
    <ReceiptPage
      actions={
        <>
          <SaveAsPdfButton />
          <ShareReceiptButton title="Setnayan receipt" />
        </>
      }
    >
      <ReceiptSlip
        kind="Transaction receipt"
        number="2026-000037"
        stamp="paid"
        amount={formatPhp(2499)}
        when="29 Aug 2026 · 16:40 · GCash"
        lines={
          vat
            ? [
                { what: 'Setnayan AI', qty: 1, amount: '2,231.25', detail: 'For Cale & Ice — Wedding' },
                { what: 'VAT 12%', qty: null, amount: '267.75' },
              ]
            : [{ what: 'Setnayan AI', qty: 1, amount: '2,499.00', detail: 'For Cale & Ice — Wedding' }]
        }
        total={`${formatPhp(2499)}.00`}
        vatIncluded={vat}
        rows={[
          { label: 'Paid by', value: 'Ice Casasola' },
          { label: 'Method', value: 'GCash · ref 1029 3847' },
          { label: 'Logged', value: '29 Aug 2026 14:12' },
          { label: 'Confirmed', value: '29 Aug 2026 16:40' },
        ]}
        refs={['TXN-2026-000037', 'S89O-3PQ8VN2LKC', 'STN-AI-4790']}
        legal="Transaction receipt — not a BIR Official Receipt."
      />
    </ReceiptPage>
  );
}
