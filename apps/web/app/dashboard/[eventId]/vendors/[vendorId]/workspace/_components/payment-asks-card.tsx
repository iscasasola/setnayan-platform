import { Wallet } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * WHAT THIS SUPPLIER IS WAITING FOR — the couple's side of a payment ask.
 *
 * A server component with no controls, and that is the design, not an omission:
 * the couple ACTS by paying the supplier the way they always have, and by
 * recording it on the deposit / payment card that already sits beside this one.
 * A second "pay" button here would either lie about what Setnayan does with the
 * money or duplicate a flow that already works.
 *
 * ── WHY IT IS ALLOWED TO SAY NOTHING ───────────────────────────────────────
 * With no open asks this renders NOTHING at all. An empty "the supplier has not
 * asked you for anything" panel on every booking would be noise on a screen the
 * couple opens to do something else.
 *
 * ⚠ BUT AN UNREADABLE READ IS NOT AN EMPTY ONE, and here the two fail in
 * opposite directions: silence means "you owe nothing right now". So the caller
 * passes `measured`, and a refused read says so out loud rather than quietly
 * telling somebody their supplier is not waiting on them.
 */

export type CouplePaymentAsk = {
  askId: string;
  amountPhp: number | null;
  note: string | null;
  dueDate: string | null;
  createdAt: string;
};

function peso(php: number | null): string {
  if (php == null || !Number.isFinite(php)) return '—';
  return `₱${php.toLocaleString('en-PH', {
    minimumFractionDigits: php % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A bare DATE — never `new Date(iso)`, which reads the day before west of UTC. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PaymentAsksCard({
  vendorName,
  asks,
  measured,
}: {
  vendorName: string;
  asks: CouplePaymentAsk[];
  measured: boolean;
}) {
  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 6 · 7 · 11 · 13): no card — a section in grey capitals, then each ask
  // as a row that needs you (the gold edge is its only colour), the money bold on the right in the body face. The
  // "pay them directly" explaining sits behind the ⓘ on the label. A refused read is one amber line with no box.
  if (!measured) {
    return (
      <section>
        <p role="status" className="flex items-center gap-2 py-2 text-sm text-warn-800">
          <Wallet aria-hidden className="h-4 w-4 shrink-0" /> Couldn’t check whether {vendorName} is waiting on a
          payment — not the same as nothing. Message them if you are unsure.
        </p>
      </section>
    );
  }
  if (asks.length === 0) return null;

  return (
    <section>
      <InfoTip
        label={`${vendorName} is waiting for`}
        labelAs="p"
        labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
        align="start"
        className="mb-1 mt-[18px]"
      >
        Pay {vendorName} directly, the way you agreed. Setnayan never holds this money — record it below once you have
        sent it.
      </InfoTip>
      <ul className="divide-y divide-ink/10">
        {asks.map((a) => (
          <li key={a.askId} className="flex min-h-14 items-center gap-3 border-l-[3px] border-l-terracotta py-2.5 pl-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{a.note ?? 'Payment'}</span>
              <span className="block text-[13px] text-ink/70">
                {a.dueDate ? `By ${dayLabel(a.dueDate)} · ` : ''}
                asked {dayLabel(a.createdAt.slice(0, 10))}
              </span>
            </span>
            <span className="flex-none text-[15px] font-bold tabular-nums text-ink">{peso(a.amountPhp)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
