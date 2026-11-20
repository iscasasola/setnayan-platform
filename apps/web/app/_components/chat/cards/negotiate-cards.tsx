'use client';

/**
 * 🤝 NEGOTIATE — Counter with a price · Propose a payment plan · Accept / Counter / Decline (Piece 1 · PR-3).
 *
 * Approved design `controller-2026-11-11/quote-maker-polish.html` (the couple's askSheet + draft, the counter and plan
 * cards), owner 12 Nov (DECISION_LOG "QUOTE MONEY — THREE ANSWERS", "FIVE GUARDS"). EXTENDS the shipped Ask for a change
 * (`ask-change-card.tsx`, the same `booking_change_asks` record and its two functions, migration 20271340018194):
 *   · `NegotiateDraft` — the (+) card being filled: Ask for a change (words) · Counter with a price (the whole quote or
 *     one line, Good until) · Propose a payment plan (the quote maker's presets; a preset that would move a paid row is
 *     drawn greyed with its reason).
 *   · `NegotiationCard` — under the "Counter · …" / "Plan proposed · …" line: the OTHER side's Accept · Counter ·
 *     Decline. Accept writes exactly ONE new version, accepted, in the database (`change_ask_write_version`); the card
 *     shows beforehand what it will make — the plan re-split, paid rows fixed, and any money owed back.
 *   "Expired · ask again" is derived from Good until — no job, no stored state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Lock, MessageCircleQuestion, Plus, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { formatCentavosPhp } from '@/lib/php';
import { HOSTS_ONLY } from '@/lib/money-mask';

/** A counter's amount that did not come back: unknown, said as unknown (never ₱0). */
const AMOUNT_UNKNOWN = '₱ — amount not loaded';
import {
  ASK_SUBJECT_WORD,
  counterOutcome,
  counterableLines,
  goodUntilChoices,
  goodUntilWords,
  manilaToday,
  planProposalOptions,
  type AskSubject,
  type StoredPlanRow,
} from '@/lib/chat-cards';
import { counterContext, fillTheRest, openCounterBy, planBalance, rangePercent, suggestedCounterCentavos, type CounterContext } from '@/lib/chat-deal';
import { dueLabel, MAX_INSTALLMENTS, type InstallmentDue } from '@/lib/proposal-payment-schedule';
import {
  answerChangeAskFromChat,
  askForAChangeFromChat,
  counterFromChat,
  loadChangeAsks,
  loadNegotiation,
  proposePlanFromChat,
  type ChangeAskRow,
  type NegotiationQuote,
} from './card-calls';
import { CouldNotLoad, EditorShell, EmptyLine, EqualRow, KindCard, KindTag, Loading, Problem, SegBar, type CardTurn, type EditorFrame, type Read } from './card-bits';
import { Sheet } from '@/app/_components/sheet';
import { UnderLowestLine } from './lowest-price';
import { isUnderLowest, loadLowest, useLowestState } from './lowest-calls';

export type NegotiateKind = 'ask' | 'counter' | 'plan';
type Viewer = 'vendor' | 'couple';

const TITLE: Record<NegotiateKind, string> = { ask: 'Ask for a change', counter: 'Counter with a price', plan: 'Propose a payment plan' };
const TOPIC: Record<NegotiateKind, 'quote' | 'payment'> = { ask: 'quote', counter: 'payment', plan: 'payment' };
const pesos = (centavos: number) => formatCentavosPhp(centavos);
const toCentavos = (typed: string) => Math.round((Number(String(typed).replace(/[^0-9.]/g, '')) || 0) * 100);

/** "₱57,000" rounded to the nearest ₱100 — the design's opening price (5% under). */
function openingPrice(wasCentavos: number): string {
  return String(Math.round((wasCentavos * 0.95) / 100 / 100) * 100);
}

/** The live quote AND this chat's asks — the counter editor reads both (their ask · your quote · the gap). */
type Deal = { quote: NegotiationQuote | null; asks: ChangeAskRow[] };

function useNegotiation(threadId: string, seed?: Deal) {
  const [read, setRead] = useState<Read<Deal>>(seed !== undefined ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    // A refused read of the asks is a refused read: the editor never draws "nobody is asking" over an unread list.
    void Promise.all([loadNegotiation(threadId), loadChangeAsks(threadId)]).then(([q, a]) =>
      setRead(q.ok && a.ok ? { at: 'ok', data: { quote: q.quote, asks: a.asks } } : { at: 'failed' }),
    );
  }, [threadId]);
  useEffect(() => {
    if (seed === undefined) load();
  }, [load, seed]);
  return { read, load };
}

/** One label-left · value-right row (the card's form grammar). */
function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/10 py-1.5 last:border-b-0">
      <span className="min-w-0 text-[15px] text-ink">
        {label}
        {sub ? <small className="block text-[12.5px] text-ink/55">{sub}</small> : null}
      </span>
      <span className="flex-none">{children}</span>
    </div>
  );
}

// ── The (+) draft ─────────────────────────────────────────────────────────────

export function NegotiateDraft({
  threadId,
  kind,
  viewer,
  supplierName,
  returnPath,
  onClose,
  onSent,
  seed,
  frame = 'card',
}: {
  threadId: string;
  kind: NegotiateKind;
  viewer: Viewer;
  supplierName: string;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
  /** Lab only: open on these facts, no read. */
  seed?: { quote: NegotiationQuote | null; asks?: ChangeAskRow[]; today?: string; scope?: string | null; amount?: string };
  /** `bare` = hosted inside the text box (the composer owns the title and the ✕); `card` = the (+) card in the stream. */
  frame?: EditorFrame;
}) {
  const seeded = useMemo(() => (seed ? { quote: seed.quote, asks: seed.asks ?? [] } : undefined), [seed]);
  const { read, load } = useNegotiation(threadId, seeded);
  const quote = read.at === 'ok' ? read.data.quote : null;
  const body =
    read.at === 'loading' ? (
      <Loading />
    ) : read.at === 'failed' ? (
      <CouldNotLoad what="the quote" onRetry={load} />
    ) : !quote ? (
      <EmptyLine line="No quote in this chat yet — there is nothing to negotiate." />
    ) : kind === 'ask' ? (
      <AskBody threadId={threadId} quote={quote} supplierName={supplierName} returnPath={returnPath} onClose={onClose} onSent={onSent} />
    ) : kind === 'counter' ? (
      <CounterBody
        threadId={threadId}
        quote={quote}
        asks={read.data.asks}
        supplierName={supplierName}
        today={seed?.today ?? manilaToday()}
        initialScope={seed?.scope ?? null}
        initialAmount={seed?.amount}
        viewer={viewer}
        onClose={onClose}
        onSent={onSent}
      />
    ) : (
      <PlanBody threadId={threadId} quote={quote} viewer={viewer} supplierName={supplierName} today={seed?.today ?? manilaToday()} onClose={onClose} onSent={onSent} />
    );
  return (
    <EditorShell frame={frame} topic={TOPIC[kind]} title={TITLE[kind]} onClose={onClose}>
      <div className="grid gap-2" data-negotiate-draft={kind}>
        {body}
      </div>
    </EditorShell>
  );
}

function SendRow({ label, busy, ok, onSend, onClose }: { label: string; busy: boolean; ok: boolean; onSend: () => void; onClose?: () => void }) {
  return (
    <EqualRow>
      <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => onClose?.()} />
      <ActionButton tone="brand" main icon={Send} label={label} onClick={onSend} waiting={busy} disabled={!ok} />
    </EqualRow>
  );
}

function AskBody({
  threadId,
  quote,
  supplierName,
  returnPath,
  onClose,
  onSent,
}: {
  threadId: string;
  quote: NegotiationQuote;
  supplierName: string;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
}) {
  const offered = (['quote', 'plan'] as AskSubject[]).filter((s) => !(s === 'quote' ? quote.locks.quote : quote.locks.plan));
  const [subject, setSubject] = useState<AskSubject | null>(offered[0] ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (offered.length === 0) return <p className="text-[14px] text-ink/60" data-ask-change="locked">{supplierName}&rsquo;s price is final</p>;
  const send = async () => {
    if (!subject) return;
    setBusy(true);
    setProblem(null);
    const fd = new FormData();
    fd.set('thread_id', threadId);
    fd.set('subject', subject);
    fd.set('note', note);
    fd.set('proposal_id', quote.proposalId);
    fd.set('return_to', returnPath);
    const r = await askForAChangeFromChat(fd);
    setBusy(false);
    if (r.ok) onSent?.();
    else setProblem(r.message);
  };
  return (
    <>
      <Row label="What should change?" sub="the quotation or its payment plan">
        <PickMenu label="What should change?" value={subject} options={offered.map((s) => ({ key: s, label: ASK_SUBJECT_WORD[s] }))} onPick={(k) => setSubject(k as AskSubject)} dataAttr="data-ask-subject" />
      </Row>
      <TypedRow name="Note" long value={note} empty="Add" placeholder="A short note" maxLength={1000} openAsk={1} onType={setNote} onKeep={setNote} />
      <Problem text={problem} />
      <SendRow label="Send" busy={busy} ok={!!subject && note.trim().length > 0} onSend={() => void send()} onClose={onClose} />
    </>
  );
}

/**
 * 🤝 THEIR ASK · YOUR QUOTE · THE GAP (Unichat part C, 20 Nov 2026 — the drawing's `.ctx`). Above the price: the
 * figures the deal already holds, the range between the two sides with the halfway mark, and one-press amounts.
 * 🔒 The supplier's lowest is in `ctx` ONLY for the supplier (`counterContext` drops it for the hosts).
 */
function CounterContextStrip({ ctx, cents, onPick }: { ctx: CounterContext; cents: number; onPick: (centavos: number) => void }) {
  const figures = ctx.gap ? ctx.figures.slice(-2) : ctx.figures;
  // Already formatted words (`gapWords`: "₱5,000" and "11%") — joined here, never a raw number.
  const gapLine = ctx.gap ? [ctx.gap.amount, `(${ctx.gap.percent})`].join(' ') : null;
  const mark = 'absolute top-[13px] -ml-px h-2.5 w-0.5 rounded-sm';
  return (
    <div className="grid gap-2" data-counter-context="">
      <div className="flex gap-3">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0 flex-1">
            <small className="block truncate text-[12px] text-ink/70">{f.label}</small>
            <b className="block whitespace-nowrap text-[14px] tabular-nums text-ink">{pesos(f.centavos)}</b>
          </div>
        ))}
        {ctx.gap ? (
          <div className="min-w-0 flex-1" data-counter-gap="">
            <small className="block truncate text-[12px] text-ink/70">Gap</small>
            <b className="block whitespace-nowrap text-[14px] tabular-nums text-kind-counter">
              {gapLine}
            </b>
          </div>
        ) : null}
      </div>
      {ctx.lo != null ? (
        <div className="relative mx-2 h-10" role="img" aria-label={`From ${pesos(ctx.lo)} to ${pesos(ctx.hi)}`} data-counter-range="">
          <span aria-hidden className="absolute inset-x-0 top-4 h-1 rounded-full bg-kind-counter-bg" />
          {ctx.suggested != null ? (
            <span aria-hidden className={`${mark} bg-kind-counter opacity-45`} style={{ left: `${rangePercent(ctx.suggested, ctx.lo, ctx.hi)}%` }} />
          ) : null}
          {ctx.lowestAt != null ? (
            <span aria-hidden className={`${mark} bg-current`} style={{ left: `${ctx.lowestAt}%`, color: 'rgb(var(--color-warn))' }} data-counter-lowest-mark="">
              <Lock className="absolute -left-[5px] -top-[13px] h-3 w-3" strokeWidth={2.2} />
            </span>
          ) : null}
          {cents > 0 ? (
            <span
              aria-hidden
              className="absolute top-[11px] -ml-[7px] h-3.5 w-3.5 rounded-full bg-kind-counter ring-[3px] ring-frame transition-[left] duration-sn-pill ease-sn"
              style={{ left: `${rangePercent(cents, ctx.lo, ctx.hi)}%` }}
            />
          ) : null}
          <span aria-hidden className="absolute inset-x-0 top-[26px] flex justify-between text-[12px] tabular-nums text-ink/70">
            <span>{pesos(ctx.lo)}</span>
            <span>{pesos(ctx.hi)}</span>
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts" data-counter-chips="">
        {ctx.chips.map((c) => {
          const on = c.centavos === cents;
          return (
            <button
              key={c.centavos}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(c.centavos)}
              className={`sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[14px] font-medium tabular-nums ${on ? 'border-kind-counter bg-kind-counter-bg text-kind-counter' : 'border-ink/15 text-ink'}`}
            >
              {c.lowest ? <Lock aria-hidden className="h-3.5 w-3.5 flex-none" strokeWidth={2} /> : null}
              {pesos(c.centavos)} · {c.words.join(' · ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CounterBody({
  threadId,
  quote,
  asks,
  supplierName,
  today,
  initialScope,
  initialAmount,
  onClose,
  onSent,
  counters,
  viewer,
}: {
  threadId: string;
  quote: NegotiationQuote;
  /** This chat's asks — each side's latest counter on the total is the range's two ends. */
  asks?: readonly ChangeAskRow[];
  supplierName: string;
  today: string;
  initialScope: string | null;
  initialAmount?: string;
  /** 🤝 The supplier's own counter is checked against their private lowest (one quiet line; the hosts' never is). */
  viewer?: Viewer;
  onClose?: () => void;
  onSent?: () => void;
  /** Countering an open counter: its id (the server marks it 'countered'). */
  counters?: string | null;
}) {
  const lines = counterableLines(quote.lines);
  const [scope, setScope] = useState<string | null>(initialScope);
  const wasOf = (s: string | null) => (s ? (lines.find((l) => l.label === s)?.amountCentavos ?? 0) : quote.totalCentavos);
  // 🔒 The lowest is read ONLY on the supplier's side; the hosts' session never asks for it (and RLS would answer nothing).
  const lowestState = useLowestState(threadId);
  useEffect(() => {
    if (viewer === 'vendor') void loadLowest(threadId);
  }, [viewer, threadId]);
  const lowest = viewer === 'vendor' && lowestState.at === 'ok' ? lowestState.centavos : null;
  const onTotal = (asks ?? []).filter((a) => !a.scopeLabel && a.proposalId === quote.proposalId);
  const ctx = counterContext({
    viewer: viewer ?? 'couple',
    quoteTotalCentavos: quote.totalCentavos,
    hostAskCentavos: openCounterBy(onTotal, today, 'host', true)?.amountCentavos ?? null,
    supplierCounterCentavos: openCounterBy(onTotal, today, 'supplier', true)?.amountCentavos ?? null,
    lowestCentavos: lowest,
  });
  // The price opens on the suggested counter (halfway, never under the supplier's lowest) and follows it until typed.
  const [typed, setTyped] = useState<string | null>(initialAmount ?? null);
  const amount = typed ?? (scope == null && ctx.suggested != null ? String(ctx.suggested / 100) : openingPrice(wasOf(scope)));
  const choices = useMemo(() => goodUntilChoices(today), [today]);
  const [until, setUntil] = useState<string>(choices[0]!.key);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (quote.locks.quote) return <p className="text-[14px] text-ink/60" data-ask-change="locked">{supplierName}&rsquo;s price is final</p>;
  const cents = toCentavos(amount);
  const out = counterOutcome({
    totalCentavos: quote.totalCentavos,
    lines: quote.lines,
    amountCentavos: cents,
    scopeLabel: scope,
    floorCentavos: quote.floorCentavos,
    planRows: quote.planRows,
    paidSeqs: new Set(quote.paidSeqs),
  });
  const send = async () => {
    setBusy(true);
    setProblem(null);
    const r = await counterFromChat({
      threadId,
      proposalId: quote.proposalId,
      amountCentavos: cents,
      scopeLabel: scope,
      goodUntil: choices.find((c) => c.key === until)?.date ?? null,
      note,
      counters: counters ?? null,
    });
    setBusy(false);
    if (r.ok) onSent?.();
    else setProblem(r.message);
  };
  return (
    <>
      <Row label="On" sub="the total or one line">
        <PickMenu
          label="Counter on"
          value={scope ?? '__total'}
          options={[{ key: '__total', label: 'The total' }, ...lines.map((l) => ({ key: l.label, label: l.label }))]}
          onPick={(k) => {
            setScope(k === '__total' ? null : k);
            setTyped(null);
          }}
          dataAttr="data-counter-scope"
        />
      </Row>
      {scope == null ? <CounterContextStrip ctx={ctx} cents={cents} onPick={(c) => setTyped(String(c / 100))} /> : null}
      <TypedRow name="Your price" amount value={amount} empty="₱" openAsk={0} onType={setTyped} onKeep={setTyped} />
      <p className="-mt-1 text-[13px] text-ink/55" data-counter-was="">instead of {pesos(out.wasCentavos)}</p>
      {/* 🤝 Under their own lowest: ONE quiet line, never a block — Send counter stays as it was (owner 19 Nov 2026). */}
      {viewer === 'vendor' && cents > 0 ? <UnderLowestLine threadId={threadId} totalCentavos={out.newTotalCentavos} /> : null}
      <Row label="Good until" sub="then it expires">
        <PickMenu label="Good until" value={until} options={choices.map((c) => ({ key: c.key, label: c.label }))} onPick={setUntil} dataAttr="data-counter-until" />
      </Row>
      <TypedRow name="Note" long value={note} empty="Add" placeholder="A short note" maxLength={1000} onType={setNote} onKeep={setNote} />
      {scope && cents > 0 ? <p className="text-[13px] text-ink/60">The quote would come to {pesos(out.newTotalCentavos)}.</p> : null}
      <Problem text={problem ?? (cents > 0 ? out.refusal : null)} />
      <SendRow label="Send counter" busy={busy} ok={cents > 0 && !out.refusal} onSend={() => void send()} onClose={onClose} />
    </>
  );
}

/** One payment of a custom plan, as it is typed. `src` = the live row it was opened from (its seq and its facts ride back). */
type CustomRow = { key: string; label: string; amount: string; due: InstallmentDue; offsetDays: number; src: StoredPlanRow | null };
const PLAN_CUSTOM = 'custom';
/** When a payment is due — the quote maker's own anchors, worded by `dueLabel`. */
const DUE_CHOICES: readonly { key: string; due: InstallmentDue; offsetDays: number }[] = [
  { key: 'on_lock:0', due: 'on_lock', offsetDays: 0 },
  { key: 'before_event:30', due: 'before_event', offsetDays: 30 },
  { key: 'before_event:14', due: 'before_event', offsetDays: 14 },
  { key: 'before_event:7', due: 'before_event', offsetDays: 7 },
  { key: 'on_event:0', due: 'on_event', offsetDays: 0 },
];
const DUES: readonly InstallmentDue[] = ['on_lock', 'before_event', 'on_event'];
let customSeq = 0;
/** A stored row's own timing, as the editor reads it. */
const dueOf = (r: StoredPlanRow): { due: InstallmentDue; offsetDays: number } => ({
  due: DUES.includes(r.due as InstallmentDue) ? (r.due as InstallmentDue) : 'before_event',
  offsetDays: Math.max(0, Math.round(Number(r.offset_days) || 0)),
});

function customFrom(rows: readonly StoredPlanRow[]): CustomRow[] {
  return [...rows]
    .sort((a, b) => a.seq - b.seq)
    .map((r) => ({
      key: `c${(customSeq += 1)}`,
      label: String(r.label ?? 'Payment'),
      amount: String(r.amount_centavos / 100),
      ...dueOf(r),
      src: r,
    }));
}

/** The typed rows as stored plan rows: a live row keeps its seq and its facts; only what was typed changes. */
function customToStored(rows: readonly CustomRow[], keepSeqs: boolean): StoredPlanRow[] {
  let next = rows.reduce((m, r) => (r.src ? Math.max(m, r.src.seq) : m), -1) + 1;
  return rows.map((r, i) => {
    const amount = toCentavos(r.amount);
    const seq = keepSeqs ? (r.src ? r.src.seq : next++) : i;
    if (r.src) {
      const same = r.src.amount_centavos === amount;
      return {
        ...r.src,
        seq,
        amount_centavos: amount,
        raw_centavos: same ? (r.src.raw_centavos ?? amount) : amount + Math.max(0, Math.round(Number(r.src.credit_applied_centavos) || 0)),
        ...(same ? {} : { kind: r.src.is_auto_balance ? 'auto' : 'fixed', percent_bps: null }),
        // The timing is written only when it was changed — an untouched row goes back as it was stored.
        ...(dueOf(r.src).due === r.due && dueOf(r.src).offsetDays === r.offsetDays ? {} : { due: r.due, offset_days: r.offsetDays }),
        ...(seq === r.src.seq ? {} : { is_downpayment: seq === 0 }),
      };
    }
    return {
      seq,
      label: r.label,
      kind: 'fixed',
      amount_centavos: amount,
      raw_centavos: amount,
      percent_bps: null,
      due: r.due,
      offset_days: r.offsetDays,
      is_downpayment: seq === 0,
      is_auto_balance: false,
      credit_applied_centavos: 0,
    };
  });
}

function PlanBody({
  threadId,
  quote,
  viewer,
  supplierName,
  today,
  onClose,
  onSent,
}: {
  threadId: string;
  quote: NegotiationQuote;
  viewer: Viewer;
  supplierName: string;
  today: string;
  onClose?: () => void;
  onSent?: () => void;
}) {
  const paid = useMemo(() => new Set(quote.paidSeqs), [quote.paidSeqs]);
  const options = planProposalOptions({
    totalCentavos: quote.totalCentavos,
    creditCentavos: quote.creditCentavos,
    liveRows: quote.planRows,
    paidSeqs: paid,
  }).filter((o) => !o.same);
  const [pick, setPick] = useState<string | null>(options.find((o) => !o.shut)?.key ?? null);
  // 🧮 CUSTOM (the drawing's plan editor): the payments are typed, and they MUST add up to the quote — Send stays
  // grey until they do. Paid payments are drawn fixed (a paid payment never changes; the database refuses it too).
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const choices = useMemo(() => goodUntilChoices(today), [today]);
  const [until, setUntil] = useState<string>(choices[0]!.key);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // 🔒 plan_locked: nothing to propose (the server refuses it too — ITEM_LOCKED).
  if (quote.locks.plan) {
    return (
      <p className="text-[14px] text-ink/60" data-plan-proposal="locked">
        {viewer === 'vendor' ? 'You made the payment plan final' : `${supplierName} made the payment plan final`}
      </p>
    );
  }
  const isCustom = pick === PLAN_CUSTOM;
  const chosen = options.find((o) => o.key === pick) ?? null;
  const hasPaid = paid.size > 0;
  const amounts = custom.map((r) => toCentavos(r.amount));
  const balance = planBalance(amounts, quote.totalCentavos);
  const customRows = isCustom ? customToStored(custom, hasPaid) : [];
  const sameAsLive =
    isCustom && customRows.length === quote.planRows.length && customRows.every((r) => quote.planRows.find((l) => l.seq === r.seq)?.amount_centavos === r.amount_centavos);
  const rows: StoredPlanRow[] = isCustom ? customRows : chosen ? (chosen.rows as unknown as StoredPlanRow[]) : [];
  const ok = isCustom ? balance.balanced && !sameAsLive : !!chosen && !chosen.shut;
  const openCustom = () => {
    // Custom opens on the plan in front of them: the picked preset's rows — or, once a payment is paid, the live
    // plan itself (its paid rows cannot move, so a preset's rows are not a place to start from).
    const from = !hasPaid && chosen && !chosen.shut ? (chosen.rows as unknown as StoredPlanRow[]) : quote.planRows;
    setCustom(
      from.length > 0
        ? customFrom(from)
        : [{ key: `c${(customSeq += 1)}`, label: 'First payment', amount: String(quote.totalCentavos / 100), due: 'on_lock', offsetDays: 0, src: null }],
    );
    setPick(PLAN_CUSTOM);
  };
  const setRow = (key: string, patch: Partial<CustomRow>) => setCustom((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const send = async () => {
    if (!ok) return;
    setBusy(true);
    setProblem(null);
    const r = await proposePlanFromChat({
      threadId,
      proposalId: quote.proposalId,
      rows,
      goodUntil: choices.find((c) => c.key === until)?.date ?? null,
      note: '',
    });
    setBusy(false);
    if (r.ok) onSent?.();
    else setProblem(r.message);
  };
  const lastOpen = [...custom].reverse().find((r) => !(r.src && paid.has(r.src.seq)))?.key ?? null;
  return (
    <>
      <Row label="Instead of" sub={planWords(quote.planRows)}>
        <PickMenu
          label="Propose a plan"
          value={pick}
          options={[
            ...options.map((o) => ({ key: o.key, label: o.label, disabledNote: o.shut ?? undefined })),
            { key: PLAN_CUSTOM, label: 'Custom' },
          ]}
          onPick={(k) => (k === PLAN_CUSTOM ? openCustom() : setPick(k))}
          buttonText={pick ? undefined : 'Pick a plan'}
          dataAttr="data-plan-pick"
        />
      </Row>
      {isCustom ? (
        <div className="grid gap-2" data-plan-custom={balance.balanced ? 'balanced' : 'open'}>
          <SegBar amounts={amounts} />
          <ul className="grid divide-y divide-ink/10 border-y border-ink/10">
            {custom.map((r, i) => {
              const fixed = !!r.src && paid.has(r.src.seq);
              return (
                // 👈 A payment leaves by the house swipe (left on a phone, hover on a computer) — never a ✕ on the row.
                <SwipeToDelete
                  key={r.key}
                  as="li"
                  label={`Remove ${r.label}`}
                  word="Remove"
                  disabled={fixed || custom.length < 2}
                  hover={!fixed && custom.length > 1}
                  radiusClass="rounded-none"
                  surfaceClass="bg-white dark:bg-raised"
                  onDelete={() => setCustom((rs) => rs.filter((x) => x.key !== r.key))}
                >
                <div className="grid gap-1 py-1.5" data-plan-custom-row={fixed ? 'paid' : 'open'}>
                  {fixed ? (
                    <div className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
                      <span className="min-w-0 truncate text-ink">{r.label}</span>
                      <span className="flex-none tabular-nums text-ink">
                        {pesos(toCentavos(r.amount))} <span className="ml-1 text-[12px] text-ink/70">Paid ✓</span>
                      </span>
                    </div>
                  ) : (
                    <>
                      <TypedRow name={r.label} amount value={r.amount} empty="₱" onType={(v) => setRow(r.key, { amount: v })} onKeep={(v) => setRow(r.key, { amount: v })} data="plan-custom-amount" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <PickMenu
                          label={`${r.label} is due`}
                          value={`${r.due}:${r.offsetDays}`}
                          options={[
                            ...DUE_CHOICES.map((c) => ({ key: c.key, label: dueLabel(c.due, c.offsetDays) })),
                            // A live row's own timing stays pickable when it is none of the common ones.
                            ...(DUE_CHOICES.some((c) => c.key === `${r.due}:${r.offsetDays}`) ? [] : [{ key: `${r.due}:${r.offsetDays}`, label: dueLabel(r.due, r.offsetDays) }]),
                          ]}
                          onPick={(k) => {
                            const [due, days] = k.split(':');
                            setRow(r.key, { due: due as InstallmentDue, offsetDays: Number(days) || 0 });
                          }}
                          dataAttr="data-plan-custom-due"
                        />
                        {r.key === lastOpen && !balance.balanced ? (
                          <ActionButton
                            tone="neutral"
                            icon={Check}
                            label="Fill the rest"
                            onClick={() => {
                              const rest = fillTheRest(amounts, i, quote.totalCentavos)[i]!;
                              setRow(r.key, { amount: String(rest / 100) });
                            }}
                            data-plan-custom-fill=""
                          />
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
                </SwipeToDelete>
              );
            })}
          </ul>
          {custom.length < MAX_INSTALLMENTS ? (
            <div className="flex">
              <ActionButton
                tone="neutral"
                icon={Plus}
                label="Add a payment"
                onClick={() =>
                  setCustom((rs) => [...rs, { key: `c${(customSeq += 1)}`, label: `Payment ${rs.length + 1}`, amount: '', due: 'before_event', offsetDays: 7, src: null }])
                }
              />
            </div>
          ) : null}
          <p
            role="status"
            className={`text-[13px] font-semibold ${balance.balanced ? 'text-success-700' : 'text-danger-600'}`}
            data-plan-balance={balance.left === 0 ? 'balanced' : balance.left > 0 ? 'short' : 'over'}
          >
            {balance.words}
          </p>
        </div>
      ) : chosen ? (
        <PlanRows rows={chosen.rows as unknown as StoredPlanRow[]} paid={paid} />
      ) : null}
      <Row label="Good until" sub="then it expires">
        <PickMenu label="Good until" value={until} options={choices.map((c) => ({ key: c.key, label: c.label }))} onPick={setUntil} dataAttr="data-plan-until" />
      </Row>
      <Problem text={problem ?? (sameAsLive && balance.balanced ? 'That is the plan they already have.' : null)} />
      <SendRow label="Send" busy={busy} ok={ok} onSend={() => void send()} onClose={onClose} />
    </>
  );
}

/** Halfway between the two prices on one line, a whole peso — undefined when they are the same (the opening price then). */
function lineHalfway(a: number, b: number): string | undefined {
  const half = suggestedCounterCentavos({ theirAskCentavos: Math.min(a, b), yourQuoteCentavos: Math.max(a, b) });
  return half == null ? undefined : String(half / 100);
}

function planWords(rows: readonly StoredPlanRow[]): string {
  if (rows.length === 0) return 'no plan yet';
  return rows.map((r) => `${String(r.label ?? 'Payment')} ${pesos(r.amount_centavos)}`).join(' · ');
}

function PlanRows({ rows, paid, owedBack = 0 }: { rows: readonly StoredPlanRow[]; paid: ReadonlySet<number>; owedBack?: number }) {
  return (
    <div className="grid gap-1 rounded-xl bg-ink/[0.04] px-3 py-2 text-[14px]" data-plan-rows="">
      {rows.map((r) => (
        <div key={r.seq} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-ink/75">{String(r.label ?? 'Payment')}</span>
          <span className="flex-none tabular-nums text-ink">
            {pesos(r.amount_centavos)}
            {paid.has(r.seq) ? <span className="ml-1.5 text-[12px] text-ink/55">Paid ✓</span> : null}
          </span>
        </div>
      ))}
      {owedBack > 0 ? (
        <p className="text-[13px] font-semibold text-warn-900" data-owed-back="">
          {pesos(owedBack)} owed back to the couple
        </p>
      ) : null}
    </div>
  );
}

// ── The card under its line: Accept · Counter · Decline ─────────────────────────

export function NegotiationCard({
  threadId,
  kind,
  askedAt,
  viewer,
  seed,
}: {
  threadId: string;
  kind: 'counter' | 'plan';
  /** The line's own `created_at` — the ask was written in the same transaction (same `now()`). */
  askedAt: string;
  viewer: Viewer;
  /** Lab only. */
  seed?: { ask: ChangeAskRow; quote: NegotiationQuote | null; today?: string; lowestCentavos?: number | null };
}) {
  const [read, setRead] = useState<Read<{ ask: ChangeAskRow | null; quote: NegotiationQuote | null; asks: ChangeAskRow[] }>>(
    seed ? { at: 'ok', data: { ask: seed.ask, quote: seed.quote, asks: [seed.ask] } } : { at: 'loading' },
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [info, setInfo] = useState(false);
  // 🔒 The lowest is read ONLY on the supplier's side, only for a counter (the hosts' session never asks).
  const lowestState = useLowestState(threadId);
  useEffect(() => {
    if (viewer === 'vendor' && kind === 'counter' && seed?.lowestCentavos === undefined) void loadLowest(threadId);
  }, [viewer, kind, threadId, seed?.lowestCentavos]);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void Promise.all([loadChangeAsks(threadId), loadNegotiation(threadId)]).then(([a, q]) => {
      if (!a.ok || !q.ok) return setRead({ at: 'failed' });
      const t = Date.parse(askedAt);
      const ask =
        a.asks.find((x) => x.kind === kind && Math.abs(Date.parse(x.askedAt) - t) < 2000) ?? null;
      setRead({ at: 'ok', data: { ask, quote: q.quote, asks: a.asks } });
    });
  }, [threadId, askedAt, kind]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);
  if (read.at === 'ok' && !read.data.ask) return null;
  const today = seed?.today ?? manilaToday();
  const ask = read.at === 'ok' ? read.data.ask! : null;
  const quote = read.at === 'ok' ? read.data.quote : null;
  const asks = read.at === 'ok' ? read.data.asks : [];
  const mine = ask ? (ask.raisedBy === 'supplier') === (viewer === 'vendor') : false;
  const who = mine ? 'You' : viewer === 'vendor' ? 'The hosts' : 'The supplier';
  const until = goodUntilWords(ask?.goodUntil ?? null, today);
  const onLiveQuote = !!ask && !!quote && ask.proposalId === quote.proposalId;
  const paid = new Set(quote?.paidSeqs ?? []);
  const outcome =
    ask && quote && onLiveQuote && ask.amountCentavos != null
      ? counterOutcome({
          totalCentavos: quote.totalCentavos,
          lines: quote.lines,
          amountCentavos: ask.amountCentavos,
          scopeLabel: ask.scopeLabel ?? null,
          floorCentavos: quote.floorCentavos,
          planRows: quote.planRows,
          paidSeqs: paid,
        })
      : null;
  const answer = async (a: 'accepted' | 'declined') => {
    if (!ask) return;
    setBusy(true);
    setProblem(null);
    const fd = new FormData();
    fd.set('ask_id', ask.askId);
    fd.set('answer', a);
    const r = await answerChangeAskFromChat(fd);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setRead({ at: 'ok', data: { ask: { ...ask, status: a }, quote, asks } });
  };
  const title = kind === 'counter' ? `Counter · ${ask?.scopeLabel ?? 'the total'}` : 'Payment plan · counter';
  const turn: CardTurn = !ask
    ? 'wait'
    : ask.status === 'accepted'
      ? 'done'
      : ask.status === 'declined' || ask.status === 'countered'
        ? 'old'
        : ask.status === 'open' && !until.expired && onLiveQuote && !ask.moneyHidden && !mine
          ? 'me'
          : 'wait';
  // 🔒 "Under your lowest" — the supplier's own private number, read on the supplier's side only (the hosts' session
  // never asks; RLS would answer nothing — migration 20271351728770). An unread lowest says nothing.
  const lowestOf = seed?.lowestCentavos !== undefined ? seed.lowestCentavos : lowestState.at === 'ok' ? lowestState.centavos : null;
  const lowest = viewer === 'vendor' && kind === 'counter' && !mine ? lowestOf : null;
  const underLowest = !!ask && ask.status === 'open' && !until.expired && !!outcome && isUnderLowest(lowest, outcome.newTotalCentavos);

  // What the card held before the face (amount · gap · their words · Good until · what Accept makes · the lowest).
  // On the counter it lives behind ⓘ (open) or inside the settled line (settled); the plan still shows it on the card.
  const details =
    read.at === 'ok' && ask ? (
      <div className="grid gap-2" data-negotiation-details={kind}>
        {kind === 'counter' ? (
          <p className="text-[20px] font-semibold tabular-nums text-ink">
            {ask.moneyHidden ? (
              HOSTS_ONLY
            ) : ask.amountCentavos == null ? (
              // A counter whose amount did not come back is unknown — never drawn as ₱0.
              <span className="text-ink/60" data-counter-amount-unknown="">{AMOUNT_UNKNOWN}</span>
            ) : (
              pesos(ask.amountCentavos)
            )}{' '}
            {outcome ? (
              <span className="text-[14px] font-normal text-ink/60">
                {ask.scopeLabel ? `for ${ask.scopeLabel} · was ${pesos(outcome.wasCentavos)}` : `instead of ${pesos(outcome.wasCentavos)}`}
              </span>
            ) : null}
            {/* The counter kind's signature: the gap, as the kind's own pill. */}
            {outcome && !ask.moneyHidden && ask.amountCentavos != null && ask.amountCentavos !== outcome.wasCentavos ? (
              <span className="ml-1 align-middle">
                <KindTag kind="counter">
                  {ask.amountCentavos < outcome.wasCentavos ? '−' : '+'}
                  {pesos(Math.abs(outcome.wasCentavos - ask.amountCentavos))}
                </KindTag>
              </span>
            ) : null}
          </p>
        ) : ask.moneyHidden ? (
          <p className="text-[15px] text-ink/60">{HOSTS_ONLY}</p>
        ) : (
          <>
            {/* The plan's signature: one segment per payment, as wide as its share. */}
            <SegBar amounts={(ask.proposedPlan ?? []).map((r) => r.amount_centavos)} />
            <PlanRows rows={ask.proposedPlan ?? []} paid={paid} />
          </>
        )}
        {ask.note.trim() ? <p className="text-[15px] text-ink/80">&ldquo;{ask.note}&rdquo;</p> : null}
        {ask.status === 'open' && !until.expired && until.words ? <p className="text-[13px] text-ink/55">{until.words}</p> : null}
        {/* What Accept would make — the plan re-split, paid rows fixed, and any money owed back (owner 12 Nov). */}
        {ask.status === 'open' && !until.expired && outcome?.rows ? <PlanRows rows={outcome.rows} paid={paid} owedBack={outcome.owedBackCentavos} /> : null}
        {/* 🤝 Their counter is under the supplier's own lowest: said before Accept, never blocking it. */}
        {underLowest && lowest != null ? (
          <p className="text-[13px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }} role="status" data-under-lowest="">
            Under your lowest, {pesos(lowest)}. Only your shop sees that.
          </p>
        ) : null}
      </div>
    ) : null;
  const status = (textOnly: boolean) =>
    ask ? (
      <Status
        ask={ask}
        mine={mine}
        expired={until.expired}
        expiredWords={until.words}
        viewer={viewer}
        busy={busy}
        stale={!onLiveQuote}
        blocked={outcome?.refusal ?? null}
        onAnswer={(a) => void answer(a)}
        onCounter={kind === 'counter' ? () => setCountering(true) : null}
        textOnly={textOnly}
      />
    ) : null;
  const counterEditor =
    countering && quote && ask ? (
      <div className="mt-1 grid gap-2 border-t border-ink/10 pt-3" data-counter-back="">
        <CounterBody
          threadId={threadId}
          quote={quote}
          supplierName="The supplier"
          today={today}
          asks={asks}
          initialScope={ask.scopeLabel ?? null}
          // On the total the price opens on the suggested counter (their ask · your quote, never under the
          // supplier's lowest — `counterContext`). On ONE line: halfway between their price and the line's.
          initialAmount={ask.scopeLabel && ask.amountCentavos != null && outcome ? lineHalfway(ask.amountCentavos, outcome.wasCentavos) : undefined}
          counters={ask.askId}
          viewer={viewer}
          onClose={() => setCountering(false)}
          onSent={() => {
            setCountering(false);
            setRead({ at: 'ok', data: { ask: { ...ask, status: 'countered' }, quote, asks } });
          }}
        />
      </div>
    ) : null;
  const settled =
    ask && (ask.status === 'accepted' || ask.status === 'declined' || ask.status === 'countered')
      ? kind === 'counter'
        ? `${counterWords(ask)} · ${ask.status === 'accepted' ? 'accepted' : ask.status === 'declined' ? 'declined' : 'answered'}`
        : `${title} · ${ask.status === 'accepted' ? 'Accepted' : ask.status === 'declined' ? 'Declined' : 'Countered'}`
      : undefined;
  const negotiationStatus = ask ? (until.expired && ask.status === 'open' ? 'expired' : ask.status) : undefined;

  // ── The plan (unchanged): the whole body on the card ──
  if (kind === 'plan' || read.at !== 'ok' || !ask || settled !== undefined) {
    return (
      <KindCard kind={kind === 'counter' ? 'counter' : 'payment'} topic="payment" mark={kind === 'plan' ? 'plan' : undefined} kicker={ask ? who : '…'} title={title} tone={mine ? 'mine' : 'theirs'} turn={turn} settled={settled}>
        {read.at === 'loading' ? (
          <Loading />
        ) : read.at === 'failed' ? (
          <CouldNotLoad what="this counter" onRetry={load} />
        ) : (
          <div className="grid gap-2" data-negotiation={kind} data-negotiation-status={negotiationStatus}>
            {details}
            {status(false)}
            {counterEditor}
            <Problem text={problem} />
          </div>
        )}
      </KindCard>
    );
  }

  // ── 🤝 THE COUNTER'S FACE (Unichat part C, controller ruling 20 Nov — drawing UNICHAT-LIVE-2026-11-19 `cardHTML`
  // counter): old price → new price, ONE line under it ("Under your lowest", or the gap · until), ⓘ, and
  // Decline · Counter · Accept. Everything else the card used to print is in the ⓘ sheet — nothing is lost.
  const answers = turn === 'me';
  const words = ask.moneyHidden
    ? 'The hosts answer this one'
    : until.expired
      ? (until.words ?? 'Expired · ask again')
      : !onLiveQuote
        ? 'The quote changed · counter again'
        : underLowest && answers
          ? 'Under your lowest'
          : [gapShort(ask, outcome), untilShort(ask.goodUntil)].filter(Boolean).join(' · ') || who;
  const sheetTitle = `counter-sheet-${ask.askId}`;
  return (
    <>
      <KindCard
        kind="counter"
        topic="payment"
        kicker={words}
        warn={underLowest && answers}
        title={<CounterTitle ask={ask} wasCentavos={outcome?.wasCentavos ?? null} />}
        hero={!ask.scopeLabel}
        tone={mine ? 'mine' : 'theirs'}
        turn={turn}
        info={{ onOpen: () => setInfo(true), data: { 'data-counter-info': '', 'data-negotiation': kind, 'data-negotiation-status': negotiationStatus } }}
      >
        {answers || counterEditor || problem ? (
          <div className="grid gap-2" data-counter-face="">
            {answers && !countering ? status(false) : null}
            {counterEditor}
            <Problem text={problem} />
          </div>
        ) : null}
      </KindCard>
      <Sheet open={info} onClose={() => setInfo(false)} labelledById={sheetTitle} rise>
        <div className="grid gap-3 px-4 pb-5 pt-1" data-counter-sheet="">
          <div>
            <p id={sheetTitle} className="text-base font-semibold text-ink">
              {title}
            </p>
            <p className="mt-0.5 text-[13px] text-ink/70">Counter from {mine ? 'you' : who === 'The hosts' ? 'the hosts' : 'the supplier'}.</p>
          </div>
          {details}
          {status(true)}
        </div>
      </Sheet>
    </>
  );
}

/** The face's title: ~~₱was~~ → ₱new on the total; "Line → ₱new" on one line; the hosts-only words when money is hidden. */
function CounterTitle({ ask, wasCentavos }: { ask: ChangeAskRow; wasCentavos: number | null }) {
  if (ask.moneyHidden) return <>{HOSTS_ONLY}</>;
  // An amount that did not come back is unknown — never drawn as ₱0 (the honest-read rule).
  const now =
    ask.amountCentavos == null ? (
      <span className="font-semibold text-ink/60" data-counter-amount-unknown="">
        {AMOUNT_UNKNOWN}
      </span>
    ) : (
      pesos(ask.amountCentavos)
    );
  const arrow = <ArrowRight aria-label="to" className="mx-1 inline h-3.5 w-3.5 align-[-2px] text-ink/70" strokeWidth={2} />;
  if (ask.scopeLabel) {
    return (
      <span data-counter-title="line">
        {ask.scopeLabel}
        {arrow}
        {now}
      </span>
    );
  }
  return (
    <span data-counter-title="total">
      {wasCentavos != null ? <s className="text-[13px] font-normal text-ink/70">{pesos(wasCentavos)}</s> : null}
      {wasCentavos != null ? arrow : null}
      {now}
    </span>
  );
}

/** "₱55,000" / "Second shooter → ₱8,000" — the settled line's words (the drawing's `tc`). */
function counterWords(ask: ChangeAskRow): string {
  if (ask.moneyHidden) return 'Counter';
  const now = ask.amountCentavos == null ? AMOUNT_UNKNOWN : pesos(ask.amountCentavos);
  return ask.scopeLabel ? `${ask.scopeLabel} → ${now}` : now;
}

/** "−₱5,000" — the gap on the total, signed; nothing on one line or when it is the same price. */
function gapShort(ask: ChangeAskRow, outcome: { wasCentavos: number } | null): string | null {
  if (ask.scopeLabel || !outcome || ask.amountCentavos == null || ask.amountCentavos === outcome.wasCentavos) return null;
  return `${ask.amountCentavos < outcome.wasCentavos ? '−' : '+'}${pesos(Math.abs(outcome.wasCentavos - ask.amountCentavos))}`;
}

/** "until 18 Nov" — the Good until on the face, short (the whole words are in ⓘ). */
function untilShort(goodUntil: string | null | undefined): string | null {
  if (!goodUntil) return null;
  const label = new Date(`${goodUntil.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `until ${label}`;
}

function Status({
  ask,
  mine,
  expired,
  expiredWords,
  viewer,
  busy,
  stale,
  blocked,
  onAnswer,
  onCounter,
  textOnly = false,
}: {
  ask: ChangeAskRow;
  mine: boolean;
  expired: boolean;
  expiredWords: string | null;
  viewer: Viewer;
  busy: boolean;
  stale: boolean;
  blocked: string | null;
  onAnswer: (a: 'accepted' | 'declined') => void;
  onCounter: (() => void) | null;
  /** The ⓘ sheet: the state in words, never a second set of buttons (they live on the card's face). */
  textOnly?: boolean;
}) {
  const line = (text: string, ok = false) => (
    <p className={`rounded-lg px-3 py-2 text-[13px] font-medium ${ok ? 'bg-success-50 text-success-700' : 'bg-ink/[0.05] text-ink/65'}`}>{text}</p>
  );
  if (ask.status === 'accepted') return line((ask.kind ?? (ask.amountCentavos != null ? 'counter' : 'plan')) === 'counter' ? 'Accepted · the new version is the quote now · what was paid stays' : 'Accepted · the new plan is on the quote now', true);
  if (ask.status === 'declined') return line('Declined');
  if (ask.status === 'countered') return line('Countered');
  if (ask.status !== 'open') return null;
  if (expired) return line(expiredWords ?? 'Expired · ask again');
  if (stale) return line('The quote changed since — counter again on the new one');
  // 💰 Money withheld from this reader: they cannot weigh the price, so they do not answer it — the hosts do.
  if (ask.moneyHidden) return line('The hosts answer this one');
  if (mine) return line(`Waiting for ${viewer === 'vendor' ? 'the hosts' : 'the supplier'}`);
  if (textOnly) return line(blocked ? `Your turn · ${blocked}` : 'Your turn · Decline, Counter or Accept on the card');
  return (
    <>
      {blocked ? <Problem text={blocked} /> : null}
      <EqualRow>
        <ActionButton tone="neutral" icon={X} label="Decline" onClick={() => onAnswer('declined')} waiting={busy} />
        {onCounter ? <ActionButton tone="neutral" icon={MessageCircleQuestion} label="Counter" onClick={onCounter} /> : null}
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label="Accept"
          onClick={() => onAnswer('accepted')}
          waiting={busy}
          disabled={!!blocked}
        />
      </EqualRow>
    </>
  );
}
