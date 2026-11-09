/**
 * 🪜 THE STEP-BY-STEP CHAT CARDS — their rules, pure (Supplier Build 3 · lane C).
 *
 * Every rule a lane-C card draws from lives here, once, so the card, the full tab page and the server read the SAME
 * answer (owner, 8 Nov: "two faces of one record"). No I/O. Money is whole CENTAVOS throughout.
 *
 * The rulings (plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md · DECISION_LOG 2026-11-08 / 09):
 *   🧾 the paid quotation is the floor — a change may never bring the total below it; before any payment, no floor.
 *   💳 the plan pays the WHOLE Agreed amount; the last unpaid payment is the shipped auto "Final balance"
 *      (`lib/proposal-payment-schedule.ts`) and absorbs every difference; paid rows never change; over-cover refused.
 *   💳 only the SUPPLIER writes the quote and its plan; hosts and the coordinator ASK for a change (hidden when locked).
 *   🤝 a payment proof to a coordinator/planner needs the host's Agree — REQUIRED.
 *   👥 guest-count recount uses ONLY per-guest quote lines, never below `min_pax` nor the paid floor; not offered on
 *      a locked quote ("[supplier]'s price is final").
 */
import { formatCentavos } from './vendor-proposals';
export { bookRequestFromLine, changeAskFromLine, formLineTitle, guestCountFromLine, streamLineKind, type BookRequestState } from './chat-card-lines';
import type { AskSubject } from './chat-card-lines';
import { resolveSchedule, type AutoBalanceMeta, type InstallmentDraft, type ResolvedSchedule } from './proposal-payment-schedule';

// ── Change quote ──────────────────────────────────────────────────────────────

/** One quote line as the card edits it (a stored `ProposalLineItem`, plus a key). Null amount = complimentary. */
export type CardLine = { key: string; label: string; detail: string | null; amountCentavos: number | null };

export type QuoteEdit =
  | { op: 'add'; key: string; label: string; detail?: string | null; amountCentavos: number }
  | { op: 'edit'; key: string; amountCentavos: number; detail?: string | null }
  | { op: 'remove'; key: string };

export type MarkedLine = CardLine & { mark: 'add' | 'chg' | 'rm' | null };

/** The lines after the edits, each marked (+ added · ✎ changed · − removed) — what both sides see on the card. */
export function applyQuoteEdits(lines: readonly CardLine[], edits: readonly QuoteEdit[]): MarkedLine[] {
  const out: MarkedLine[] = lines.map((l) => ({ ...l, mark: null }));
  for (const e of edits) {
    if (e.op === 'add') {
      out.push({ key: e.key, label: e.label, detail: e.detail ?? null, amountCentavos: Math.max(0, Math.round(e.amountCentavos)), mark: 'add' });
      continue;
    }
    const i = out.findIndex((l) => l.key === e.key);
    if (i < 0) continue;
    const cur = out[i]!;
    if (e.op === 'remove') {
      // A line added in this same card simply goes; a stored line stays drawn, struck.
      if (cur.mark === 'add') out.splice(i, 1);
      else out[i] = { ...cur, mark: 'rm' };
    } else {
      out[i] = {
        ...cur,
        amountCentavos: Math.max(0, Math.round(e.amountCentavos)),
        detail: e.detail === undefined ? cur.detail : e.detail,
        mark: cur.mark === 'add' ? 'add' : 'chg',
      };
    }
  }
  return out;
}

/** The total of the lines that stay (removed lines count nothing; complimentary lines count nothing). */
export function linesTotal(lines: readonly MarkedLine[] | readonly CardLine[]): number {
  return (lines as readonly MarkedLine[]).reduce((s, l) => (l.mark === 'rm' ? s : s + (l.amountCentavos ?? 0)), 0);
}

/** The edited lines as stored line items for the shipped send (`sendCustomProposalFromChat`). */
export function toProposalLineItems(lines: readonly MarkedLine[]): { label: string; detail: string | null; amount_centavos: number | null }[] {
  return lines.filter((l) => l.mark !== 'rm').map((l) => ({ label: l.label, detail: l.detail, amount_centavos: l.amountCentavos }));
}

/** The paid floor: the paid quotation's total once a payment is confirmed on it; null = no floor yet. */
export function paidFloor(input: { paidQuoteCentavos: number | null; confirmedPaymentCount: number }): number | null {
  if (input.confirmedPaymentCount <= 0 || input.paidQuoteCentavos == null) return null;
  return Math.max(0, Math.round(input.paidQuoteCentavos));
}

/** The words the card shows when a change would go under the floor — or null when it may go. */
export function floorRefusal(newTotalCentavos: number, floorCentavos: number | null): string | null {
  if (floorCentavos == null || newTotalCentavos >= floorCentavos) return null;
  return `Can't go below ${formatCentavos(floorCentavos)} — what they paid for. Add something to swap.`;
}

/** "+₱800" / "−₱1,200" / "±₱0" against the accepted version. */
export function deltaWords(newTotalCentavos: number, againstCentavos: number): string {
  const d = newTotalCentavos - againstCentavos;
  if (d === 0) return '±₱0';
  return `${d > 0 ? '+' : '−'}${formatCentavos(Math.abs(d))}`;
}

// ── The payment plan · pay in full ────────────────────────────────────────────

export type LedgerRow = {
  seq: number;
  label: string;
  amountCentavos: number;
  /** paid = a payment confirmed against it (never changes) · final = the auto Final balance · open = the supplier may change it. */
  state: 'paid' | 'final' | 'open';
};

export type Ledger = {
  rows: LedgerRow[];
  agreedCentavos: number;
  sumCentavos: number;
  /** Σ = Agreed and nothing over-covered — the only plan that may be sent or saved. */
  paysInFull: boolean;
  /** The words for a plan that does not ("over — trim a payment" / what is short). */
  problem: string | null;
};

/**
 * THE ONE LEDGER — every face of the plan (the chat Quote card, the Quotation tab, the Payment tab) draws these rows.
 * Re-resolves through the shipped resolver with the AGREED total as its base, so the auto Final balance absorbs every
 * difference (a revision that changes Agreed included); rows whose seq is paid are frozen as they are.
 */
export function planLedger(input: {
  manual: readonly InstallmentDraft[];
  autoBalance: AutoBalanceMeta;
  agreedCentavos: number;
  creditCentavos?: number;
  paidSeqs?: ReadonlySet<number>;
}): Ledger {
  const agreed = Math.max(0, Math.round(input.agreedCentavos));
  const resolved: ResolvedSchedule = resolveSchedule({
    manual: [...input.manual],
    autoBalance: input.autoBalance,
    baseCentavos: agreed + Math.max(0, Math.round(input.creditCentavos ?? 0)),
    creditCentavos: Math.max(0, Math.round(input.creditCentavos ?? 0)),
  });
  const paid = input.paidSeqs ?? new Set<number>();
  const rows: LedgerRow[] = resolved.installments.map((r) => ({
    seq: r.seq,
    label: r.label,
    amountCentavos: r.amount_centavos,
    state: paid.has(r.seq) ? 'paid' : r.is_auto_balance ? 'final' : 'open',
  }));
  const sum = rows.reduce((s, r) => s + r.amountCentavos, 0);
  const paysInFull = rows.length > 0 && resolved.balances && sum === agreed;
  const problem = paysInFull
    ? null
    : resolved.over_by_centavos > 0
      ? `Over by ${formatCentavos(resolved.over_by_centavos)} — trim a payment`
      : rows.length === 0
        ? 'Add at least one payment'
        : `The payments add up to ${formatCentavos(sum)}, not ${formatCentavos(agreed)}`;
  return { rows, agreedCentavos: agreed, sumCentavos: sum, paysInFull, problem };
}

/** "Plan pays all: ₱30,000 + ₱30,800 = ₱60,800 ✓" — the one line every face prints under the plan. */
export function ledgerLine(l: Ledger): string {
  if (!l.paysInFull) return l.problem ?? '';
  return `Plan pays all: ${l.rows.map((r) => formatCentavos(r.amountCentavos)).join(' + ')} = ${formatCentavos(l.agreedCentavos)} ✓`;
}

/**
 * A supplier's edit to one open payment. Paid rows never change (refused); the Final balance is computed, never typed.
 * Returns the new drafts, or the reason the edit is refused.
 */
export function editPlanPayment(
  manual: readonly InstallmentDraft[],
  seq: number,
  amountPhp: number,
  paidSeqs: ReadonlySet<number>,
): { ok: true; manual: InstallmentDraft[] } | { ok: false; reason: string } {
  if (paidSeqs.has(seq)) return { ok: false, reason: 'A paid payment never changes' };
  if (seq < 0 || seq >= manual.length) return { ok: false, reason: 'The Final balance is worked out for you' };
  if (!Number.isFinite(amountPhp) || amountPhp <= 0) return { ok: false, reason: 'Type an amount above ₱0' };
  const next = manual.map((d, i) => (i === seq ? { ...d, kind: 'fixed' as const, amountPhp: Math.round(amountPhp * 100) / 100, percent: null } : d));
  return { ok: true, manual: next };
}

// ── Ask for a change ──────────────────────────────────────────────────────────

export type { AskSubject } from './chat-card-lines';

/**
 * May this reader ask for a change on this item? Only the hosts' side (hosts, coordinator) ever asks — the supplier
 * writes. A locked item draws no Ask (the server refuses it too: `ask_for_a_change` ITEM_LOCKED).
 */
export function askForAChange(input: { readerIsSupplier: boolean; locked: boolean; supplierName: string }):
  | { show: true }
  | { show: false; line: string | null } {
  if (input.readerIsSupplier) return { show: false, line: null };
  if (input.locked) return { show: false, line: `${input.supplierName}'s price is final` };
  return { show: true };
}

export const ASK_SUBJECT_WORD: Record<AskSubject, string> = { quote: 'Quotation', plan: 'Payment plan', form: 'Form' };

/** The words the server's refusals arrive as → what the card says. */
export function askRefusalWords(message: string | null | undefined): string {
  const m = message ?? '';
  if (m.includes('ITEM_LOCKED')) return 'The supplier made this final — no changes can be asked for.';
  if (m.includes('NOT_THE_HOSTS_SIDE')) return 'Only the hosts and the coordinator ask for a change.';
  if (m.includes('BAD_ASK')) return 'Say what should change.';
  return "Couldn't send that. Try again.";
}

// ── Log a payment · the coordinator's Agree ───────────────────────────────────

export type LogPaymentDraft = {
  amountPhp: number | null;
  method: string | null;
  reference: string;
  paidOn: string | null;
  receiptRef: string | null;
  agree: boolean;
};

/** The planner/coordinator category key on a booking (`event_vendors.category`). */
export const COORDINATOR_CATEGORY = 'planner_coordinator';

export function needsCoordinatorAgree(category: string | null | undefined): boolean {
  return category === COORDINATOR_CATEGORY;
}

/** Each step's "may move on". The receipt step holds the Agree when the payment goes to a coordinator/planner. */
export function logPaymentStepOk(d: LogPaymentDraft, step: number, toCoordinator: boolean): boolean {
  switch (step) {
    case 0:
      return d.amountPhp != null && d.amountPhp > 0;
    case 1:
      return !!d.method;
    case 2:
      return d.reference.trim().length > 0;
    case 3:
      return !!d.paidOn;
    default:
      return !!d.receiptRef && (!toCoordinator || d.agree);
  }
}

/** The server's own word on a log to a coordinator: refused without the Agree. */
export function logPaymentRefusal(input: { toCoordinator: boolean; agree: boolean }): string | null {
  if (input.toCoordinator && !input.agree) return 'Tick the box to agree before you send.';
  return null;
}

// ── Guest-count recount ───────────────────────────────────────────────────────

/** A quote line priced per guest, matched to its service card (`pricing_basis = 'per_pax'`). */
export type PerPaxLine = { key: string; label: string; rateCentavos: number; minPax: number };

export type Recount =
  | { kind: 'locked'; line: string }
  | { kind: 'inform'; from: number; to: number; totalCentavos: number }
  | {
      kind: 'recount';
      from: number;
      to: number;
      rows: { key: string; label: string; minPax: number; rateCentavos: number; fromQty: number; toQty: number }[];
      oldTotalCentavos: number;
      newTotalCentavos: number;
      /** A lower count was held at the paid quotation. */
      floored: boolean;
    };

/**
 * Re-multiply ONLY the per-guest lines at the new count (never below `min_pax`); flat lines never move; nothing is
 * invented by Setnayan. A lower total is held at the paid floor. A locked quote is never recounted.
 */
export function guestRecount(input: {
  lines: readonly CardLine[];
  perPax: readonly PerPaxLine[];
  from: number;
  to: number;
  floorCentavos: number | null;
  locked: boolean;
  supplierName: string;
}): Recount {
  const oldTotal = linesTotal(input.lines);
  if (input.locked) return { kind: 'locked', line: `${input.supplierName}'s price is final` };
  const byKey = new Map(input.perPax.map((p) => [p.key, p]));
  const rows: Extract<Recount, { kind: 'recount' }>['rows'] = [];
  let newTotal = 0;
  for (const l of input.lines) {
    const pp = byKey.get(l.key);
    if (!pp || pp.rateCentavos <= 0 || l.amountCentavos == null) {
      newTotal += l.amountCentavos ?? 0;
      continue;
    }
    const fromQty = Math.round(l.amountCentavos / pp.rateCentavos);
    const toQty = Math.max(Math.max(0, Math.round(input.to)), pp.minPax);
    rows.push({ key: l.key, label: l.label, minPax: pp.minPax, rateCentavos: pp.rateCentavos, fromQty, toQty });
    newTotal += toQty * pp.rateCentavos;
  }
  if (rows.length === 0) return { kind: 'inform', from: input.from, to: input.to, totalCentavos: oldTotal };
  let floored = false;
  if (input.floorCentavos != null && newTotal < input.floorCentavos) {
    newTotal = input.floorCentavos;
    floored = true;
  }
  return { kind: 'recount', from: input.from, to: input.to, rows, oldTotalCentavos: oldTotal, newTotalCentavos: newTotal, floored };
}

/** The recounted lines for Apply (posted as a new version through the shipped send). */
export function recountedLines(lines: readonly CardLine[], r: Extract<Recount, { kind: 'recount' }>): CardLine[] {
  const byKey = new Map(r.rows.map((x) => [x.key, x]));
  const out = lines.map((l) => {
    const x = byKey.get(l.key);
    return x ? { ...l, amountCentavos: x.toQty * x.rateCentavos, detail: `${x.toQty} × ${formatCentavos(x.rateCentavos)}` } : l;
  });
  if (r.floored) {
    const short = r.newTotalCentavos - linesTotal(out);
    if (short > 0) out.push({ key: 'floor', label: 'Held at the paid quotation', detail: null, amountCentavos: short });
  }
  return out;
}

// ── Form · one question at a time ─────────────────────────────────────────────

/** Where the answerer stands: the first unanswered question, or done. */
export function formProgress(answers: readonly (string | null)[]): { at: number; answered: number; done: boolean } {
  const answered = answers.filter((a) => a != null && a.trim().length > 0).length;
  const at = answers.findIndex((a) => a == null || a.trim().length === 0);
  return { at: at < 0 ? answers.length - 1 : at, answered, done: at < 0 && answers.length > 0 };
}

// ── Decision topics ──────────────────────────────────────────────────────────

