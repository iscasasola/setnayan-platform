/**
 * PAYMENTS SO FAR — the ONE history both ends render (owner, live as
 * testnayan4, 2026-09-20: "show the current payments done as well").
 *
 * Mounted by the couple's "Amount to pay" card (`deposit-reservation.tsx` —
 * which is the Payments tab AND the chat quote card, which mounts it) and by
 * the supplier's client page and chat card. One component, one shape
 * (`lib/payment-history.ts`), so the two ends can never show different money.
 *
 * 🔑 THE UNREADABLE BRANCH IS NOT THE EMPTY BRANCH. A refused ledger read
 * renders `history.sentence` and never the "no payments recorded yet" copy —
 * the sentence that is byte-identical to a booking nobody has paid into.
 *
 * No directive: a plain component, usable from a server page and from the
 * client card alike.
 */
import { pesoFromCentavos } from '@/lib/accepted-quote-terms';
import { PAYMENT_HISTORY_HEADING, type PaymentHistory } from '@/lib/payment-history';

export function PaymentHistoryList({
  history,
  className,
}: {
  history: PaymentHistory | null;
  className?: string;
}) {
  if (!history) return null;

  if (history.state === 'unreadable') {
    return (
      <div className={className}>
        <p
          role="status"
          className="rounded-md border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/70"
        >
          {history.sentence}
        </p>
      </div>
    );
  }

  if (history.state === 'none') {
    return (
      <div className={className}>
        <p className="text-[11px] text-ink/55">{history.sentence}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {PAYMENT_HISTORY_HEADING}
        </p>
        <p className="text-[11px] font-semibold text-ink">{history.summary}</p>
      </div>
      <ul className="mt-1.5 space-y-1">
        {history.rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-ink/10 pt-1 text-[11px] text-ink/70 first:border-t-0 first:pt-0"
          >
            <span className="font-medium text-ink">{pesoFromCentavos(r.amountCentavos)}</span>
            <span>{r.paidOn}</span>
            {r.method ? <span>· {r.method}</span> : null}
            <span className={r.refused ? 'text-danger-700' : r.confirmed ? 'text-success-700' : 'text-ink/55'}>
              · {r.statusLine}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
