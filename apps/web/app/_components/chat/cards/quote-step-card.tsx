'use client';

/**
 * 🧾 CHANGE QUOTE — the supplier's (+) Quote, one step at a time (Supplier Build 3 · lane C; prototype v8.3 `STEPS.quote`).
 *
 * Owner, 8–9 Nov: only the supplier edits the price; the paid quotation is the FLOOR ("Can't go below ₱X — what they
 * paid for. Add something to swap."); a change is a NEW VERSION the hosts accept again; no lifetime quotation (Valid
 * until is required). Steps: ① Add · Change · Remove → ② which line / what to add → ③ its price (or confirm the
 * remove) → ④ Review, then send (tap a line to change it · swipe left to remove it · Another change) → ⑤ Valid until.
 *
 * Send posts the SHIPPED writer (`sendCustomProposalFromChat`): supersede + the quote card + accept again. The stored
 * payment plan rides along, so the auto "Final balance" absorbs the difference; the server refuses Σ ≠ the quote, and
 * the database refuses a total under the paid floor (migration 20271332041210) — the card's own checks only draw.
 */
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Pencil, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { sendCustomProposalFromChat } from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { formatCentavosPhp } from '@/lib/php';
import { applyQuoteEdits, deltaWords, floorRefusal, linesTotal, planLedger, toProposalLineItems, type MarkedLine, type QuoteEdit } from '@/lib/chat-cards';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { loadQuoteForCard, type QuoteForCard } from './card-actions';
import { CouldNotLoad, EmptyLine, LedgerStrip, Loading, Problem, type Read } from './card-bits';

type Op = 'add' | 'edit' | 'remove';
type Cur = { op: Op | null; pick: string | null; key: string | null; name: string; pricePhp: string };
const NONE: Cur = { op: null, pick: null, key: null, name: '', pricePhp: '' };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function QuoteStepCard({
  threadId,
  eventDate,
  onClose,
  onSent,
  seed,
}: {
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  /** Labs only — a quote to draw without a read. */
  seed?: { quote: QuoteForCard | null; edits?: QuoteEdit[]; step?: number; validUntil?: string };
}) {
  const [read, setRead] = useState<Read<QuoteForCard | null>>(seed ? { at: 'ok', data: seed.quote } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadQuoteForCard(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: r.quote } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const shell = (body: React.ReactNode) => (
    <ChatCardShell topic="quote" kicker="You · not sent yet" title="Change quote" onClose={onClose}>
      {body}
    </ChatCardShell>
  );
  if (read.at === 'loading') return shell(<Loading />);
  if (read.at === 'failed') return shell(<CouldNotLoad what="your quote" onRetry={load} />);
  const q = read.data;
  if (!q) return shell(<EmptyLine line="No quote in this chat yet — send one from your service card first." />);
  if (q.locks.quote) return shell(<EmptyLine line="Your quotation is final — unlock it in Details to change it." />);
  if (q.requote === 'deal_locked') return shell(<EmptyLine line="This booking is already locked at the accepted quote — use a change order instead of a new quote." />);
  if (q.requote === 'lock_requested') return shell(<EmptyLine line="They asked to lock at the quote they accepted. Answer that first." />);
  return <QuoteSteps q={q} threadId={threadId} eventDate={eventDate} onClose={onClose} onSent={onSent} seed={seed} />;
}

function QuoteSteps({
  q,
  threadId,
  eventDate,
  onClose,
  onSent,
  seed,
}: {
  q: QuoteForCard;
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  seed?: { edits?: QuoteEdit[]; step?: number; validUntil?: string };
}) {
  const formId = useId();
  const [step, setStep] = useState(seed?.step ?? 0);
  const [edits, setEdits] = useState<QuoteEdit[]>(seed?.edits ?? []);
  const [cur, setCur] = useState<Cur>(NONE);
  const [validUntil, setValidUntil] = useState<string | null>(seed?.validUntil ?? null);
  const [undo, setUndo] = useState<{ text: string; before: QuoteEdit[] } | null>(null);
  const [sending, setSending] = useState(false);
  const n = useRef(0);

  const lines = applyQuoteEdits(q.lines, edits);
  const live = lines.filter((l) => l.mark !== 'rm');
  const total = linesTotal(lines);
  const curPriceC = Math.round(Number(cur.pricePhp.replace(/[^\d.]/g, '')) * 100) || 0;
  const preview = cur.op ? applyQuoteEdits(q.lines, [...edits, ...pending(cur, curPriceC)]) : lines;
  const previewTotal = linesTotal(preview);
  const under = floorRefusal(previewTotal, q.floorCentavos);
  const underNow = floorRefusal(total, q.floorCentavos);
  const today = manilaTodayIsoFor(Date.now());
  const ledger = q.plan
    ? planLedger({ manual: q.plan.manual, autoBalance: q.plan.autoBalance, agreedCentavos: total, creditCentavos: q.creditCentavos, paidSeqs: new Set(q.paidSeqs) })
    : null;

  function pending(c: Cur, priceC: number): QuoteEdit[] {
    if (c.op === 'add' && (c.name.trim() || c.pick) && priceC >= 0) return [{ op: 'add', key: `n${n.current + 1}`, label: c.name.trim(), amountCentavos: priceC }];
    if (c.op === 'edit' && c.key) return [{ op: 'edit', key: c.key, amountCentavos: priceC }];
    if (c.op === 'remove' && c.key) return [{ op: 'remove', key: c.key }];
    return [];
  }
  const pushCur = () => {
    const add = pending(cur, curPriceC);
    if (add.length === 0) return;
    if (cur.op === 'add') n.current += 1;
    setEdits((e) => [...e, ...add]);
    setCur(NONE);
  };
  const removeLine = (l: MarkedLine) => {
    const before = edits;
    setEdits((e) => [...e, { op: 'remove', key: l.key }]);
    setUndo({ text: `${l.label} removed`, before });
  };

  const opOptions = [
    { key: 'add', label: 'Add a line' },
    { key: 'edit', label: 'Change a line' },
    { key: 'remove', label: 'Remove a line' },
  ];
  const lineOptions = live.map((l) => ({ key: l.key, label: `${l.label} · ${formatCentavosPhp(l.amountCentavos ?? 0)}` }));
  const addOptions = [
    ...q.extras.map((x) => ({ key: x.id, label: `${x.label} · ${formatCentavosPhp(Math.round(x.qty * x.pricePhp * 100))}` })),
    { key: 'custom', label: 'Something else (custom line)' },
  ];

  const s1: ChatCardStep = {
    title: 'What do you want to do?',
    body: (
      <PickMenu
        label="What do you want to do?"
        value={cur.op}
        options={opOptions}
        onPick={(k) => setCur({ ...NONE, op: k as Op })}
        buttonText={cur.op ? undefined : 'Add · Change · Remove'}
        dataAttr="data-quote-op"
      />
    ),
    ok: !!cur.op || edits.length > 0,
  };
  const s2: ChatCardStep =
    cur.op === 'add'
      ? {
          title: 'Add what?',
          sub: 'From your catalogue, or one custom line.',
          body: (
            <PickMenu
              label="Add what?"
              value={cur.pick}
              options={addOptions}
              onPick={(k) => {
                const x = q.extras.find((e) => e.id === k);
                setCur({ ...cur, pick: k, name: x ? x.label : '', pricePhp: x ? String(Math.round(x.qty * x.pricePhp)) : '' });
              }}
              buttonText={cur.pick ? undefined : 'Pick an add-on'}
              dataAttr="data-quote-add"
            />
          ),
          ok: !!cur.pick,
        }
      : {
          title: cur.op === 'remove' ? 'Remove which line?' : 'Which line?',
          body:
            lineOptions.length === 0 ? (
              <EmptyLine line="No lines left on this quote." />
            ) : (
              <PickMenu
                label="Which line?"
                value={cur.key}
                options={lineOptions}
                onPick={(k) => {
                  const l = live.find((x) => x.key === k);
                  setCur({ ...cur, key: k, name: l?.label ?? '', pricePhp: l?.amountCentavos != null ? String(l.amountCentavos / 100) : '' });
                }}
                buttonText={cur.key ? undefined : 'Pick a line'}
                dataAttr="data-quote-line"
              />
            ),
          ok: !!cur.key || (!cur.op && edits.length > 0),
        };
  const s3: ChatCardStep =
    cur.op === 'remove'
      ? {
          title: 'Remove this line?',
          body: (
            <div className="grid gap-2">
              <LineRows lines={preview.filter((l) => l.key === cur.key)} />
              <Problem text={under} />
            </div>
          ),
          ok: !!cur.key && !under,
        }
      : {
          title: cur.op === 'add' && cur.pick === 'custom' ? 'Name and price' : 'New price',
          body: (
            <div className="grid gap-1">
              {cur.op === 'add' && cur.pick === 'custom' ? (
                <TypedRow name="Line name" value={cur.name} empty="Name it" maxLength={120} openAsk={1} onType={(v) => setCur((c) => ({ ...c, name: v }))} onKeep={(v) => setCur((c) => ({ ...c, name: v }))} />
              ) : null}
              <TypedRow
                name="Price"
                amount
                value={cur.pricePhp}
                empty="₱"
                openAsk={cur.op === 'add' && cur.pick === 'custom' ? 0 : 1}
                onType={(v) => setCur((c) => ({ ...c, pricePhp: v }))}
                onKeep={(v) => setCur((c) => ({ ...c, pricePhp: v }))}
              />
              <TotalStrip agreed={q.totalCentavos} next={previewTotal} />
              <Problem text={under} />
            </div>
          ),
          ok: (!cur.op && edits.length > 0) || (cur.op != null && cur.pricePhp.trim() !== '' && (cur.op !== 'add' || !!cur.name.trim()) && !under),
        };
  const s4: ChatCardStep = {
    title: 'Review, then send',
    sub: 'Tap a line to change it · swipe left to remove it',
    body: (
      <div className="grid gap-2">
        <LineRows
          lines={lines}
          onTap={(l) => {
            setCur({ op: 'edit', pick: null, key: l.key, name: l.label, pricePhp: l.amountCentavos != null ? String(l.amountCentavos / 100) : '' });
            setStep(2);
          }}
          onSwipe={removeLine}
        />
        <TotalStrip agreed={q.totalCentavos} next={total} />
        {ledger ? <LedgerStrip ledger={ledger} /> : null}
        <Problem text={underNow ?? (ledger && !ledger.paysInFull ? ledger.problem : null)} />
        {edits.length === 0 ? <p className="text-[14px] text-ink/55">No change yet.</p> : null}
        <div className="flex">
          <ActionButton
            tone="neutral"
            icon={Pencil}
            label="Another change"
            onClick={() => {
              setCur(NONE);
              setStep(0);
            }}
          />
        </div>
        {undo ? (
          <p role="status" className="flex items-center justify-between gap-2 rounded-full bg-ink px-4 py-1.5 text-[13px] text-cream">
            {undo.text}
            <ActionButton
              tone="neutral"
              quiet
              icon={Undo2}
              label="Undo"
              onClick={() => {
                setEdits(undo.before);
                setUndo(null);
              }}
            />
          </p>
        ) : null}
      </div>
    ),
    ok: edits.length > 0 && !underNow && (!ledger || ledger.paysInFull),
  };
  const s5: ChatCardStep = {
    title: 'Valid until?',
    sub: eventDate ? 'Required — no lifetime quotation. After today, on or before the event date.' : 'Required — no lifetime quotation. After today.',
    body: <DateRow name="Valid until" value={validUntil} today={today} min={addDays(today, 1)} max={eventDate} onKeep={(d) => setValidUntil(d)} />,
    ok: !!validUntil && validUntil > today && (!eventDate || validUntil <= eventDate),
  };

  const payload = JSON.stringify({
    lineItems: toProposalLineItems(lines),
    validUntil,
    title: q.title,
    schedule: q.plan ? { manual: q.plan.manual, autoBalance: q.plan.autoBalance, creditCentavos: q.creditCentavos } : null,
    paymentMethodIds: q.paymentMethodIds,
    includesSetnayanGift: q.gift,
    serviceCardIds: q.serviceCardIds,
  });

  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        onSent?.();
        await sendCustomProposalFromChat(fd);
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="payload" value={payload} />
      <ChatStepCard
        topic="quote"
        kicker="You · not sent yet"
        title="Change quote"
        steps={[s1, s2, s3, s4, s5]}
        step={step}
        onStep={(next) => {
          // ③ → ④ keeps the change being made; ① with nothing new jumps straight to the review.
          if (step === 2 && next === 3) pushCur();
          if (step === 0 && next === 1 && !cur.op && edits.length > 0) return setStep(3);
          setStep(next);
        }}
        sending={sending}
        onClose={onClose}
        submitForm={formId}
      />
    </form>
  );
}

function TotalStrip({ agreed, next }: { agreed: number; next: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-xl bg-ink/[0.04] px-3 py-2 text-[14px]" data-quote-total="">
      <span className="text-ink/65">Now</span>
      <b className="text-right tabular-nums font-medium">{formatCentavosPhp(agreed)}</b>
      <span className="text-ink/65">New total</span>
      <b className="text-right tabular-nums">
        {formatCentavosPhp(next)} <span className={next < agreed ? 'text-danger-600' : 'text-success-700'}>({deltaWords(next, agreed)})</span>
      </b>
    </div>
  );
}

const MARK: Record<NonNullable<MarkedLine['mark']>, string> = { add: '+', chg: '✎', rm: '−' };

/** The lines, marked + added · ✎ changed · − removed. A tap opens a line; a swipe left removes it (owner, 4 Nov). */
function LineRows({ lines, onTap, onSwipe }: { lines: readonly MarkedLine[]; onTap?: (l: MarkedLine) => void; onSwipe?: (l: MarkedLine) => void }) {
  const sw = useRef<{ x: number; key: string; moved: boolean } | null>(null);
  const [dx, setDx] = useState<{ key: string; px: number } | null>(null);
  const down = (e: PointerEvent, l: MarkedLine) => {
    sw.current = { x: e.clientX, key: l.key, moved: false };
  };
  const move = (e: PointerEvent) => {
    const s = sw.current;
    if (!s) return;
    const d = e.clientX - s.x;
    if (d < -8) {
      s.moved = true;
      setDx({ key: s.key, px: Math.max(d, -90) });
    }
  };
  const up = (e: PointerEvent, l: MarkedLine) => {
    const s = sw.current;
    sw.current = null;
    setDx(null);
    if (!s) return;
    if (e.clientX - s.x < -60 && l.mark !== 'rm') onSwipe?.(l);
    else if (!s.moved && l.mark !== 'rm') onTap?.(l);
  };
  return (
    <ul className="grid divide-y divide-ink/10 border-y border-ink/10" data-quote-lines="">
      {lines.map((l) => (
        <li key={l.key} className="relative">
          <button
            type="button"
            disabled={!onTap || l.mark === 'rm'}
            onPointerDown={(e) => down(e, l)}
            onPointerMove={move}
            onPointerUp={(e) => up(e, l)}
            onPointerCancel={() => {
              sw.current = null;
              setDx(null);
            }}
            style={{ transform: dx?.key === l.key ? `translateX(${dx.px}px)` : undefined }}
            className="grid min-h-11 w-full touch-pan-y grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 bg-white px-3 py-2 text-left transition-transform duration-[var(--sn-pill-dur)] ease-[var(--sn-ease)] dark:bg-raised"
            data-quote-line-mark={l.mark ?? 'same'}
          >
            <span aria-hidden className={`text-[14px] font-semibold ${l.mark === 'rm' ? 'text-danger-600' : l.mark ? 'text-sn-accent' : 'text-ink/30'}`}>
              {l.mark ? MARK[l.mark] : '·'}
            </span>
            <span className={`min-w-0 ${l.mark === 'rm' ? 'text-ink/45 line-through' : 'text-ink'}`}>
              <span className="block truncate text-[15px]">{l.label}</span>
              {l.detail ? <span className="block truncate text-[12px] text-ink/55">{l.detail}</span> : null}
            </span>
            <span className={`tabular-nums text-[15px] ${l.mark === 'rm' ? 'text-ink/45 line-through' : ''}`}>{formatCentavosPhp(l.amountCentavos ?? 0)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
