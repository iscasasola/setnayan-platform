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
import { isCoordinatorTrade } from './coordinator-trade';
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

/**
 * ✋ AN ASK STARTS FROM ITS PART AND CARRIES IT (owner, ruling 6076). The ask is opened from the very thing it is about —
 * one quote line, the payment plan, a sent form — never from a blank (+) row. A quote line and a form are named in the
 * note itself ("“Photography” — drop the drone"), so the stored ask AND the chat line (`ask_for_a_change` quotes the
 * note) both say which part; the payment plan is its own subject, so it needs no name. Capped at the database's 1000.
 */
export const ASK_NOTE_MAX = 1000;
export type AskPart = { subject: AskSubject; /** The line's label or the form's title; null = the subject is the part (the plan). */ name: string | null };

export function askNoteWithPart(part: AskPart, note: string): string {
  const n = note.trim();
  const name = (part.name ?? '').trim();
  return (name ? `“${name}” — ${n}` : n).slice(0, ASK_NOTE_MAX);
}

/** The words the ask card wears over its note: "Photography · a line of the quotation" · "Payment plan" · "“Prep form” · form". */
export function askPartWords(part: AskPart): string {
  const name = (part.name ?? '').trim();
  if (!name) return ASK_SUBJECT_WORD[part.subject];
  return part.subject === 'quote' ? `${name} · a line of the quotation` : `${name} · form`;
}

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

/**
 * Is the booking's category (`event_vendors.category`) the coordinator trade? Asked of THE one answer,
 * `lib/coordinator-trade.ts` (TS = SQL = taxonomy, held by `coordinator-trade-is-one-list.test.ts`) — never a key
 * typed here. Today's `vendor_category` enum holds one of that list's names, `planner_coordinator`, so the answer is
 * unchanged for every existing booking (Build 3, 9 Nov: "the services are not hard coded").
 */
export function needsCoordinatorAgree(category: string | null | undefined): boolean {
  return category ? isCoordinatorTrade([category]) : false;
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


// ── Counter with a price · Propose a payment plan · one-tap Accept (Piece 1 · PR-3, owner 12 Nov) ─────────────────
//
// What the card SHOWS before anyone taps; the database writes the same thing (migration 20271340018194 ·
// `change_ask_resplit` / `change_ask_write_version`) and `tests/db/a-counter-a-plan-and-one-tap-accept.db.test.ts`
// holds the two equal. Money never comes from the browser at Accept — the counter's amount and a plan's rows were
// fixed when the OTHER side raised them.

/** One stored plan row as the re-split reads it (`vendor_proposals.payment_schedule.installments[]`). */
export type StoredPlanRow = { seq: number; label?: string; amount_centavos: number; raw_centavos?: number; is_auto_balance?: boolean } & Record<string, unknown>;

/**
 * THE PLAN RE-SPLITS — paid rows never change, no row goes below zero (owner 12 Nov (3): "paid amounts are never
 * touched; only what is still to be settled changes"). A rise lands on the unpaid Final balance (else the latest
 * unpaid row, else a new Final balance row); a drop comes off the Final balance first, then the latest unpaid rows.
 * 💸 FIVE GUARDS (owner 12 Nov): what a drop cannot take from unpaid rows is money OWED BACK to the couple — returned
 * as `owedBackCentavos`, never written as a negative row.
 */
export function resplitAfterCounter(
  rows: readonly StoredPlanRow[],
  newTotalCentavos: number,
  paidSeqs: ReadonlySet<number>,
): { rows: StoredPlanRow[]; owedBackCentavos: number } {
  const out = [...rows].map((r) => ({ ...r })).sort((a, b) => a.seq - b.seq);
  const sum = out.reduce((s, r) => s + r.amount_centavos, 0);
  const delta = Math.max(0, Math.round(newTotalCentavos)) - sum;
  // Unpaid rows, Final balance first, then latest first — the same order the database walks.
  const unpaid = out
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !paidSeqs.has(r.seq))
    .sort((a, b) => Number(!!b.r.is_auto_balance) - Number(!!a.r.is_auto_balance) || b.r.seq - a.r.seq);
  if (delta > 0) {
    const t = unpaid[0];
    if (!t) {
      const seq = out.length ? Math.max(...out.map((r) => r.seq)) + 1 : 0;
      out.push({
        seq, label: 'Final balance', kind: 'auto', amount_centavos: delta, raw_centavos: delta, percent_bps: null, due: 'before_event',
        offset_days: 7, is_downpayment: out.length === 0, is_auto_balance: true, credit_applied_centavos: 0,
      });
    } else {
      const cur = out[t.i]!;
      out[t.i] = { ...cur, amount_centavos: cur.amount_centavos + delta, raw_centavos: (cur.raw_centavos ?? cur.amount_centavos) + delta };
    }
    return { rows: out, owedBackCentavos: 0 };
  }
  let need = -delta;
  for (const { i } of unpaid) {
    if (need <= 0) break;
    const cur = out[i]!;
    const amt = Math.max(0, cur.amount_centavos);
    const take = Math.min(amt, need);
    out[i] = { ...cur, amount_centavos: amt - take, raw_centavos: Math.max(0, (cur.raw_centavos ?? amt) - take) };
    need -= take;
  }
  return { rows: out, owedBackCentavos: Math.max(0, need) };
}

/** A quote line a counter may be about — a line with a price. */
export function counterableLines(lines: readonly CardLine[]): CardLine[] {
  return lines.filter((l) => l.amountCentavos != null && l.amountCentavos > 0);
}

/**
 * What an accepted counter makes: the new total (the whole quote → the amount; one line → that line replaced), and the
 * re-split plan with what would be owed back. `refusal` is the card's words when it cannot be accepted.
 */
export function counterOutcome(input: {
  totalCentavos: number;
  lines: readonly CardLine[];
  amountCentavos: number;
  scopeLabel: string | null;
  floorCentavos: number | null;
  planRows: readonly StoredPlanRow[] | null;
  paidSeqs: ReadonlySet<number>;
}): { newTotalCentavos: number; wasCentavos: number; rows: StoredPlanRow[] | null; owedBackCentavos: number; refusal: string | null } {
  let was = input.totalCentavos;
  let newTotal = Math.round(input.amountCentavos);
  if (input.scopeLabel) {
    const hit = counterableLines(input.lines).find((l) => l.label.trim().toLowerCase() === input.scopeLabel!.trim().toLowerCase());
    if (!hit) return { newTotalCentavos: input.totalCentavos, wasCentavos: 0, rows: null, owedBackCentavos: 0, refusal: 'That line is no longer on the quote.' };
    was = hit.amountCentavos!;
    newTotal = input.totalCentavos - was + Math.round(input.amountCentavos);
  }
  const split = input.planRows && input.planRows.length > 0 ? resplitAfterCounter(input.planRows, newTotal, input.paidSeqs) : null;
  const owed = split?.owedBackCentavos ?? 0;
  const refusal = owed > 0
    ? `${formatCentavos(owed)} would be owed back to the couple — what was paid is the floor.`
    : floorRefusal(newTotal, input.floorCentavos);
  return { newTotalCentavos: newTotal, wasCentavos: was, rows: split?.rows ?? null, owedBackCentavos: owed, refusal };
}

/** "Good until 18 Nov · 6 days left" / "Expired 10 Nov · ask again" — derived from the date, never a stored state. */
export function goodUntilWords(goodUntil: string | null, todayIso: string): { expired: boolean; words: string | null } {
  if (!goodUntil) return { expired: false, words: null };
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const left = Math.round((day(goodUntil) - day(todayIso)) / 86_400_000);
  const label = new Date(day(goodUntil)).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (left < 0) return { expired: true, words: `Expired ${label} · ask again` };
  return { expired: false, words: `Good until ${label} · ${left === 0 ? 'last day' : `${left} day${left === 1 ? '' : 's'} left`}` };
}

/** The Good until choices a counter offers: about a week, about two, or no limit (the approved design). */
export function goodUntilChoices(todayIso: string): { key: string; label: string; date: string | null }[] {
  const add = (n: number) => {
    const d = new Date(Date.UTC(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)) + n));
    return d.toISOString().slice(0, 10);
  };
  const word = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return [
    { key: 'w1', label: `${word(add(6))} · in 6 days`, date: add(6) },
    { key: 'w2', label: `${word(add(13))} · in 13 days`, date: add(13) },
    { key: 'none', label: 'No limit', date: null },
  ];
}

/** Today in Manila as YYYY-MM-DD — the day a Good until is read against (the database reads the same zone). */
export function manilaToday(now: number = Date.now()): string {
  return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * The plans a side may propose instead of the live one — the quote maker's own three presets (first payment when they
 * book, the rest a week before). A preset that would change a PAID row is drawn greyed with the reason (the database
 * refuses it too: PAID_ROW_CHANGED); the plan they already have is left out.
 */
export const NEGOTIATE_PLAN_PRESETS: readonly { key: string; percent: number; label: string }[] = [
  { key: 'p20', percent: 20, label: '20% to book · rest 7 days before' },
  { key: 'half', percent: 50, label: 'Half to book · half 7 days before' },
  { key: 'full', percent: 100, label: 'Full when they book' },
];

export function planProposalOptions(input: {
  totalCentavos: number;
  creditCentavos: number;
  liveRows: readonly StoredPlanRow[];
  paidSeqs: ReadonlySet<number>;
}): { key: string; label: string; rows: ResolvedSchedule['installments']; shut: string | null; same: boolean }[] {
  const base = Math.max(0, Math.round(input.totalCentavos)) + Math.max(0, Math.round(input.creditCentavos));
  return NEGOTIATE_PLAN_PRESETS.map((p) => {
    const resolved = resolveSchedule({
      manual: [{ label: p.percent === 100 ? 'Full payment' : 'First payment', kind: 'percent', amountPhp: null, percent: p.percent, due: 'on_lock', offsetDays: 0 }],
      autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 7 },
      baseCentavos: base,
      creditCentavos: Math.max(0, Math.round(input.creditCentavos)),
    });
    const rows = resolved.installments;
    const same = rows.length === input.liveRows.length && rows.every((r, i) => input.liveRows[i]?.amount_centavos === r.amount_centavos);
    const movesPaid = [...input.paidSeqs].some((s) => {
      const was = input.liveRows.find((r) => r.seq === s);
      const now = rows.find((r) => r.seq === s);
      return !was || !now || was.amount_centavos !== now.amount_centavos;
    });
    const short = rows.reduce((s, r) => s + r.amount_centavos, 0) !== Math.round(input.totalCentavos);
    return { key: p.key, label: p.label, rows, same, shut: movesPaid ? 'A paid payment never changes' : short ? "Doesn't pay the whole quote" : null };
  });
}

/** The words the server's counter / plan / accept refusals arrive as → what the card says. */
export function negotiateRefusalWords(message: string | null | undefined): string {
  const m = message ?? '';
  if (m.includes('COUNTER_EXPIRED')) return 'This one expired — ask again.';
  if (m.includes('ITEM_LOCKED')) return 'The supplier made this final.';
  if (m.includes('QUOTE_MOVED')) return 'The quote changed since — look at the new one.';
  if (m.includes('DEAL_LOCKED')) return 'This booking is confirmed — changes go through a change order.';
  if (m.includes('BELOW_WHAT_WAS_PAID')) return 'That is less than what was paid — the difference would be owed back.';
  if (m.includes('BELOW_PAID_FLOOR') || m.includes('QUOTE_BELOW_PAID_FLOOR')) return "Can't go below what was paid for.";
  if (m.includes('PAID_ROW_CHANGED')) return 'A paid payment never changes.';
  if (m.includes('PLAN_DOES_NOT_PAY_IN_FULL')) return 'The plan must pay the whole quote.';
  if (m.includes('NO_SUCH_LINE')) return 'That line is no longer on the quote.';
  if (m.includes('GOOD_UNTIL_PAST')) return 'Pick a Good until from today on.';
  if (m.includes('COUNTER_NOT_OPEN')) return 'That one was already answered.';
  if (m.includes('QUOTE_EXPIRED')) return "The quote's Valid until has passed — the supplier sends a new one.";
  return askRefusalWords(m);
}
