/**
 * WHAT THE ACCEPTED QUOTE SAYS IS OWED — one pure rule, read by the couple's
 * booked card, the couple's "Record deposit" action and the supplier's client
 * page.
 *
 * ── THE DEFECT THIS CLOSES (owner, live as testnayan4, 2026-09-19) ──────────
 * "we have set how much is the downpayment but it did not show. it should
 * follow the amount requested and that means that is the minimum."
 *
 * The supplier's quote carried a frozen payment schedule
 * (`vendor_proposals.payment_schedule`, written by `lib/proposal-send.ts`):
 * First payment ₱3,350 on lock, then ₱13,400 fourteen days before the event.
 * The ONLY reader of that column was the public proposal page. The booked card
 * reads `event_vendor_payment_plan`, which is frozen from the supplier's
 * SERVICE template at lock — never from the quote — so a booking that locked
 * through a quote has no plan row and the card showed nothing: an empty
 * "Deposit amount paid" box with "e.g. 10000", no ₱3,350 anywhere, and a
 * LINE ITEMS panel saying the supplier "hasn't shared pricing yet" beside an
 * accepted quote with two priced lines. A request that renders identically to
 * no request.
 *
 * ── THE RULES ───────────────────────────────────────────────────────────────
 *   1. Only an ACCEPTED quote states terms. sent/viewed are offers; superseded,
 *      declined and expired are history. (One accepted quote per event ×
 *      supplier: `supersede_prior_vendor_proposals` retires the old one.)
 *   2. The first payment is the installment flagged `is_downpayment` (seq 0 by
 *      construction in `resolveSchedule`). It is the MINIMUM a recorded deposit
 *      may be — the couple may pay more, never less.
 *   3. No accepted quote, or a quote with no schedule → no minimum, and every
 *      surface keeps its old behaviour.
 *   4. With an accepted quote the quote IS the price: the couple's manual
 *      Costing editor (and its "Log as service price" bridge) does not render,
 *      and `updateVendorCosts` does not write the price columns.
 *
 * Pure: no I/O, never throws on malformed JSON. Executed by
 * `lib/accepted-quote-terms.test.ts`.
 */
import {
  isResolvedSchedule,
  type InstallmentDue,
} from './proposal-payment-schedule';

/** The columns every reader selects — one list, so no reader drops the schedule. */
export const ACCEPTED_QUOTE_SELECT =
  'proposal_id, public_id, title, status, total_centavos, line_items, payment_schedule';

export type AcceptedQuoteRow = {
  proposal_id?: string | null;
  public_id?: string | null;
  title?: string | null;
  status: string | null;
  total_centavos: number | string | null;
  line_items: unknown;
  payment_schedule: unknown;
};

export type QuoteLine = { label: string; detail: string | null; amountCentavos: number };

export type QuoteScheduleRow = {
  label: string;
  amountCentavos: number;
  due: InstallmentDue;
  offsetDays: number;
  isFirstPayment: boolean;
  /** "on lock" · "14 days before the event (Oct 3, 2026)" · "on the event day". */
  dueText: string;
  /** The calendar date alone ("Feb 27, 2027") when the event date is known, else null. */
  dueOn: string | null;
};

export type AcceptedQuoteTerms = {
  publicId: string | null;
  title: string | null;
  totalCentavos: number;
  lines: QuoteLine[];
  schedule: QuoteScheduleRow[];
  /** The requested first payment — the minimum a deposit may be. null = none requested. */
  firstPaymentCentavos: number | null;
};

const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

/** ₱3,350 — whole pesos when whole, else two decimals. */
export function pesoFromCentavos(centavos: number): string {
  const whole = centavos % 100 === 0;
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** When an installment is due, in words — with the calendar date when the event date is known. */
export function installmentDueText(
  due: InstallmentDue,
  offsetDays: number,
  eventDate: string | null | undefined,
): string {
  const at =
    typeof eventDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(eventDate)
      ? new Date(`${eventDate.slice(0, 10)}T00:00:00Z`)
      : null;
  const valid = at && !Number.isNaN(at.getTime()) ? at : null;
  if (due === 'before_event') {
    const d = Math.max(0, int(offsetDays));
    const words = `${d} day${d === 1 ? '' : 's'} before the event`;
    if (!valid) return words;
    const when = new Date(valid.getTime() - d * 86_400_000);
    return `${words} (${shortDate(when)})`;
  }
  if (due === 'on_event') return valid ? `on the event day (${shortDate(valid)})` : 'on the event day';
  return 'on lock';
}

/** The calendar date an installment falls due, when the event date is known. */
export function installmentDueOn(
  due: InstallmentDue,
  offsetDays: number,
  eventDate: string | null | undefined,
): string | null {
  if (due === 'on_lock') return null;
  const at =
    typeof eventDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(eventDate)
      ? new Date(`${eventDate.slice(0, 10)}T00:00:00Z`)
      : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const d = due === 'before_event' ? Math.max(0, int(offsetDays)) : 0;
  return shortDate(new Date(at.getTime() - d * 86_400_000));
}

function readLines(raw: unknown): QuoteLine[] {
  if (!Array.isArray(raw)) return [];
  const out: QuoteLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as { label?: unknown; detail?: unknown; amount_centavos?: unknown };
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!label) continue;
    const detail = typeof o.detail === 'string' && o.detail.trim() ? o.detail.trim() : null;
    out.push({ label, detail, amountCentavos: Math.max(0, int(o.amount_centavos)) });
  }
  return out;
}

/**
 * The terms of the accepted quote among `rows`, or null when none is accepted.
 * Rows of any other status are ignored — an offer is not an agreement.
 */
export function acceptedQuoteTerms(
  rows: readonly AcceptedQuoteRow[] | null | undefined,
  eventDate?: string | null,
): AcceptedQuoteTerms | null {
  const accepted = (rows ?? []).find((r) => r?.status === 'accepted');
  if (!accepted) return null;

  const schedule: QuoteScheduleRow[] = [];
  let firstPaymentCentavos: number | null = null;
  if (isResolvedSchedule(accepted.payment_schedule)) {
    const installments = [...accepted.payment_schedule.installments].sort(
      (a, b) => int(a.seq) - int(b.seq),
    );
    for (const i of installments) {
      const amount = Math.max(0, int(i.amount_centavos));
      const due: InstallmentDue =
        i.due === 'before_event' || i.due === 'on_event' ? i.due : 'on_lock';
      const isFirst = i.is_downpayment === true;
      schedule.push({
        label: String(i.label ?? '').trim() || (isFirst ? 'First payment' : 'Payment'),
        amountCentavos: amount,
        due,
        offsetDays: Math.max(0, int(i.offset_days)),
        isFirstPayment: isFirst,
        dueText: installmentDueText(due, int(i.offset_days), eventDate),
        dueOn: installmentDueOn(due, int(i.offset_days), eventDate),
      });
      if (isFirst && firstPaymentCentavos === null && amount > 0) firstPaymentCentavos = amount;
    }
  }

  return {
    publicId: accepted.public_id ?? null,
    title: accepted.title?.trim() || null,
    totalCentavos: Math.max(0, int(accepted.total_centavos)),
    lines: readLines(accepted.line_items),
    schedule,
    firstPaymentCentavos,
  };
}

/** "First payment requested: ₱3,350 — due on lock", or null when none was requested. */
export function firstPaymentSentence(terms: AcceptedQuoteTerms | null): string | null {
  if (!terms || terms.firstPaymentCentavos === null) return null;
  const row = terms.schedule.find((s) => s.isFirstPayment);
  return `First payment requested: ${pesoFromCentavos(terms.firstPaymentCentavos)} — due ${row?.dueText ?? 'on lock'}`;
}

export type DepositAmountDecision =
  | { ok: true; amountCentavos: number }
  | { ok: false; message: string };

/**
 * May this recorded deposit stand? The ACTION's decision, executed by the test.
 * `minimumCentavos` null = no first payment was requested (today's behaviour:
 * any positive amount).
 */
export function decideDepositAmount(args: {
  amountPhp: number | null;
  minimumCentavos: number | null;
  vendorName?: string | null;
}): DepositAmountDecision {
  const { amountPhp, minimumCentavos } = args;
  if (amountPhp === null || !Number.isFinite(amountPhp) || amountPhp <= 0) {
    return { ok: false, message: 'Enter the deposit amount you paid.' };
  }
  const amountCentavos = Math.round(amountPhp * 100);
  if (minimumCentavos !== null && minimumCentavos > 0 && amountCentavos < minimumCentavos) {
    const who = args.vendorName?.trim() || 'Your supplier';
    return {
      ok: false,
      message: `${who} asked for a first payment of ${pesoFromCentavos(minimumCentavos)}. Record at least that amount — you may pay more, not less. If you agreed a different amount, ask them to update the quote.`,
    };
  }
  return { ok: true, amountCentavos };
}

/**
 * Does the couple's manual Costing editor render for this booking?
 * No: an accepted marketplace quote settles the price — it is the one source.
 * Yes: manual / off-platform suppliers, and any booking with no accepted quote.
 */
export function manualCostingEditorShown(args: {
  isMarketplaceVendor: boolean;
  acceptedQuote: AcceptedQuoteTerms | null;
}): boolean {
  return !(args.isMarketplaceVendor && args.acceptedQuote !== null);
}

/**
 * Which schedule the couple's Payments section draws. A booking has at most
 * one schedule on screen, so two surfaces can never quote the couple two
 * different amounts for the same money.
 *   • 'plan'  — a real per-booking plan the supplier set (frozen at lock).
 *   • 'quote' — the accepted quote's schedule. Wins over no plan at all AND
 *               over a default-seeded 50/50 ESTIMATE, which is exactly the
 *               "hasn't set payment terms yet" guess an accepted quote answers.
 *   • 'none'  — neither.
 */
export function paymentScheduleSource(args: {
  planStepCount: number | null;
  planIsEstimate: boolean;
  acceptedQuote: AcceptedQuoteTerms | null;
}): 'plan' | 'quote' | 'none' {
  const hasQuote = (args.acceptedQuote?.schedule.length ?? 0) > 0;
  const hasPlan = (args.planStepCount ?? 0) > 0;
  if (hasPlan && !args.planIsEstimate) return 'plan';
  if (hasQuote) return 'quote';
  return hasPlan ? 'plan' : 'none';
}

/**
 * What the LINE ITEMS panel leads with. The "hasn't shared pricing yet" empty
 * state is a claim that NO price exists; it may never render beside an
 * accepted quote that carries priced lines (owner, live 2026-09-19).
 */
export function lineItemsPanelLead(args: {
  priceSource: 'manual' | 'package' | 'service' | 'pending';
  hasVendorControlled: boolean;
  quoteLines: readonly QuoteLine[] | null;
}): 'catalogue' | 'quote' | 'pending' | 'none' {
  if ((args.quoteLines?.length ?? 0) > 0) return 'quote';
  if (args.hasVendorControlled) return 'catalogue';
  if (args.priceSource === 'pending') return 'pending';
  return 'none';
}

export type SupplierFirstPaymentStatus =
  | { state: 'not_recorded'; line: string }
  | { state: 'recorded_short'; line: string }
  | { state: 'recorded'; line: string }
  | { state: 'confirmed'; line: string }
  | { state: 'refused'; line: string };

/**
 * The SUPPLIER's end of the same fact (every connection has both ends): what
 * they asked for, and whether the couple has recorded it. `recordedPhp` is the
 * `is_deposit_record` ledger row (`recordedDepositPhp`), null = none on file.
 * Returns null when the accepted quote requested no first payment.
 */
export function supplierFirstPaymentStatus(args: {
  terms: AcceptedQuoteTerms | null;
  recordedPhp: number | null;
  recordedAt: string | null;
  acknowledgedAt: string | null;
  declinedAt: string | null;
}): SupplierFirstPaymentStatus | null {
  const min = args.terms?.firstPaymentCentavos ?? null;
  if (min === null) return null;
  const asked = pesoFromCentavos(min);
  if (!args.recordedAt) {
    return { state: 'not_recorded', line: `You asked for ${asked}. Not recorded by the couple yet.` };
  }
  const got =
    args.recordedPhp === null ? 'an amount' : pesoFromCentavos(Math.round(args.recordedPhp * 100));
  if (args.acknowledgedAt) {
    return { state: 'confirmed', line: `You asked for ${asked}. They recorded ${got}, and you confirmed it.` };
  }
  if (args.declinedAt) {
    return { state: 'refused', line: `You asked for ${asked}. They recorded ${got}; you said it hasn't reached you.` };
  }
  if (args.recordedPhp !== null && Math.round(args.recordedPhp * 100) < min) {
    // Only a deposit recorded before the minimum was enforced can land here.
    return { state: 'recorded_short', line: `You asked for ${asked}. They recorded ${got} — less than you asked for.` };
  }
  return { state: 'recorded', line: `You asked for ${asked}. They recorded ${got} — confirm below once it reaches you.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE FIRST PAYMENT, ONE DOOR (2026-09-20 · follow-ups to #5717).
//
// Two couple actions write `event_vendor_payments`: "Record deposit"
// (`recordDeposit`) and "+ Log a payment" (`logPayment`). Only the first holds
// the date, notifies the supplier, stamps `deposit_recorded_at`, and (through
// `stamp_event_vendor_payment_deposit_record`) marks its row as THE deposit. A
// first payment logged through the second door counted as Paid, held nothing,
// and left the deposit card saying the deposit was still owed — and recording
// it there afterwards counted the same money twice.
//
// The shipped design already has ONE place for the first payment: the deposit
// card, with its own anchor and link (`depositStepHref`, lib/deposit-pay-step.ts
// — "Pay your deposit" everywhere else in the app routes there). So the second
// door ROUTES to it rather than hiding: the couple is told where the first
// payment goes, and the log opens for later installments once it is recorded.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which door "+ Log a payment" (the itemization card on the Payments tab and
 * /budget) is for this booking:
 *   • 'log'           — log a payment here. Off-platform suppliers: no one
 *                       confirms a deposit and there is no shared calendar.
 *   • 'amount_to_pay' — a Setnayan supplier. Their ONE visible door is the
 *                       "Amount to pay" card (owner, 2026-09-20: "it is better
 *                       to say amount to pay. since this is not just for the
 *                       downpayment but also for the next payments"), which
 *                       takes the first payment through `recordDeposit` and
 *                       later ones through `logPayment` — `moneyStep` decides
 *                       which. The log here points there instead of being a
 *                       second way in.
 *   • 'unknown'       — the booking row could not be read. NOT 'log': logging
 *                       blind is exactly how a first payment slipped past the
 *                       deposit.
 */
export type PaymentDoor = 'log' | 'amount_to_pay' | 'unknown';

export function paymentDoor(args: {
  isMarketplaceVendor: boolean;
  /** `event_vendors.deposit_recorded_at`; undefined = not read. */
  depositRecordedAt: string | null | undefined;
}): PaymentDoor {
  if (!args.isMarketplaceVendor) return 'log';
  if (args.depositRecordedAt === undefined) return 'unknown';
  return 'amount_to_pay';
}

export type LogPaymentInput = {
  isMarketplaceVendor: boolean;
  /** `event_vendors.deposit_recorded_at`; undefined = not read. */
  depositRecordedAt: string | null | undefined;
  /** Rows on this booking's ledger; null = the read was refused. */
  paymentsOnLedger: number | null;
};

/** `logPayment`'s decision — the same rule the card draws, enforced on the server. */
/**
 * `logPayment`'s decision — enforced on the server whichever screen posted.
 * A Setnayan supplier's FIRST payment (no deposit recorded, nothing on the
 * ledger) may only go through `recordDeposit`: that is the write that holds
 * the date, asks the supplier to confirm, and marks the row as THE deposit.
 * Later payments, off-platform suppliers, and a booking that already has money
 * on the ledger (which `decideDepositRecord` will not re-record) may log.
 * A refused read refuses — it cannot tell a first payment from a later one.
 */
export function decideLogPayment(
  args: LogPaymentInput & { vendorName?: string | null },
): { ok: true } | { ok: false; reason: 'first_payment' | 'unknown'; message: string } {
  if (!args.isMarketplaceVendor) return { ok: true };
  const who = args.vendorName?.trim() || 'this supplier';
  if (args.depositRecordedAt === undefined || (!args.depositRecordedAt && args.paymentsOnLedger === null)) {
    return {
      ok: false,
      reason: 'unknown',
      message: `We couldn't check your payments to ${who}, so nothing was logged. Please try again.`,
    };
  }
  if (!args.depositRecordedAt && args.paymentsOnLedger === 0) {
    return {
      ok: false,
      reason: 'first_payment',
      message: `This is your first payment to ${who}. Record it under "Amount to pay" on their Payments tab, so your date is held and they're asked to confirm it.`,
    };
  }
  return { ok: true };
}

/**
 * `recordDeposit`'s ledger decision. May this record stand, and does it add a
 * ledger row?
 *   • already recorded → yes, NO new row (a re-send keeps the one deposit row;
 *     this was the inline `if (!ev.deposit_recorded_at)` guard).
 *   • not recorded, ledger unreadable → refuse (fail closed).
 *   • not recorded, money already logged → refuse: that money is already on
 *     the ledger, and recording it here would count it twice. The couple is
 *     told how to turn it into the deposit instead.
 *   • not recorded, empty ledger → yes, one row.
 */
export function decideDepositRecord(args: {
  depositRecordedAt: string | null;
  paymentsOnLedger: number | null;
  paymentsLoggedPhp?: number | null;
  vendorName?: string | null;
}): { ok: true; insertLedgerRow: boolean } | { ok: false; message: string } {
  if (args.depositRecordedAt) return { ok: true, insertLedgerRow: false };
  if (args.paymentsOnLedger === null) {
    return {
      ok: false,
      message: "We couldn't check your payments to this supplier, so nothing was recorded. Please try again.",
    };
  }
  if (args.paymentsOnLedger > 0) {
    const who = args.vendorName?.trim() || 'this supplier';
    const amount =
      typeof args.paymentsLoggedPhp === 'number' && args.paymentsLoggedPhp > 0
        ? ` (${pesoFromCentavos(Math.round(args.paymentsLoggedPhp * 100))})`
        : '';
    return {
      ok: false,
      message: `You've already logged a payment to ${who}${amount}, so recording a deposit now would count that money twice. If that payment was your deposit, delete it from your payments list, then record it here.`,
    };
  }
  return { ok: true, insertLedgerRow: true };
}

export type NextQuoteInstallment = {
  label: string;
  /** What is still owed on THIS installment, after what is already paid. */
  amountCentavos: number;
  dueText: string;
  dueOn: string | null;
  isFirstPayment: boolean;
};

/**
 * The next installment the accepted quote asks for, given what has been paid.
 * Payments settle the schedule in order: ₱3,350 paid against [₱3,350 on lock,
 * ₱13,400 before the event] → next is the ₱13,400 balance; ₱5,000 paid → ₱11,750
 * of it. A PREFILL only — a partial payment is allowed (no rule in the code
 * says otherwise; the minimum applies to the first payment alone).
 * null = no schedule, all paid, or `paidCentavos` unknown (never prefill a
 * guess from a refused read).
 */
export function nextQuoteInstallment(
  terms: AcceptedQuoteTerms | null,
  paidCentavos: number | null,
): NextQuoteInstallment | null {
  if (!terms || terms.schedule.length === 0 || paidCentavos === null) return null;
  let cumulative = 0;
  for (const row of terms.schedule) {
    cumulative += row.amountCentavos;
    if (paidCentavos < cumulative) {
      return {
        label: row.label,
        amountCentavos: Math.min(row.amountCentavos, cumulative - paidCentavos),
        dueText: row.dueText,
        dueOn: row.dueOn,
        isFirstPayment: row.isFirstPayment,
      };
    }
  }
  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// THE NEXT MONEY STEP — one answer for every surface that shows a booked
// supplier's money: the "Amount to pay" card on the Payments tab, the chat
// quote card (both ends), and the public proposal page (owner, live,
// 2026-09-20: "i do not see the confirmation here and the payment action?").
// ─────────────────────────────────────────────────────────────────────────────

export type MoneyStepInput = {
  terms: AcceptedQuoteTerms | null;
  /** The booking is locked (a CONFIRMED status). Before that nothing is owed. */
  booked: boolean;
  /** The booking's deposit markers; undefined = the row could not be read. */
  deposit:
    | { recordedAt: string | null; acknowledgedAt: string | null; declinedAt: string | null }
    | undefined;
  /**
   * The booking's ledger; null = the read was refused. `paidCentavos` counts
   * every logged row; `recordedFirstCentavos` is the `is_deposit_record` row.
   */
  ledger: { count: number; paidCentavos: number; recordedFirstCentavos: number | null } | null;
};

export type MoneyStep =
  | { kind: 'not_booked' }
  | { kind: 'unknown' }
  /** Pay and record the first payment — `recordDeposit`, its minimum enforced. */
  | {
      kind: 'first_payment_due';
      action: 'record_deposit';
      label: string;
      amountCentavos: number | null;
      minimumCentavos: number | null;
      /** The supplier said it never arrived; this is "send it again". */
      resend: boolean;
    }
  /** Recorded; the supplier has not confirmed. Nothing more to pay yet. */
  | { kind: 'first_payment_sent'; recordedCentavos: number | null }
  /** A later installment — `logPayment`, prefilled, never a minimum. */
  | {
      kind: 'installment_due';
      action: 'log_payment';
      label: string;
      amountCentavos: number | null;
      firstConfirmed: boolean;
    }
  | { kind: 'paid_in_full'; paidCentavos: number };

function firstPaymentLabel(terms: AcceptedQuoteTerms | null): string {
  const row = terms?.schedule.find((r) => r.isFirstPayment);
  return `${row?.label || 'First payment'} · locks the date`;
}

function laterStep(
  terms: AcceptedQuoteTerms | null,
  paidCentavos: number | null,
  firstConfirmed: boolean,
): MoneyStep {
  const next = nextQuoteInstallment(terms, paidCentavos);
  if (next) {
    return {
      kind: 'installment_due',
      action: 'log_payment',
      label: `${next.label} · due ${next.dueOn ?? next.dueText}`,
      amountCentavos: next.amountCentavos,
      firstConfirmed,
    };
  }
  if (terms && terms.schedule.length > 0 && paidCentavos !== null) {
    return { kind: 'paid_in_full', paidCentavos };
  }
  // No schedule to read (or the ledger was refused): still a door, no prefill.
  return { kind: 'installment_due', action: 'log_payment', label: 'Next payment', amountCentavos: null, firstConfirmed };
}

export function moneyStep(input: MoneyStepInput): MoneyStep {
  if (!input.booked) return { kind: 'not_booked' };
  const dep = input.deposit;
  if (dep === undefined) return { kind: 'unknown' };
  const paid = input.ledger ? input.ledger.paidCentavos : null;
  if (dep.acknowledgedAt) return laterStep(input.terms, paid, true);
  if (dep.recordedAt && dep.declinedAt) {
    return {
      kind: 'first_payment_due',
      action: 'record_deposit',
      label: firstPaymentLabel(input.terms),
      amountCentavos: input.ledger?.recordedFirstCentavos ?? input.terms?.firstPaymentCentavos ?? null,
      minimumCentavos: input.terms?.firstPaymentCentavos ?? null,
      resend: true,
    };
  }
  if (dep.recordedAt) {
    return { kind: 'first_payment_sent', recordedCentavos: input.ledger?.recordedFirstCentavos ?? null };
  }
  if (!input.ledger) return { kind: 'unknown' };
  // Money already logged with no deposit recorded (older rows, or the Budget
  // page's "already paid"): `decideDepositRecord` will not record it again, so
  // the next step is the next installment after it.
  if (input.ledger.count > 0) return laterStep(input.terms, paid, false);
  return {
    kind: 'first_payment_due',
    action: 'record_deposit',
    label: firstPaymentLabel(input.terms),
    amountCentavos: input.terms?.firstPaymentCentavos ?? null,
    minimumCentavos: input.terms?.firstPaymentCentavos ?? null,
    resend: false,
  };
}

/**
 * The one line each end reads about the step — the couple's and the
 * supplier's ends of the same fact. null = nothing to say (not booked).
 */
export function moneyStepLine(
  step: MoneyStep,
  viewer: 'couple' | 'vendor',
  otherName: string,
): string | null {
  const amt = (c: number | null) => (c === null ? 'the payment' : pesoFromCentavos(c));
  const couple = viewer === 'couple';
  switch (step.kind) {
    case 'not_booked':
      return null;
    case 'unknown':
      return couple
        ? "We couldn't load your payments here. Open the Payments tab to see what is due."
        : "We couldn't load this booking's payments here. Open the client to see them.";
    case 'first_payment_due':
      if (step.resend) {
        return couple
          ? `${otherName} says your first payment hasn't reached them. Your record is kept — send it again.`
          : `You said the first payment hasn't reached you. Waiting for the couple to send it again.`;
      }
      return couple
        ? `First payment ${amt(step.amountCentavos)} — due now`
        : `Waiting for the ${amt(step.amountCentavos)} first payment`;
    case 'first_payment_sent':
      return couple
        ? `${amt(step.recordedCentavos)} recorded — waiting for ${otherName} to confirm`
        : `${amt(step.recordedCentavos)} recorded by the couple — confirm once it reaches you`;
    case 'installment_due': {
      const lead = step.firstConfirmed ? 'First payment confirmed. ' : '';
      const what = step.amountCentavos === null ? step.label : `${step.label} · ${pesoFromCentavos(step.amountCentavos)}`;
      return couple ? `${lead}Amount to pay: ${what}` : `${lead}Next from the couple: ${what}`;
    }
    case 'paid_in_full':
      return `Paid in full — ${pesoFromCentavos(step.paidCentavos)}`;
  }
}

/**
 * The closing sentence of the note `lib/proposal-send.ts` writes when the
 * supplier typed none — imported there, so the two cannot drift. True before a
 * booking; FALSE after one (owner, live, 2026-09-20: the booked quote's page
 * still said "nothing is booked or paid until you Lock").
 */
export const DEFAULT_QUOTE_NOTE_TAIL =
  'Accepting shortlists them at this price so you can compare — nothing is booked or paid until you Lock.';

/**
 * The quote's note as the page should show it. A supplier's own words are
 * always shown; the DEFAULT note's pre-booking sentence is dropped once the
 * booking is real, because it is no longer true.
 */
export function quoteNoteShown(body: string | null | undefined, booked: boolean): string {
  const text = (body ?? '').trim();
  if (!booked || !text.endsWith(DEFAULT_QUOTE_NOTE_TAIL)) return text;
  return text.slice(0, text.length - DEFAULT_QUOTE_NOTE_TAIL.length).trim();
}
