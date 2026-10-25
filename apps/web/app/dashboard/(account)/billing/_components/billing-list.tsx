import Link from 'next/link';
import { ChevronRight, Receipt } from 'lucide-react';
import { ORDER_STATUS_LABEL, formatPhp } from '@/lib/orders';
import { purchaseHref, shapePurchases, type Purchase, type PurchasesRead } from '@/lib/billing';

/**
 * The Billing & receipts list — a SERVER component (no client JS), drawn by the page and by `/dev/billing-lab`
 * with fixture rows.
 *
 * SHAPE (controller direction 2026-10-25 after the owner asked for "a better presentation for receipts" — pending
 * his OK of the designer's prototype): one summary line · WAITING FOR PAYMENT pinned on top, each with a Pay door ·
 * then one group per event and "Your shop", newest first. Each row is ONE line — what it is on the left, the amount
 * on the right — with one small "date · status" line under it. No boxes: rows are divided by a hairline, and the
 * WHOLE row is the door — its receipt, or the same slip for an unpaid order (`purchaseHref`). Reference numbers and
 * VAT live on the slip itself, not here. The Pay chip is not drawn in the App Store shell or on a supplier's own bill
 * (the slip shows no Pay door there either).
 *
 * HONEST STATES, each its own words:
 *   · the read was REFUSED  → "Your purchases didn't load." — never the empty state (a refusal is not a fact);
 *   · measured and empty    → "No purchases yet";
 *   · a refused receipts read → one line saying receipts didn't load (a row without one may still have one).
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

  const { paidTotalPhp, paidCount, awaiting, groups } = shapePurchases(read.rows);
  const summary = [
    `${formatPhp(paidTotalPhp)} paid`,
    awaiting.length > 0 ? `${awaiting.length} waiting for payment` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div data-billing-state="rows">
      <p className="text-sm text-ink/70" data-billing-summary="">
        {summary}
        {paidCount > 0 ? <span className="text-ink/50"> · {paidCount === 1 ? '1 receipt' : `${paidCount} receipts`}</span> : null}
      </p>
      {read.receiptsMeasured ? null : (
        <p role="status" className="mt-1 text-sm text-ink/60">
          Receipts didn&rsquo;t load. Refresh to see them.
        </p>
      )}

      {awaiting.length > 0 ? (
        <section className="mt-6" data-billing-group="awaiting" aria-label="Waiting for payment">
          <h2 className="pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Waiting for payment</h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {awaiting.map((p) => (
              <Row key={p.orderId} p={p} href={purchaseHref(p)} pay={!storeShell && !p.isSupplierBilling} />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} className="mt-6" data-billing-group={g.key} aria-label={g.label}>
          <h2 className="truncate pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{g.label}</h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {g.rows.map((p) => (
              <Row key={p.orderId} p={p} href={purchaseHref(p)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ p, href, pay = false }: { p: Purchase; href: string | null; pay?: boolean }) {
  const when = new Date(p.createdAt).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{p.description}</span>
        <span className="mt-0.5 block truncate text-xs text-ink/55">
          {when} · {ORDER_STATUS_LABEL[p.status]}
        </span>
      </span>
      <span className="shrink-0 font-medium tabular-nums text-ink">{formatPhp(p.grossPhp)}</span>
      {pay && href ? (
        <span className="shrink-0 rounded-full bg-terracotta-700 px-3.5 py-1.5 text-xs font-semibold text-[#FFFDF8] dark:text-cream">Pay</span>
      ) : href ? (
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
      ) : null}
    </>
  );
  return (
    <li data-billing-row={p.receiptId ? 'receipt' : href ? 'order' : 'record'}>
      {href ? (
        <Link href={href} className="flex min-h-[60px] items-center gap-3 py-2.5 transition-colors hover:bg-ink/[0.03]">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-[60px] items-center gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}
