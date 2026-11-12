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
import { Check, MessageCircleQuestion, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { formatCentavosPhp } from '@/lib/php';
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
import { ChatCardShell } from '../chat-step-card';
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
import { CouldNotLoad, EmptyLine, EqualRow, Loading, Problem, type Read } from './card-bits';

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

function useNegotiation(threadId: string, seed?: NegotiationQuote | null) {
  const [read, setRead] = useState<Read<NegotiationQuote | null>>(seed !== undefined ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadNegotiation(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: r.quote } : { at: 'failed' }));
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
}: {
  threadId: string;
  kind: NegotiateKind;
  viewer: Viewer;
  supplierName: string;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
  /** Lab only: open on these facts, no read. */
  seed?: { quote: NegotiationQuote | null; today?: string; scope?: string | null; amount?: string };
}) {
  const { read, load } = useNegotiation(threadId, seed ? seed.quote : undefined);
  const body =
    read.at === 'loading' ? (
      <Loading />
    ) : read.at === 'failed' ? (
      <CouldNotLoad what="the quote" onRetry={load} />
    ) : !read.data ? (
      <EmptyLine line="No quote in this chat yet — there is nothing to negotiate." />
    ) : kind === 'ask' ? (
      <AskBody threadId={threadId} quote={read.data} supplierName={supplierName} returnPath={returnPath} onClose={onClose} onSent={onSent} />
    ) : kind === 'counter' ? (
      <CounterBody
        threadId={threadId}
        quote={read.data}
        supplierName={supplierName}
        today={seed?.today ?? manilaToday()}
        initialScope={seed?.scope ?? null}
        initialAmount={seed?.amount}
        onClose={onClose}
        onSent={onSent}
      />
    ) : (
      <PlanBody threadId={threadId} quote={read.data} viewer={viewer} supplierName={supplierName} today={seed?.today ?? manilaToday()} onClose={onClose} onSent={onSent} />
    );
  return (
    <ChatCardShell topic={TOPIC[kind]} kicker="You · not sent yet" title={TITLE[kind]} onClose={onClose}>
      <div className="grid gap-2" data-negotiate-draft={kind}>
        {body}
      </div>
    </ChatCardShell>
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

function CounterBody({
  threadId,
  quote,
  supplierName,
  today,
  initialScope,
  initialAmount,
  onClose,
  onSent,
  counters,
}: {
  threadId: string;
  quote: NegotiationQuote;
  supplierName: string;
  today: string;
  initialScope: string | null;
  initialAmount?: string;
  onClose?: () => void;
  onSent?: () => void;
  /** Countering an open counter: its id (the server marks it 'countered'). */
  counters?: string | null;
}) {
  const lines = counterableLines(quote.lines);
  const [scope, setScope] = useState<string | null>(initialScope);
  const wasOf = (s: string | null) => (s ? (lines.find((l) => l.label === s)?.amountCentavos ?? 0) : quote.totalCentavos);
  const [amount, setAmount] = useState(initialAmount ?? openingPrice(wasOf(initialScope)));
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
            const s = k === '__total' ? null : k;
            setScope(s);
            setAmount(openingPrice(wasOf(s)));
          }}
          dataAttr="data-counter-scope"
        />
      </Row>
      <TypedRow name="Your price" amount value={amount} empty="₱" openAsk={0} onType={setAmount} onKeep={setAmount} />
      <p className="-mt-1 text-[13px] text-ink/55" data-counter-was="">instead of {pesos(out.wasCentavos)}</p>
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
  const options = planProposalOptions({
    totalCentavos: quote.totalCentavos,
    creditCentavos: quote.creditCentavos,
    liveRows: quote.planRows,
    paidSeqs: new Set(quote.paidSeqs),
  }).filter((o) => !o.same);
  const [pick, setPick] = useState<string | null>(options.find((o) => !o.shut)?.key ?? null);
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
  const chosen = options.find((o) => o.key === pick) ?? null;
  const send = async () => {
    if (!chosen || chosen.shut) return;
    setBusy(true);
    setProblem(null);
    const r = await proposePlanFromChat({
      threadId,
      proposalId: quote.proposalId,
      rows: chosen.rows as unknown as StoredPlanRow[],
      goodUntil: choices.find((c) => c.key === until)?.date ?? null,
      note: '',
    });
    setBusy(false);
    if (r.ok) onSent?.();
    else setProblem(r.message);
  };
  return (
    <>
      <Row label="Instead of" sub={planWords(quote.planRows)}>
        <PickMenu
          label="Propose a plan"
          value={pick}
          options={options.map((o) => ({ key: o.key, label: o.label, disabledNote: o.shut ?? undefined }))}
          onPick={setPick}
          buttonText={pick ? undefined : 'Pick a plan'}
          dataAttr="data-plan-pick"
        />
      </Row>
      {chosen ? <PlanRows rows={chosen.rows as unknown as StoredPlanRow[]} paid={new Set(quote.paidSeqs)} /> : null}
      <Row label="Good until" sub="then it expires">
        <PickMenu label="Good until" value={until} options={choices.map((c) => ({ key: c.key, label: c.label }))} onPick={setUntil} dataAttr="data-plan-until" />
      </Row>
      <Problem text={problem} />
      <SendRow label="Send" busy={busy} ok={!!chosen && !chosen.shut} onSend={() => void send()} onClose={onClose} />
    </>
  );
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
  seed?: { ask: ChangeAskRow; quote: NegotiationQuote | null; today?: string };
}) {
  const [read, setRead] = useState<Read<{ ask: ChangeAskRow | null; quote: NegotiationQuote | null }>>(
    seed ? { at: 'ok', data: { ask: seed.ask, quote: seed.quote } } : { at: 'loading' },
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void Promise.all([loadChangeAsks(threadId), loadNegotiation(threadId)]).then(([a, q]) => {
      if (!a.ok || !q.ok) return setRead({ at: 'failed' });
      const t = Date.parse(askedAt);
      const ask =
        a.asks.find((x) => (kind === 'counter' ? x.amountCentavos != null : x.proposedPlan != null) && Math.abs(Date.parse(x.askedAt) - t) < 2000) ?? null;
      setRead({ at: 'ok', data: { ask, quote: q.quote } });
    });
  }, [threadId, askedAt, kind]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);
  if (read.at === 'ok' && !read.data.ask) return null;
  const today = seed?.today ?? manilaToday();
  const ask = read.at === 'ok' ? read.data.ask! : null;
  const quote = read.at === 'ok' ? read.data.quote : null;
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
    setRead({ at: 'ok', data: { ask: { ...ask, status: a }, quote } });
  };
  const title = kind === 'counter' ? `Counter · ${ask?.scopeLabel ?? 'the total'}` : 'Payment plan · counter';
  return (
    <ChatCardShell topic="payment" kicker={`${ask ? who : '…'}${until.words && ask?.status === 'open' ? '' : ''}`} title={title} tone={mine ? 'mine' : 'theirs'}>
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="this counter" onRetry={load} />
      ) : (
        <div className="grid gap-2" data-negotiation={kind} data-negotiation-status={until.expired && ask!.status === 'open' ? 'expired' : ask!.status}>
          {kind === 'counter' ? (
            <p className="text-[20px] font-semibold tabular-nums text-ink">
              {pesos(ask!.amountCentavos ?? 0)}{' '}
              {outcome ? (
                <span className="text-[14px] font-normal text-ink/60">
                  {ask!.scopeLabel ? `for ${ask!.scopeLabel} · was ${pesos(outcome.wasCentavos)}` : `instead of ${pesos(outcome.wasCentavos)}`}
                </span>
              ) : null}
            </p>
          ) : (
            <PlanRows rows={ask!.proposedPlan ?? []} paid={paid} />
          )}
          {ask!.note.trim() ? <p className="text-[15px] text-ink/80">&ldquo;{ask!.note}&rdquo;</p> : null}
          {ask!.status === 'open' && !until.expired && until.words ? <p className="text-[13px] text-ink/55">{until.words}</p> : null}
          {/* What Accept would make — the plan re-split, paid rows fixed, and any money owed back (owner 12 Nov). */}
          {ask!.status === 'open' && !until.expired && outcome?.rows ? <PlanRows rows={outcome.rows} paid={paid} owedBack={outcome.owedBackCentavos} /> : null}
          <Status
            ask={ask!}
            mine={mine}
            expired={until.expired}
            expiredWords={until.words}
            viewer={viewer}
            busy={busy}
            stale={!onLiveQuote}
            blocked={outcome?.refusal ?? null}
            onAnswer={(a) => void answer(a)}
            onCounter={kind === 'counter' ? () => setCountering(true) : null}
          />
          {countering && quote && ask ? (
            <div className="mt-1 grid gap-2 border-t border-ink/10 pt-3" data-counter-back="">
              <CounterBody
                threadId={threadId}
                quote={quote}
                supplierName="The supplier"
                today={today}
                initialScope={ask.scopeLabel ?? null}
                initialAmount={String(Math.round(((ask.amountCentavos ?? 0) + (outcome?.wasCentavos ?? ask.amountCentavos ?? 0)) / 2 / 100 / 100) * 100)}
                counters={ask.askId}
                onClose={() => setCountering(false)}
                onSent={() => {
                  setCountering(false);
                  setRead({ at: 'ok', data: { ask: { ...ask, status: 'countered' }, quote } });
                }}
              />
            </div>
          ) : null}
          <Problem text={problem} />
        </div>
      )}
    </ChatCardShell>
  );
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
}) {
  const line = (text: string, ok = false) => (
    <p className={`rounded-lg px-3 py-2 text-[13px] font-medium ${ok ? 'bg-success-50 text-success-700' : 'bg-ink/[0.05] text-ink/65'}`}>{text}</p>
  );
  if (ask.status === 'accepted') return line(ask.amountCentavos != null ? 'Accepted · the new version is the quote now · what was paid stays' : 'Accepted · the new plan is on the quote now', true);
  if (ask.status === 'declined') return line('Declined');
  if (ask.status === 'countered') return line('Countered');
  if (ask.status !== 'open') return null;
  if (expired) return line(expiredWords ?? 'Expired · ask again');
  if (stale) return line('The quote changed since — counter again on the new one');
  if (mine) return line(`Waiting for ${viewer === 'vendor' ? 'the hosts' : 'the supplier'}`);
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
          label={ask.amountCentavos != null ? `Accept ${pesos(ask.amountCentavos)}` : 'Accept'}
          onClick={() => onAnswer('accepted')}
          waiting={busy}
          disabled={!!blocked}
        />
      </EqualRow>
    </>
  );
}
