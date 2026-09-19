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
