import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { OrderLine, ORDER_ROW_CLASS, ORDER_ROW_PRESS } from '@/app/_components/orders/order-line';
import { purchaseHref, type PurchasesRead } from '@/lib/billing';

/**
 * The Billing & receipts list — a SERVER component (no client JS), drawn by the page and by `/dev/billing-lab`
 * with fixture rows. Three states, each its own words:
 *
 *   · the read was REFUSED  → "Your purchases didn't load." — never the empty state (a refusal is not a fact);
 *   · measured and empty    → "No purchases yet";
 *   · rows                  → the event Orders ledger's own row (`OrderLine`), newest first. A row with a receipt
 *                             opens it (/receipts/<id>); an unpaid event order opens its order page; anything else
 *                             is read only — and has no frame, since a frame is only on what you press.
 */
export function BillingList({ read, storeShell }: { read: PurchasesRead; storeShell: boolean }) {
  if (!read.measured) {
    return (
      <div role="alert" className="border-y border-ink/10 py-8 text-center" data-billing-state="unread">
        <p className="text-sm font-medium text-ink">Your purchases didn&rsquo;t load.</p>
        <p className="mt-1 text-sm text-ink/60">Refresh the page to try again.</p>
      </div>
    );
  }

  if (read.rows.length === 0) {
    return (
      <div className="border-y border-ink/10 py-8 text-center" data-billing-state="empty">
        <Receipt aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
        <p className="text-sm text-ink/60">No purchases yet</p>
      </div>
    );
  }

  return (
    <div data-billing-state="rows">
      {read.receiptsMeasured ? null : (
        <p role="status" className="mb-3 text-sm text-ink/60">
          Receipts didn&rsquo;t load. Refresh to see them.
        </p>
      )}
      <ul className="space-y-2">
        {read.rows.map((p) => {
          const href = purchaseHref(p, storeShell);
          const when = new Date(p.createdAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'Asia/Manila',
          });
          const row = (
            <OrderLine
              description={p.description}
              publicId={p.publicId}
              referenceCode={p.referenceCode}
              grossPhp={p.grossPhp}
              status={p.status}
              meta={p.receiptNumber ? `${when} · ${p.receiptNumber}` : when}
            />
          );
          return (
            <li key={p.orderId} data-billing-row={p.receiptId ? 'receipt' : href ? 'order' : 'record'}>
              {href ? (
                <Link href={href} className={`${ORDER_ROW_CLASS} ${ORDER_ROW_PRESS}`}>
                  {row}
                </Link>
              ) : (
                <div className="flex flex-col gap-2 border-b border-ink/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
