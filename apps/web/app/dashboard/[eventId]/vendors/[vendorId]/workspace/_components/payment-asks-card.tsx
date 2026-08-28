import { Wallet } from 'lucide-react';

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
  if (!measured) {
    return (
      <section className="rounded-2xl border border-warn-300/50 bg-warn-50 p-4">
        <p className="flex items-center gap-2 text-sm text-warn-900">
          <Wallet aria-hidden className="h-4 w-4 shrink-0" /> We could not check
          whether {vendorName} is waiting on a payment. Message them if you are
          unsure — this is us failing to load it, not them asking for nothing.
        </p>
      </section>
    );
  }
  if (asks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {vendorName} is waiting for
      </p>
      <ul className="space-y-2">
        {asks.map((a) => (
          <li
            key={a.askId}
            className="rounded-xl border border-ink/10 border-l-[3px] border-l-terracotta px-3 py-2.5"
          >
            <p className="text-sm font-semibold">{peso(a.amountPhp)}</p>
            <p className="text-xs text-ink/55">
              {a.note ? `${a.note} · ` : ''}
              {a.dueDate ? `by ${dayLabel(a.dueDate)} · ` : ''}
              asked {dayLabel(a.createdAt.slice(0, 10))}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink/45">
        Pay {vendorName} directly, the way you agreed. Setnayan never holds this
        money — record it below once you have sent it.
      </p>
    </section>
  );
}
