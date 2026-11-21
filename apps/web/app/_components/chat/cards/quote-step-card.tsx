'use client';

/**
 * 🧾 CHANGE QUOTE — the supplier's (+) Quote: the live quote, opened as a RECEIPT (Unichat part C, owner 20 Nov 2026:
 * "build it now, I am happy with the design"; drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`, the quote tool).
 * It replaces the five-step walk of Supplier Build 3 (Add · Change · Remove → which line → price → review → valid
 * until): the same change, on ONE receipt with the quote maker's real parts — lines, Crew meal, Transport, Discount,
 * How they pay — priced by the maker's own resolvers (`lib/quote-receipt.ts`).
 *
 * Owner, 8–9 Nov, all still held: only the supplier edits the price; the paid quotation is the FLOOR ("Can't go below
 * ₱X — what they paid for. Add something to swap."); a change is a NEW VERSION the hosts accept again; no lifetime
 * quotation (Valid until is required — it opens FILLED and is shown, cut 7).
 *
 * Send posts the SHIPPED writer (`sendCustomProposalFromChat`): supersede + the quote card + accept again. The plan
 * rides along, so the auto "Final balance" absorbs the difference; the server refuses Σ ≠ the quote, and the database
 * refuses a total under the paid floor (migration 20271332041210) — the card's own checks only draw.
 * `seed.target` / `target`: the price agreed in the chat — the receipt opens AT it (the difference in the Discount).
 * `frame="bare"` = hosted inside the text box on a phone (the composer owns the title and the ✕).
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { FilePlus2, Send, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { sendCustomProposalFromChat } from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { formatCentavosPhp } from '@/lib/php';
import { quoteExtraPriceWords } from '@/lib/quote-line-price-words';
import { deltaWords, floorRefusal } from '@/lib/chat-cards';
import { addDaysIso, manilaTodayIsoFor, validUntilRefusal } from '@/lib/quote-valid-until';
import { goodUntilWords, makeQuoteGoodUntil } from '@/lib/make-a-quote';
import { fitReceiptToTarget, receiptFromStored, receiptKey, receiptMoney, receiptPlanChoices, receiptRefusal, type ReceiptDraft } from '@/lib/quote-receipt';
import type { AvailabilityStyle } from '@/lib/availability-styles';
import { supplierChangeOrderHref } from '@/lib/chat-plus';
import { loadCardAvailability, loadQuoteForCard, type QuoteForCard } from './card-calls';
import { MakeQuoteCard } from './make-quote-card';
import { CouldNotLoad, EditorShell, EmptyLine, Loading, Problem, type EditorFrame, type Read } from './card-bits';
import { UnderLowestLine } from './lowest-price';
import { QuoteReceipt, ReceiptPlanRow, receiptPlanProblem, receiptSchedule } from './quote-receipt';

/** The locked-quote sentence (CHAT-19) — drawn with its door to the change orders. */
const DEAL_LOCKED_LINE = 'This booking is already locked at the accepted quote — a change now goes through a change order.';
/** Why the Discount moved when the receipt opens at a price agreed in the chat (the drawing's words). */
const AGREED_WHY = 'As discussed';

export function QuoteStepCard({
  threadId,
  eventDate,
  onClose,
  onSent,
  seed,
  target = null,
  frame = 'card',
}: {
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  /** Labs only — a quote to draw without a read. */
  seed?: { quote: QuoteForCard | null; validUntil?: string; target?: number };
  /** The total agreed in the chat, in centavos: the receipt opens at it. Null = opens as the quote stands. */
  target?: number | null;
  frame?: EditorFrame;
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
    <EditorShell frame={frame} topic="quote" title="Change quote" onClose={onClose}>
      {body}
    </EditorShell>
  );
  if (read.at === 'loading') return shell(<Loading />);
  if (read.at === 'failed') return shell(<CouldNotLoad what="your quote" onRetry={load} />);
  const q = read.data;
  // 🧾 No quote out yet (cut 7, 2026-11-14): the short Make a quote card, never a dead "No quote in this chat yet".
  if (!q) return <MakeQuoteCard threadId={threadId} eventDate={eventDate} onClose={onClose} onSent={onSent} frame={frame} />;
  if (q.locks.quote) return shell(<EmptyLine line="Your quotation is final — unlock it in Details to change it." />);
  // 🔒 CHAT-19 (walk 16 Nov): the sentence named a change order with no way to one — it now opens the shipped
  // Change orders ("Propose a change", the picked client's Schedule).
  if (q.requote === 'deal_locked')
    return shell(
      <EmptyLine line={DEAL_LOCKED_LINE}>
        <ActionButton tone="brand" main icon={FilePlus2} label="Propose a change order" href={supplierChangeOrderHref(q.eventId)} onClick={onClose} />
      </EmptyLine>,
    );
  if (q.requote === 'lock_requested') return shell(<EmptyLine line="They asked to lock at the quote they accepted. Answer that first." />);
  return shell(
    <QuoteReceiptForm q={q} threadId={threadId} eventDate={eventDate} onClose={onClose} onSent={onSent} target={seed?.target ?? target} startValidUntil={seed?.validUntil} lab={!!seed} />,
  );
}

function QuoteReceiptForm({
  q,
  threadId,
  eventDate,
  onClose,
  onSent,
  target,
  startValidUntil,
  lab,
}: {
  q: QuoteForCard;
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  target: number | null;
  startValidUntil?: string;
  lab: boolean;
}) {
  const formId = useId();
  const today = manilaTodayIsoFor(Date.now());
  const [draft, setDraft] = useState<ReceiptDraft>(() => {
    const stored = receiptFromStored(q.items);
    return target != null && target > 0 ? fitReceiptToTarget(stored, target, AGREED_WHY) : stored;
  });
  const money = useMemo(() => receiptMoney(draft), [draft]);
  const plans = useMemo(() => receiptPlanChoices(q.plan, q.paidSeqs.length > 0, true), [q.plan, q.paidSeqs]);
  const [planKey, setPlanKey] = useState(plans[0]!.key);
  const plan = (plans.find((c) => c.key === planKey) ?? plans[0]!).plan;
  // Valid until opens FILLED and shown: the quote's own date while it is still good, else 14 days (or the event day).
  const [validUntil, setValidUntil] = useState<string | null>(
    () => startValidUntil ?? (q.validUntil && !validUntilRefusal(q.validUntil, today, eventDate) ? q.validUntil : makeQuoteGoodUntil(today, eventDate)),
  );
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  // How each card books — a refused read leaves the lines without a tag (never "one a day" by default).
  const [tags, setTags] = useState<Record<string, AvailabilityStyle> | null>(null);
  useEffect(() => {
    if (lab) return;
    let live = true;
    void loadCardAvailability(threadId).then((r) => {
      if (live && r.ok) setTags(r.byCard);
    });
    return () => {
      live = false;
    };
  }, [lab, threadId]);

  const changed = JSON.stringify(money.lineItems) !== JSON.stringify(q.items) || planKey !== plans[0]!.key;
  const refusal =
    receiptRefusal(draft, money) ??
    floorRefusal(money.net, q.floorCentavos) ??
    receiptPlanProblem(plan, money, q.paidSeqs) ??
    validUntilRefusal(validUntil, today, eventDate);

  const payload = JSON.stringify({
    lineItems: money.lineItems,
    validUntil,
    title: q.title,
    note: note.trim() || null,
    schedule: receiptSchedule(plan, money),
    paymentMethodIds: q.paymentMethodIds,
    includesSetnayanGift: q.gift,
    serviceCardIds: q.serviceCardIds,
  });

  return (
    <form
      id={formId}
      data-change-quote=""
      className="grid gap-3"
      action={async (fd) => {
        if (refusal || !changed) return;
        setSending(true);
        onSent?.();
        await sendCustomProposalFromChat(fd);
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="payload" value={payload} />
      <QuoteReceipt draft={draft} onDraft={setDraft} money={money} tags={tags} />
      {q.extras.length > 0 ? (
        <div className="flex">
          <PickMenu
            label="Add from your catalogue"
            value={null}
            options={q.extras.map((x) => ({ key: x.id, label: `${x.label} · ${quoteExtraPriceWords(x)}` }))}
            onPick={(k) => {
              const x = q.extras.find((e) => e.id === k);
              if (x) setDraft((d) => ({ ...d, lines: [...d.lines, { key: receiptKey(), label: x.label, pricePhp: x.pricePhp, qty: Math.max(1, Math.round(x.qty)), free: x.free, cardId: null, src: null }] }));
            }}
            buttonText="Add from your catalogue"
            dataAttr="data-quote-add"
          />
        </div>
      ) : null}
      <TotalStrip agreed={q.totalCentavos} next={money.net} />
      {/* 🤝 Under the supplier's private lowest: ONE quiet line, never a block (owner 19 Nov 2026). */}
      <UnderLowestLine threadId={threadId} totalCentavos={money.net} />
      <ReceiptPlanRow choices={plans} pick={planKey} onPick={setPlanKey} money={money} paidSeqs={q.paidSeqs} />
      <DateRow
        name="Valid until"
        about={{ words: eventDate ? 'Required — no lifetime quotation. After today, on or before the event date.' : 'Required — no lifetime quotation. After today.' }}
        value={validUntil}
        note={validUntil && validUntil > today ? goodUntilWords(validUntil, today) : null}
        today={today}
        min={addDaysIso(today, 1)}
        max={eventDate}
        onKeep={(d) => setValidUntil(d)}
        data="change-quote-valid-until"
      />
      <TypedRow name="Note" value={note} empty="Optional" placeholder="A short message that appears above the quote." long maxLength={500} onType={setNote} onKeep={setNote} data="change-quote-note" />
      {changed ? <Problem text={refusal} /> : <p className="text-[14px] text-ink/70">No change yet.</p>}
      <EqualRow>
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => onClose?.()} />
        <ActionButton tone="brand" main icon={Send} label="Send new version" type="submit" disabled={Boolean(refusal) || !changed || sending} />
      </EqualRow>
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
