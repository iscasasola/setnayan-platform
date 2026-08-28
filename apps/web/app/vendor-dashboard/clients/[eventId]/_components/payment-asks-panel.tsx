import { Wallet, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { vendorAskForPayment, vendorWithdrawPaymentAsk } from '../actions';

/**
 * "Ask for a payment" — on the customer, next to what they owe.
 *
 * Plain <form> + server actions, so the customer card stays a server component
 * and this works with JavaScript off.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * It is not a bill, an invoice, a charge, or a second ledger. Setnayan holds
 * none of this money and moves none of it: the couple pays the shop directly,
 * off-platform, exactly as before. An ask is a SENTENCE with an amount on it,
 * and whether the money arrived stays the ledger's fact — which is why the row
 * has no "paid" state to disagree with the ledger about.
 *
 * ── WHY A WITHDRAW BUTTON AND NOT A "MARK PAID" BUTTON ─────────────────────
 * "Mark paid" would be a second copy of an answer the payment ledger already
 * gives, and two copies of a money rule always drift. The shop takes the ask
 * down when it is settled; the receipt lives where receipts live.
 *
 * ── EMPTY vs UNREADABLE ────────────────────────────────────────────────────
 * `measured` is not decoration. A refused read and an empty list are the same
 * value out of PostgREST, and they are opposite sentences here: "nothing
 * outstanding" invites the shop to ask again, which would send the same couple
 * the same request twice. When the read failed, this says so and offers no form.
 */

export type PaymentAsk = {
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

/** A bare DATE — rendered without the timezone drift `new Date(iso)` causes. */
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PaymentAsksPanel({
  eventId,
  customerName,
  asks,
  measured,
  notice,
  canAsk,
}: {
  eventId: string;
  /** What to call the customer in the sentence. Already identity-safe upstream. */
  customerName: string;
  asks: PaymentAsk[];
  /** False when the read was refused — say so rather than showing "none". */
  measured: boolean;
  /** The `?ask=` outcome flag, or null. */
  notice: string | null;
  /**
   * Whether this customer has actually booked. FALSE renders THE NOTICE AND
   * NOTHING ELSE.
   *
   * 🔴 IT EXISTS BECAUSE ONE REFUSAL HAD NOWHERE TO LAND. The action answers a
   * vanished booking with `?ask=notbooked`, and the panel used to render only
   * on a booked customer — so that particular refusal was redirected onto a
   * page that could not show it. A guard that refuses in silence is
   * indistinguishable from one that passed.
   */
  canAsk: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        Ask for a payment
      </p>

      {/*
        EVERY REFUSAL HAS SOMEWHERE TO BE SHOWN. The action refuses for four
        different reasons and each one ends on a named flag; a guard that
        refuses in silence is indistinguishable from one that passed.
      */}
      {notice === 'sent' ? (
        <p className="rounded-lg bg-success-50 px-3 py-2 text-xs font-semibold text-success-900">
          Sent. {customerName} has been told.
        </p>
      ) : null}
      {notice === 'withdrawn' ? (
        <p className="rounded-lg bg-ink/5 px-3 py-2 text-xs font-semibold text-ink/70">
          Taken back. It is off their page.
        </p>
      ) : null}
      {notice === 'amount' ? (
        <p className="rounded-lg bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-900">
          Put in an amount above zero.
        </p>
      ) : null}
      {notice === 'notbooked' ? (
        <p className="rounded-lg bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-900">
          You can only ask a customer who has booked you.
        </p>
      ) : null}
      {notice === 'error' ? (
        <p className="rounded-lg bg-warn-50 px-3 py-2 text-xs font-semibold text-warn-900">
          That did not go through. Nothing was sent — try again.
        </p>
      ) : null}

      {!canAsk ? null : !measured ? (
        <p className="flex items-center gap-2 rounded-lg border border-warn-300/50 bg-warn-50 px-3 py-2.5 text-sm text-warn-900">
          <Wallet aria-hidden className="h-4 w-4 shrink-0" /> We could not load
          what you have already asked for. Check back before asking again, so{' '}
          {customerName} does not get the same request twice.
        </p>
      ) : asks.length > 0 ? (
        <ul className="space-y-2">
          {asks.map((a) => (
            <li
              key={a.askId}
              className="flex items-center gap-3 rounded-xl border border-ink/10 border-l-[3px] border-l-terracotta bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{peso(a.amountPhp)}</p>
                <p className="truncate text-xs text-ink/55">
                  {a.note ? `${a.note} · ` : ''}
                  {a.dueDate ? `by ${dayLabel(a.dueDate)} · ` : ''}
                  asked {dayLabel(a.createdAt.slice(0, 10))}
                </p>
              </div>
              <form action={vendorWithdrawPaymentAsk} className="shrink-0">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="ask_id" value={a.askId} />
                <SubmitButton
                  pendingLabel="Taking back…"
                  className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-2.5 py-1.5 text-xs font-semibold text-ink/70"
                >
                  <X aria-hidden className="h-3.5 w-3.5" /> Take it back
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
          <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> Nothing
          outstanding. {customerName} has not been asked for anything.
        </p>
      )}

      {canAsk ? (
      <form
        action={vendorAskForPayment}
        className="rounded-xl border border-ink/10 bg-white px-3 py-3"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[7rem] flex-1">
            <span className="mb-1 block text-[11px] font-semibold text-ink/60">
              How much
            </span>
            <input
              type="number"
              name="amount_php"
              min="1"
              step="0.01"
              required
              inputMode="decimal"
              placeholder="18000"
              className="h-9 w-full rounded-lg border border-ink/15 px-2.5 text-sm"
            />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-[11px] font-semibold text-ink/60">
              By when (optional)
            </span>
            <input
              type="date"
              name="due_date"
              className="h-9 w-full rounded-lg border border-ink/15 px-2.5 text-sm"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-semibold text-ink/60">
            What it is for (optional)
          </span>
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="Second installment"
            className="h-9 w-full rounded-lg border border-ink/15 px-2.5 text-sm"
          />
        </label>
        <SubmitButton
          pendingLabel="Sending…"
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream"
        >
          <Wallet aria-hidden className="h-3.5 w-3.5" /> Ask {customerName}
        </SubmitButton>
        <p className="mt-2 text-[11px] text-ink/45">
          They pay you directly, the way they always have. Setnayan never holds
          this money — this just tells them what you are waiting for.
        </p>
      </form>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink/55">
          <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" /> You can
          ask for a payment once {customerName} has booked you.
        </p>
      )}
    </div>
  );
}
