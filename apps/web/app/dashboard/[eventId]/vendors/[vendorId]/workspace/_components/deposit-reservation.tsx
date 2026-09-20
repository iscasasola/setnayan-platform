'use client';

// ==========================================================================
// Deposit Reservation Lock-Free — COUPLE surface.
//
// Renders the deposit-reservation state on the workspace page:
//   • no deposit recorded → a "Record deposit" CTA that opens an inline form
//     (amount · optional method/reference · optional proof upload).
//   • recorded, not acked  → "Date held · awaiting vendor confirmation" chip.
//   • acknowledged          → "Confirmed by vendor" chip.
//   • THE VENDOR SAYS IT NEVER REACHED THEM → their words, and a way to send it
//     again. New 2026-08-27, and the reason it can exist: a refusal used to
//     DELETE the couple's amount, receipt, method and ledger row, so this card
//     fell back to "Paid a deposit off-platform? Record it" — reading as though
//     they had never recorded anything. Owner ruling: **"yes they keep their
//     record."** A supplier not seeing the money is not evidence the couple did
//     not send it; a transfer can be slow or land under another name.
//
// PAY FIRST, THEN RECORD (S19, 2026-09-18). Owner, live on the booking run:
// "there is no mode to pay the vendor the deposit… the payment modes of the
// vendor must show. and an easier way to pay of course." While a deposit is
// still owed, the card now leads with step 1 — the supplier's OWN approved
// destinations through the shipped `VendorDirectPay` sheet (with its
// owner-locked disclosure) — and only then step 2, "Record deposit". When the
// supplier has published nothing, the couple is told so in a sentence
// (`noPayMethodsSentence`) instead of being shown an empty sheet; a refused
// read says it could not load, never "they have none".
//
// ONE "AMOUNT TO PAY" (owner, 2026-09-20): "i think it is better to say amount
// to pay. since this is not just for the downpayment but also for the next
// payments". This card is the couple's ONE visible payment door for a booked
// supplier. `moneyStep` (lib/accepted-quote-terms.ts) names the payment that is
// due. The FIRST payment still posts `recordDeposit` (date held, supplier asked
// to confirm, the row marked as THE deposit — its minimum enforced there); a
// LATER installment posts `logScheduledPayment`, which runs `logPayment`.
// Neither is re-implemented here. The chat quote card mounts this same
// component, so the thread and the Payments tab cannot drift apart.
//
// OFF-PLATFORM MONEY: this records a host-entered PHP figure for the couple's
// own ledger and holds the date — it is NOT a charge through Setnayan. Setnayan
// never holds funds. Recording does NOT change the order status (orthogonal).
// ==========================================================================

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import { recordDeposit } from '../../../actions';
import { logScheduledPayment } from '@/app/dashboard/[eventId]/budget/actions';
import { FileUpload } from '@/app/_components/file-upload';
import { moneyStepLine, pesoFromCentavos, type MoneyStep } from '@/lib/accepted-quote-terms';
import { PaymentHistoryList } from '@/app/_components/payment-history-list';
import type { PaymentHistory } from '@/lib/payment-history';
import { useSaveLoader } from '@/components/sd-loader';
import { VendorDirectPay } from '@/app/dashboard/[eventId]/_components/vendor-direct-pay';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import {
  DEPOSIT_ANCHOR_ID,
  noPayMethodsSentence,
  type CouplePayMethodsState,
} from '@/lib/deposit-pay-step';

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  depositRecordedAt: string | null;
  depositAcknowledgedAt: string | null;
  depositProofUrl: string | null;
  /** When the supplier said the recorded deposit never reached them. */
  depositDeclinedAt: string | null;
  /** Their own words, if they gave any. */
  depositDeclineReason: string | null;
  /** Setnayan's own finding, once the team has checked it by hand. */
  depositDisputeNote: string | null;
  /**
   * The supplier's approved payment destinations, read server-side through
   * `readPublishedMethodsForCouple` — with the read's OUTCOME, so "they have
   * none" and "we could not load them" never render as the same sentence.
   */
  payMethods: CoupleFacingMethod[];
  payMethodsState: CouplePayMethodsState;
  /**
   * The first payment the accepted quote requested, in centavos — the MINIMUM
   * the deposit may be (`recordDeposit` refuses less, via
   * `decideDepositAmount`). null = no accepted quote / no schedule: the form
   * behaves as it always did.
   */
  requestedFirstPaymentCentavos?: number | null;
  /** "First payment requested: ₱3,350 — due on lock" (`firstPaymentSentence`). */
  requestedFirstPaymentSentence?: string | null;
  /** The accepted-quote read was refused — say so rather than show no request. */
  requestedTermsUnreadable?: boolean;
  /**
   * The next money step (`moneyStep`). Drives the later-installment form once
   * the first payment is confirmed. null/absent = the card behaves as the
   * first-payment card it always was.
   */
  step?: MoneyStep | null;
  /**
   * WHAT HAS ALREADY BEEN PAID (`readBookedMoney().history`). A refused ledger
   * read arrives as `{ state: 'unreadable' }` and says so — it is NEVER shown
   * as "no payments recorded yet".
   */
  history?: PaymentHistory | null;
  /** Compact chrome for the chat quote card (no anchor id, no outer border). */
  compact?: boolean;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function DepositReservation({
  eventId,
  vendorId,
  vendorName,
  depositRecordedAt,
  depositAcknowledgedAt,
  depositProofUrl,
  depositDeclinedAt,
  depositDeclineReason,
  depositDisputeNote,
  payMethods,
  payMethodsState,
  requestedFirstPaymentCentavos = null,
  requestedFirstPaymentSentence = null,
  requestedTermsUnreadable = false,
  step = null,
  history = null,
  compact = false,
}: Props) {
  const minimumPhp =
    requestedFirstPaymentCentavos && requestedFirstPaymentCentavos > 0
      ? requestedFirstPaymentCentavos / 100
      : null;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useSaveLoader();

  const recorded = Boolean(depositRecordedAt);
  const acked = Boolean(depositAcknowledgedAt);
  const declined = Boolean(depositDeclinedAt);
  // Still owed: nothing recorded, or the supplier said it never arrived.
  // Confirmed or awaiting an answer → paying again is not the next step.
  const owed = (!recorded || declined) && !acked;
  const noMethods = noPayMethodsSentence(payMethodsState, payMethods.length, vendorName);
  const firstLabel =
    step && step.kind === 'first_payment_due' ? step.label : 'First payment · locks the date';
  const later = step && step.kind === 'installment_due' ? step : null;
  // NOT DUE YET — the next installment's date has not arrived, so nothing is
  // owed today. No due-now CTA; the couple may still choose to pay early,
  // through the SAME control, and the line below says what is coming.
  const notDueYet = step && step.kind === 'installment_not_due_yet' ? step : null;
  const [earlyOpen, setEarlyOpen] = useState(false);
  const paidInFull = step && step.kind === 'paid_in_full' ? step : null;
  // The one sentence for this state — `moneyStepLine`, the same helper the
  // supplier's client page and both chat cards read. In the chat card the
  // frame already prints it, so it is not printed twice.
  const stepLine = step && !compact ? moneyStepLine(step, 'couple', vendorName) : null;
  // Money already on the ledger with no first payment recorded: the next step
  // is the next installment (`decideDepositRecord` will not re-record it), so
  // the first-payment form must not be offered on top of it.
  const firstPaymentOffered = (!recorded || declined) && !(later && !recorded);
  // Something is due now: the first payment, or the next installment after it.
  // ONE pay sheet serves both (the supplier's destinations do not change).
  // …and the destinations also appear once the couple opens "Pay early", since
  // that is the moment they need somewhere to send the money.
  const payDue = (owed && firstPaymentOffered) || later !== null || (notDueYet !== null && earlyOpen);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    startTransition(async () => {
      const result = await save.run(() => recordDeposit(form), {
        steps: ['Recording the payment'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setOpen(false);
      } else if (result.status === 'not_signed_in') {
        setErrorMsg('Please sign in again to record the payment.');
      } else {
        setErrorMsg(result.message ?? 'Could not record the payment — please try again.');
      }
    });
  }

  return (
    <div
      id={DEPOSIT_ANCHOR_ID}
      className={
        compact
          ? 'space-y-2 pt-1'
          : 'scroll-mt-24 space-y-2 rounded-lg border border-ink/10 bg-white/60 p-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-ink">
          <CalendarCheck aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Amount to pay
        </p>

        {acked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-400 bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Confirmed by vendor
          </span>
        ) : declined ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-300 bg-danger-50 px-2.5 py-1 text-[11px] font-semibold text-danger-700">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {vendorName} says it hasn&rsquo;t reached them
          </span>
        ) : recorded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-300 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold text-warn-900">
            <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Date held · awaiting vendor confirmation
          </span>
        ) : null}
      </div>

      {recorded ? (
        <p className="text-[11px] text-ink/60">
          First payment recorded {fmtDate(depositRecordedAt)} — your date is held on{' '}
          {vendorName}&rsquo;s schedule.{' '}
          {acked
            ? `Confirmed by ${vendorName} on ${fmtDate(depositAcknowledgedAt)}.`
            : declined
              ? `On ${fmtDate(depositDeclinedAt)} they said it hadn’t reached them. Your record here is kept — a transfer can be slow, or arrive under a different name.`
              : `${vendorName} will confirm they received it.`}
        </p>
      ) : (
        <p className="text-[11px] text-ink/60">
          Pay {vendorName} directly, then record it here to hold your date on
          their schedule while they confirm. Setnayan never holds your money —
          this is your own record.
        </p>
      )}

      {/* THE REQUESTED FIRST PAYMENT (owner, 2026-09-19: "i do not see the
          3350 downpayment"). From the accepted quote's schedule; it is the
          minimum the form below accepts. */}
      {owed && firstPaymentOffered && requestedFirstPaymentSentence ? (
        <p className="rounded-md border border-terracotta/25 bg-terracotta/[0.05] px-2.5 py-1.5 text-xs font-medium text-ink">
          {requestedFirstPaymentSentence}
        </p>
      ) : null}
      {owed && firstPaymentOffered && requestedTermsUnreadable ? (
        <p role="status" className="rounded-md border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/70">
          We couldn&rsquo;t load the payment terms from your accepted quote, so the
          first payment {vendorName} asked for isn&rsquo;t shown. Refresh to try again.
        </p>
      ) : null}

      {/* STEP 1 · PAY THEM — the supplier's own destinations, first in the
          reading order, only while a deposit is still owed. The disclosure
          rides inside VendorDirectPay (always-on line + the sheet's locked copy). */}
      {payDue ? (
        <div className="space-y-1.5 pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            1 · Pay {vendorName}
          </p>
          {noMethods ? (
            <p role="note" className="rounded-md border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/70">
              {noMethods}
            </p>
          ) : (
            <VendorDirectPay vendorName={vendorName} methods={payMethods} />
          )}
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            2 · Record it here
          </p>
        </div>
      ) : null}

      {declined && depositDeclineReason ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-2.5 py-1.5 text-[11px] text-ink/75">
          {vendorName}&rsquo;s words: &ldquo;{depositDeclineReason}&rdquo;
        </p>
      ) : null}

      {/* Setnayan checked it by hand (owner 2026-08-28: "we will confirm it
          manually"). Only ever rendered beside a refusal that still stands —
          when the team finds the payment DID arrive the refusal is lifted and
          this card reads as confirmed, which says it better than a sentence. */}
      {declined && depositDisputeNote ? (
        <p className="rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/75">
          Setnayan checked this: &ldquo;{depositDisputeNote}&rdquo; Your record is still on
          file — send it to {vendorName} again below.
        </p>
      ) : null}

      {depositProofUrl ? (
        <a
          href={depositProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-terracotta-700 underline-offset-2 hover:underline"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          View payment proof
        </a>
      ) : null}

      {/* 🔑 A REFUSED CLAIM MUST REOPEN THIS FORM. The CTA used to render only
          when nothing was recorded, which worked ONLY because a refusal deleted
          the record. With the record kept, that condition alone would leave the
          couple told their payment was refused and given no way to answer — a
          fix nobody can reach. Sending again clears the refusal and puts the
          question back in front of the supplier. */}
      {(!recorded || declined) && !open && firstPaymentOffered ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800"
        >
          <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {declined ? 'Send it again' : 'Record payment'}
        </button>
      ) : null}

      {open ? (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-ink">{firstLabel}</p>
            <label htmlFor="deposit_php" className="block text-[11px] font-medium text-ink/70">
              Amount to pay (₱)
            </label>
            <input
              id="deposit_php"
              name="deposit_php"
              type="number"
              min={minimumPhp ?? 1}
              step="0.01"
              required
              inputMode="decimal"
              defaultValue={minimumPhp ?? undefined}
              placeholder={minimumPhp ? undefined : 'e.g. 10000'}
              aria-describedby={minimumPhp ? 'deposit_php_min' : undefined}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
            {minimumPhp ? (
              <p id="deposit_php_min" className="text-[11px] text-ink/55">
                At least ₱{minimumPhp.toLocaleString('en-PH', { maximumFractionDigits: 2 })} — the
                first payment {vendorName} asked for. You may pay more.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="method" className="block text-[11px] font-medium text-ink/70">
                Method <span className="text-ink/40">(optional)</span>
              </label>
              <input
                id="method"
                name="method"
                type="text"
                maxLength={48}
                placeholder="GCash / BDO / cash"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reference" className="block text-[11px] font-medium text-ink/70">
                Reference <span className="text-ink/40">(optional)</span>
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                maxLength={64}
                placeholder="Txn ref"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="proof" className="block text-[11px] font-medium text-ink/70">
              Proof of payment <span className="text-ink/40">(optional — screenshot/receipt)</span>
            </label>
            <input
              id="proof"
              name="proof"
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-xs text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-cream/80"
            />
          </div>

          {errorMsg ? (
            <p role="alert" className="text-[11px] font-medium text-danger-600">
              {errorMsg}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Record payment
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
              disabled={pending}
              className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* THE NEXT INSTALLMENT — after the first payment is confirmed (or when
          money was already logged without one). Prefilled from the accepted
          quote's schedule; a partial payment is still a payment, so there is
          no minimum here — only the FIRST payment has a floor. */}
      {later ? (
        <LaterInstallment
          eventId={eventId}
          vendorId={vendorId}
          vendorName={vendorName}
          label={later.label}
          line={stepLine}
          overdue={later.overdue}
          amountCentavos={later.amountCentavos}
        />
      ) : null}

      {/* NOTHING DUE NOW (owner, live, 2026-09-20: "their next due date is not
          yet today, so there is nothing to record. Pay in advance?"). The same
          one control, opened by a quieter "Pay early" — same action, same
          server rules, no second payment path. */}
      {notDueYet ? (
        <LaterInstallment
          eventId={eventId}
          vendorId={vendorId}
          vendorName={vendorName}
          label={notDueYet.label}
          line={stepLine ?? `Nothing due now · ${notDueYet.label}`}
          notDueYet
          amountCentavos={notDueYet.amountCentavos}
          onOpenChange={setEarlyOpen}
        />
      ) : null}

      {paidInFull ? (
        <p className="rounded-md border border-success-300 bg-success-50 px-2.5 py-1.5 text-xs font-medium text-success-800">
          Paid in full — {pesoFromCentavos(paidInFull.paidCentavos)} per the quote you accepted.
        </p>
      ) : null}

      {/* THE PAYMENTS COULD NOT BE READ. Said out loud, because "unknown" and
          "nothing owed" would otherwise render as the same blank card. */}
      {step && step.kind === 'unknown' && stepLine ? (
        <p role="status" className="rounded-md border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/70">
          {stepLine}
        </p>
      ) : null}

      {/* WHAT HAS ALREADY BEEN PAID — one mount, so the Payments tab and the
          chat quote card (which mounts this card) show the same history. */}
      <PaymentHistoryList history={history} className="border-t border-ink/10 pt-2" />
    </div>
  );
}

/**
 * ONE later-installment control, in three tones:
 *   • due now   — the terracotta line and a "Record payment" button;
 *   • overdue   — the same button, with the line saying the date has passed
 *                 (`moneyStepLine`). No consequence is stated: the code
 *                 implements none;
 *   • not due yet — a quiet line and a text-weight "Pay early" control. Same
 *                 form, same `logScheduledPayment`, same server rules.
 */
function LaterInstallment({
  eventId,
  vendorId,
  vendorName,
  label,
  line = null,
  amountCentavos,
  notDueYet = false,
  overdue = false,
  onOpenChange,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  label: string;
  /** The state's sentence from `moneyStepLine`; falls back to `label`. */
  line?: string | null;
  amountCentavos: number | null;
  notDueYet?: boolean;
  overdue?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const save = useSaveLoader();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    startTransition(async () => {
      const result = await save.run(() => logScheduledPayment(form), {
        steps: ['Recording the payment'],
        hint: 'Saving',
      });
      if (result.status === 'ok') setOpen(false);
      else setErrorMsg(result.message);
    });
  }

  return (
    <div className="space-y-2 border-t border-ink/10 pt-2">
      <p
        className={
          notDueYet
            ? 'rounded-md border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-xs font-medium text-ink/75'
            : overdue
              ? 'rounded-md border border-warn-300 bg-warn-50 px-2.5 py-1.5 text-xs font-medium text-warn-900'
              : 'rounded-md border border-terracotta/25 bg-terracotta/[0.05] px-2.5 py-1.5 text-xs font-medium text-ink'
        }
      >
        {line ?? `${label}${amountCentavos !== null ? ` · ${pesoFromCentavos(amountCentavos)}` : ''}`}
      </p>
      <p className="sr-only">Pay {vendorName} through one of the destinations above, then record it.</p>
      {!open ? (
        notDueYet ? (
          // QUIETER ON PURPOSE: nothing is owed today, so this is an offer, not
          // an instruction. It opens the identical form below.
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream"
          >
            <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Pay early
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800"
          >
            <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Record payment
          </button>
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label htmlFor="later_amount_php" className="block text-[11px] font-medium text-ink/70">
              Amount to pay (₱)
            </label>
            <input
              id="later_amount_php"
              name="amount_php"
              type="number"
              min={0.01}
              step="0.01"
              required
              inputMode="decimal"
              defaultValue={amountCentavos !== null ? amountCentavos / 100 : undefined}
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
            <p className="text-[11px] text-ink/55">
              Paying part of it? Enter what you paid — the rest stays due.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="method"
              maxLength={48}
              aria-label="Method (optional)"
              placeholder="Method (GCash / BDO / cash)"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
            <input
              name="reference"
              maxLength={64}
              aria-label="Reference (optional)"
              placeholder="Reference #"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>
          {/* The same private receipt upload the payment log uses — logPayment
              reads it as `proof_r2_key`. */}
          <FileUpload
            name="proof_r2_key"
            bucket="thread-files"
            pathPrefix={`payment-proof/events/${eventId}`}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            label="Attach receipt (optional)"
            variant="wide"
          />
          {errorMsg ? (
            <p role="alert" className="text-[11px] font-medium text-danger-600">
              {errorMsg}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Record payment
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
              disabled={pending}
              className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
