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

import { useId, useState, useTransition } from 'react';
import { CalendarCheck, FileText, Loader2, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { recordDeposit } from '../../../actions';
import { logScheduledPayment } from '@/app/dashboard/[eventId]/budget/actions';
import { FileUpload } from '@/app/_components/file-upload';
import { moneyStepLine, pesoFromCentavos, type MoneyStep } from '@/lib/accepted-quote-terms';
import { PaymentHistoryList } from '@/app/_components/payment-history-list';
import type { PaymentHistory } from '@/lib/payment-history';
import { ProofImage } from '@/app/_components/proof-image';
import { ChosenProofField } from '@/app/_components/chosen-proof-field';
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
   * The Pay sheet already lists HOW TO PAY THEM from the couple's own record of a supplier they added (2026-10-29),
   * so "isn't on Setnayan, so their payment details aren't here" would contradict the ways right above it.
   */
  ownWaysShown?: boolean;
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
  /**
   * 📐 The log form RISES AS A SHEET (design template 2026-11-14, "Supplier Payment · after · logging") — the
   * workspace's Payment page only. Off where this card is itself inside a sheet (the Suppliers pay sheet) or a
   * chat bubble, where a sheet over a sheet would trap the couple: there it opens in place, as before.
   */
  logInSheet?: boolean;
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
  ownWaysShown = false,
  requestedFirstPaymentCentavos = null,
  requestedFirstPaymentSentence = null,
  requestedTermsUnreadable = false,
  step = null,
  history = null,
  compact = false,
  logInSheet = false,
}: Props) {
  const minimumPhp =
    requestedFirstPaymentCentavos && requestedFirstPaymentCentavos > 0
      ? requestedFirstPaymentCentavos / 100
      : null;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const save = useSaveLoader();
  const logTitleId = useId();

  const recorded = Boolean(depositRecordedAt);
  const acked = Boolean(depositAcknowledgedAt);
  const declined = Boolean(depositDeclinedAt);
  // Still owed: nothing recorded, or the supplier said it never arrived.
  // Confirmed or awaiting an answer → paying again is not the next step.
  const owed = (!recorded || declined) && !acked;
  const noMethods = noPayMethodsSentence(payMethodsState, payMethods.length, vendorName);
  const firstLabel =
    step && step.kind === 'first_payment_due' ? step.label : 'First payment · books the date';
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

  // The amount the top of the card shows big — what is due now, or the installment that is coming.
  const heroCentavos: number | null =
    later?.amountCentavos ??
    notDueYet?.amountCentavos ??
    (owed && firstPaymentOffered && requestedFirstPaymentCentavos ? requestedFirstPaymentCentavos : null);

  // ONE log form — in place, or in a sheet on the workspace's Payment page (`logInSheet`).
  const logForm = (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-[15px] font-semibold text-ink">{firstLabel}</p>
            <label htmlFor="deposit_php" className="block text-[13px] font-medium text-[color:var(--m-slate-2)]">
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
              className="sn-input min-h-12 w-full"
            />
            {minimumPhp ? (
              <p id="deposit_php_min" className="text-[13px] text-[color:var(--m-slate-2)]">
                At least ₱{minimumPhp.toLocaleString('en-PH', { maximumFractionDigits: 2 })} — the
                first payment {vendorName} asked for. You may pay more.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="method" className="block text-[13px] font-medium text-[color:var(--m-slate-2)]">
                Method <span className="text-[color:var(--m-slate-2)]">(optional)</span>
              </label>
              <input
                id="method"
                name="method"
                type="text"
                maxLength={48}
                placeholder="GCash / BDO / cash"
                className="sn-input min-h-12 w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reference" className="block text-[13px] font-medium text-[color:var(--m-slate-2)]">
                Reference <span className="text-[color:var(--m-slate-2)]">(optional)</span>
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                maxLength={64}
                placeholder="Txn ref"
                className="sn-input min-h-12 w-full"
              />
            </div>
          </div>

          {/* The same `<input type="file" name="proof">`, still read by
              `recordDeposit` out of this form's own FormData — with the picture
              you just chose shown at a size you can actually check, its name and
              size, and a Remove that clears the INPUT and not just the preview.
              See app/_components/chosen-proof-field.tsx. */}
          <ChosenProofField
            id="proof"
            name="proof"
            label={
              <>
                Proof of payment{' '}
                <span className="text-[color:var(--m-slate-2)]">(optional — screenshot/receipt)</span>
              </>
            }
          />

          {errorMsg ? (
            <p role="alert" className="text-[13px] font-medium" style={{ color: 'rgb(var(--color-danger))' }}>
              {errorMsg}
            </p>
          ) : null}

          <EqualRow>
            <ActionButton
              tone="neutral"
              icon={X}
              label="Cancel"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
            />
            <ActionButton
              tone="brand"
              main
              icon={pending ? Loader2 : CalendarCheck}
              label="Record payment"
              type="submit"
              disabled={pending}
            />
          </EqualRow>
        </form>
  );

  return (
    <div
      id={DEPOSIT_ANCHOR_ID}
      className={
        compact
          ? 'space-y-2 pt-1'
          : 'scroll-mt-24 space-y-3 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-4'
      }
    >
      {/* 📐 THE TOP OF THE PAGE (design template 2026-11-14, rule 13 "strength, not pale"): the one thing that
          matters now, on the warm surface — its label with the explaining behind ⓘ (rule 7), the amount BIG in full
          ink, what it is, and a chip for where it stands (rule 5). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InfoTip
          label={recorded && !declined && !later && !notDueYet ? 'You logged' : 'Amount to pay'}
          labelClassName="text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--m-slate-2)]"
          align="start"
        >
          {recorded
            ? `First payment recorded ${fmtDate(depositRecordedAt)} — your date is held on ${vendorName}’s schedule.`
            : `Pay ${vendorName} directly, then record it here to hold your date on their schedule while they confirm. Setnayan never holds your money — this is your own record.`}
        </InfoTip>

        {acked ? (
          <Badge tone="ok">Confirmed by supplier</Badge>
        ) : declined ? (
          <Badge tone="no">Hasn&rsquo;t reached them</Badge>
        ) : recorded ? (
          <Badge tone="wait">Waiting to confirm</Badge>
        ) : null}
      </div>

      {heroCentavos !== null ? (
        <p className="text-[34px] font-extrabold leading-none tabular-nums text-ink" data-amount-to-pay={heroCentavos}>
          {pesoFromCentavos(heroCentavos)}
        </p>
      ) : null}

      {recorded ? (
        <p className="text-[13px] leading-snug text-[color:var(--m-slate-2)]">
          <b className="block text-[15px] font-semibold text-ink">First payment · your date is held</b>
          {acked
            ? `Confirmed by ${vendorName} on ${fmtDate(depositAcknowledgedAt)}.`
            : declined
              ? `On ${fmtDate(depositDeclinedAt)} they said it hadn’t reached them. Your record here is kept — a transfer can be slow, or arrive under a different name.`
              : `Logged ${fmtDate(depositRecordedAt)} · waiting for ${vendorName} to confirm.`}
        </p>
      ) : owed && firstPaymentOffered ? (
        <p className="text-[13px] leading-snug text-[color:var(--m-slate-2)]">
          <b className="block text-[15px] font-semibold text-ink">{firstLabel}</b>
          Holds your date on {vendorName}&rsquo;s schedule
        </p>
      ) : null}

      {/* THE REQUESTED FIRST PAYMENT (owner, 2026-09-19: "i do not see the
          3350 downpayment"). From the accepted quote's schedule; it is the
          minimum the form below accepts. */}
      {owed && firstPaymentOffered && requestedFirstPaymentSentence ? (
        <p className="text-[13px] leading-snug text-[color:var(--m-slate-2)]">
          {requestedFirstPaymentSentence}
        </p>
      ) : null}
      {owed && firstPaymentOffered && requestedTermsUnreadable ? (
        <p role="status" className="text-[13px] leading-snug" style={{ color: 'rgb(var(--color-warn))' }}>
          We couldn&rsquo;t load the payment terms from your accepted quote, so the
          first payment {vendorName} asked for isn&rsquo;t shown. Refresh to try again.
        </p>
      ) : null}

      {/* STEP 1 · PAY THEM — the supplier's own destinations, first in the
          reading order, only while a deposit is still owed. The disclosure
          rides inside VendorDirectPay (always-on line + the sheet's locked copy). */}
      {payDue ? (
        <div className="space-y-2 pt-1">
          {ownWaysShown ? (
            <p className="text-[13px] text-[color:var(--m-slate-2)]">Pay them one of the ways above, then record it here.</p>
          ) : noMethods ? (
            <p role="note" className="text-[13px] text-[color:var(--m-slate-2)]">
              {noMethods}
            </p>
          ) : (
            /* 🔑 THE FIGURE THE SUPPLIER ASKED FOR RIDES INTO THE CODE.
               `minimumPhp` is the accepted quote's first payment — the same
               number the form below defaults to and refuses to go under — so
               the QR in the sheet carries exactly what the couple is being
               asked for. Null when the quote's terms could not be read, and
               then the sheet says the amount must be typed. */
            <VendorDirectPay
              vendorName={vendorName}
              methods={payMethods}
              amountPhp={minimumPhp}
            />
          )}
        </div>
      ) : null}

      {declined && depositDeclineReason ? (
        <p className="text-[13px] leading-snug" style={{ color: 'rgb(var(--color-danger))' }}>
          {vendorName}&rsquo;s words: &ldquo;{depositDeclineReason}&rdquo;
        </p>
      ) : null}

      {/* Setnayan checked it by hand (owner 2026-08-28: "we will confirm it
          manually"). Only ever rendered beside a refusal that still stands —
          when the team finds the payment DID arrive the refusal is lifted and
          this card reads as confirmed, which says it better than a sentence. */}
      {declined && depositDisputeNote ? (
        <p className="text-[13px] leading-snug text-[color:var(--m-slate-2)]">
          Setnayan checked this: &ldquo;{depositDisputeNote}&rdquo; Your record is still on
          file — send it to {vendorName} again below.
        </p>
      ) : null}

      {/* ── THE RECEIPT YOU SENT, BIG ENOUGH TO READ (owner, live, 2026-09-20:
          "when i upload a photo, i cannot see it. it is too small") ──────────
          This was the words "View payment proof" and nothing else. The couple
          could not check from here that the right screenshot went to the
          supplier who is about to accept or refuse it, and on a phone the new
          tab replaced the card they were reading. Same picture, same size, as
          every other screen that shows this file (app/_components/proof-image).
          `depositProofUrl` is ALREADY a short-lived presigned link — the page
          signs it through `depositProofDisplayUrl` — so nothing here is public. */}
      {depositProofUrl ? (
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            The proof you sent
          </p>
          <ProofImage url={depositProofUrl} alt="The payment proof you sent" />
        </div>
      ) : null}

      {/* 🔑 A REFUSED CLAIM MUST REOPEN THIS FORM. The CTA used to render only
          when nothing was recorded, which worked ONLY because a refusal deleted
          the record. With the record kept, that condition alone would leave the
          couple told their payment was refused and given no way to answer — a
          fix nobody can reach. Sending again clears the refusal and puts the
          question back in front of the supplier. */}
      {(!recorded || declined) && !open && firstPaymentOffered ? (
        // 📐 The SECOND button (rule 3): outlined, under the one terracotta Pay. A refusal makes it the main one.
        <ActionButton
          tone="brand"
          main={declined || !payDue || noMethods !== null}
          icon={CalendarCheck}
          label={declined ? 'Send it again' : 'Record payment'}
          name={declined ? `Send it again to ${vendorName}` : 'I already paid — record it'}
          type="button"
          aria-haspopup={logInSheet ? 'dialog' : undefined}
          onClick={() => setOpen(true)}
          className="w-full"
        />
      ) : null}

      {open && logInSheet ? (
        <Sheet open onClose={() => setOpen(false)} labelledById={logTitleId} rise>
          <div className="px-4 pb-5 pt-1">
            <h2 id={logTitleId} className="mb-2 text-[19px] font-extrabold text-ink">
              Log your payment
            </h2>
            {logForm}
          </div>
        </Sheet>
      ) : open ? (
        logForm
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
        <p className="text-[15px] font-semibold" style={{ color: 'rgb(var(--color-ok))' }}>
          Paid in full — {pesoFromCentavos(paidInFull.paidCentavos)} per the quote you accepted.
        </p>
      ) : null}

      {/* THE PAYMENTS COULD NOT BE READ. Said out loud, because "unknown" and
          "nothing owed" would otherwise render as the same blank card. */}
      {step && step.kind === 'unknown' && stepLine ? (
        <p role="status" className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {stepLine}
        </p>
      ) : null}

      {/* WHAT HAS ALREADY BEEN PAID — one mount, so the Payments tab and the
          chat quote card (which mounts this card) show the same history. */}
      <PaymentHistoryList history={history} className="border-t border-[color:var(--m-line)] pt-2" />
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
    <div className="space-y-2 border-t border-[color:var(--m-line)] pt-2">
      <p
        className="text-[13px] font-medium leading-snug text-[color:var(--m-slate-2)]"
        style={overdue && !notDueYet ? { color: 'rgb(var(--color-warn))' } : undefined}
      >
        {line ?? `${label}${amountCentavos !== null ? ` · ${pesoFromCentavos(amountCentavos)}` : ''}`}
      </p>
      <p className="sr-only">Pay {vendorName} through one of the destinations above, then record it.</p>
      {!open ? (
        notDueYet ? (
          // QUIETER ON PURPOSE: nothing is owed today, so this is an offer, not
          // an instruction. It opens the identical form below.
          <ActionButton tone="neutral" icon={CalendarCheck} label="Pay early" type="button" onClick={() => setOpen(true)} />
        ) : (
          <ActionButton tone="brand" icon={CalendarCheck} label="Record payment" type="button" onClick={() => setOpen(true)} className="w-full" />
        )
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label htmlFor="later_amount_php" className="block text-[13px] font-medium text-[color:var(--m-slate-2)]">
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
              className="sn-input min-h-12 w-full"
            />
            <p className="text-[13px] text-[color:var(--m-slate-2)]">
              Paying part of it? Enter what you paid — the rest stays due.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="method"
              maxLength={48}
              aria-label="Method (optional)"
              placeholder="Method (GCash / BDO / cash)"
              className="sn-input min-h-12 w-full"
            />
            <input
              name="reference"
              maxLength={64}
              aria-label="Reference (optional)"
              placeholder="Reference #"
              className="sn-input min-h-12 w-full"
            />
          </div>
          {/* The same private receipt upload the payment log uses — logPayment
              reads it as `proof_r2_key`. */}
          <FileUpload
            name="proof_r2_key"
            unsavedHint="press Record payment below"
            bucket="thread-files"
            pathPrefix={`payment-proof/events/${eventId}`}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            label="Attach receipt (optional)"
            variant="wide"
            /* A receipt is checked by LOOKING at it, never by its filename —
               owner, live, 2026-09-20. See the prop in file-upload.tsx. */
            bigPreview
          />
          {errorMsg ? (
            <p role="alert" className="text-[13px] font-medium" style={{ color: 'rgb(var(--color-danger))' }}>
              {errorMsg}
            </p>
          ) : null}
          <EqualRow>
            <ActionButton
              tone="neutral"
              icon={X}
              label="Cancel"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
            />
            <ActionButton tone="brand" main icon={pending ? Loader2 : CalendarCheck} label="Record payment" type="submit" disabled={pending} />
          </EqualRow>
        </form>
      )}
    </div>
  );
}
