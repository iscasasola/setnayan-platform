import { Wallet, X } from 'lucide-react';
import { AskSubmit } from '@/app/_components/ask-submit';
import { InfoTip } from '@/app/_components/info-tip';
import { vendorAskForPayment, vendorWithdrawPaymentAsk } from '../actions';
import { StayForm } from '@/app/_components/stay-form';

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
  // 📐 Design template (2026-11-14): a section label, hairline rows, one honest line when there is nothing, the money
  // bold in the words' own font, buttons from the shared kit (AskSubmit = SubmitButton wearing ActionButton's look),
  // the explaining behind an ⓘ. Every notice, refusal and action is kept.
  const NOTE = 'py-2 text-[13px] font-semibold';
  return (
    <div data-payment-asks="">
      <h3 className="pt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">Ask for a payment</h3>

      {/*
        EVERY REFUSAL HAS SOMEWHERE TO BE SHOWN. The action refuses for four
        different reasons and each one ends on a named flag; a guard that
        refuses in silence is indistinguishable from one that passed.
      */}
      {notice === 'sent' ? (
        <p role="status" className={`${NOTE} text-success-700`}>
          Sent. {customerName} has been told.
        </p>
      ) : null}
      {notice === 'withdrawn' ? (
        <p role="status" className={`${NOTE} text-ink/70`}>
          Taken back. It is off their page.
        </p>
      ) : null}
      {notice === 'amount' ? (
        <p role="alert" className={`${NOTE} text-warn-800`}>
          Put in an amount above zero.
        </p>
      ) : null}
      {notice === 'notbooked' ? (
        <p role="alert" className={`${NOTE} text-warn-800`}>
          You can only ask a customer who has booked you.
        </p>
      ) : null}
      {notice === 'error' ? (
        <p role="alert" className={`${NOTE} text-warn-800`}>
          That did not go through. Nothing was sent — try again.
        </p>
      ) : null}

      {!canAsk ? null : !measured ? (
        <p role="status" className="flex min-h-14 items-center gap-2 border-b border-ink/10 text-[15px] font-semibold text-warn-800">
          <Wallet aria-hidden className="h-4 w-4 shrink-0" />
          <InfoTip label="Couldn’t load what you already asked for" align="start">
            Check back before asking again, so {customerName} does not get the same request twice.
          </InfoTip>
        </p>
      ) : asks.length > 0 ? (
        <ul>
          {asks.map((a) => (
            <li
              key={a.askId}
              className="flex min-h-14 items-center gap-3 border-b border-ink/10 border-l-4 border-l-gold py-2 pl-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold tabular-nums text-ink">{peso(a.amountPhp)}</p>
                <p className="truncate text-[13px] text-ink/70">
                  {a.note ? `${a.note} · ` : ''}
                  {a.dueDate ? `by ${dayLabel(a.dueDate)} · ` : ''}
                  asked {dayLabel(a.createdAt.slice(0, 10))}
                </p>
              </div>
              <StayForm door="supClients.vendorWithdrawPaymentAsk" action={vendorWithdrawPaymentAsk} className="shrink-0">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="ask_id" value={a.askId} />
                <AskSubmit tone="danger" icon={<X aria-hidden className="h-4 w-4" />} label="Take it back" pendingLabel="Taking back…" />
              </StayForm>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex min-h-14 items-center gap-2 border-b border-ink/10 text-[15px] text-ink/70">
          Nothing outstanding. {customerName} has not been asked for anything.
        </p>
      )}

      {canAsk ? (
      <StayForm
        door="supClients.vendorAskForPayment"
        action={vendorAskForPayment}
        className="pt-3"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-28 flex-1">
            <span className="mb-1 block text-[13px] font-semibold text-ink/70">
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
              className="h-12 w-full rounded-lg border border-ink/15 px-3 text-[15px]"
            />
          </label>
          <label className="min-w-32 flex-1">
            <span className="mb-1 block text-[13px] font-semibold text-ink/70">
              By when (optional)
            </span>
            <input
              type="date"
              name="due_date"
              className="h-12 w-full rounded-lg border border-ink/15 px-3 text-[15px]"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[13px] font-semibold text-ink/70">
            What it is for (optional)
          </span>
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="Second payment"
            className="h-12 w-full rounded-lg border border-ink/15 px-3 text-[15px]"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AskSubmit tone="brand" icon={<Wallet aria-hidden className="h-4 w-4" />} label={`Ask ${customerName}`} pendingLabel="Sending…" />
          <span className="text-[13px] text-ink/70">
            <InfoTip label="Who holds the money" align="start">
              They pay you directly, the way they always have. Setnayan never holds this money — this just tells them
              what you are waiting for.
            </InfoTip>
          </span>
        </div>
      </StayForm>
      ) : (
        <p className="flex min-h-14 items-center border-b border-ink/10 text-[15px] text-ink/70">
          You can ask for a payment once {customerName} has booked you.
        </p>
      )}
    </div>
  );
}
