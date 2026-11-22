'use client';

/**
 * 🧾 MAKE A QUOTE — the chat's ＋ before any quote is out (owner-approved supplier cut 7, 2026-11-14; prototype
 * `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 7). The walk: a quote could not be made in the chat —
 * it lived in the client's Quotation tab (~8 taps), and Send stayed dim until a hidden "How long is it valid?" was set.
 *
 * Now ＋ → Make a quote drops this short card: pick your cards, Your offer (starts at their own "from" prices), Good until
 * (FILLED — 14 days, or the event day if sooner — shown and changeable), a note. Send quote posts the SHIPPED writer
 * (`sendCustomProposalFromChat`), so it lands as the quote card the chat already shows (View quote · Waiting for them).
 * Full quotation opens today's builder (`#build-quote`).
 *
 * 🧾 ITEMISE (Unichat part C, owner 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19, the quote tool): the one offer opens
 * into a RECEIPT with the quote maker's real parts — a line per picked card, Crew meal, Transport, Discount, How they
 * pay — priced by the maker's own resolvers (`lib/quote-receipt.ts`). The one-price card is unchanged until it is
 * pressed; itemised, the receipt's lines and its schedule are what Send posts, through the same shipped writer.
 * `frame="bare"` = hosted inside the text box on a phone (the composer owns the title and the ✕).
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Check, ExternalLink, ListPlus, Send, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Explain } from '@/app/_components/explain';
import { TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { sendCustomProposalFromChat } from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { openPlusDoor, plusDoor } from '@/app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet';
import { formatCentavosPhp } from '@/lib/php';
import { manilaTodayIsoFor, addDaysIso } from '@/lib/quote-valid-until';
import {
  goodUntilWords,
  makeQuoteGoodUntil,
  makeQuoteLines,
  makeQuoteExtrasCentavos,
  type MakeQuoteExtraLine,
  makeQuoteOfferStart,
  makeQuoteRefusal,
  type MakeQuoteCardOption,
} from '@/lib/make-a-quote';
import { fitReceiptToTarget, receiptFromCards, receiptKey, receiptMoney, receiptPlanChoices, receiptRefusal, type ReceiptDraft } from '@/lib/quote-receipt';
import type { AvailabilityStyle } from '@/lib/availability-styles';
import { loadCardAvailability, loadCardsForMakeQuote } from './card-calls';
import { CouldNotLoad, EditorShell, EmptyLine, Loading, Problem, type EditorFrame, type Read } from './card-bits';
import { LowestRow, UnderLowestLine } from './lowest-price';
import { QuoteReceipt, ReceiptPlanRow, receiptPlanProblem, receiptSchedule } from './quote-receipt';

export const MAKE_A_QUOTE_TITLE = 'Make a quote';

export function MakeQuoteCard({
  threadId,
  eventDate,
  onClose,
  onSent,
  seed,
  prefill,
  frame = 'card',
}: {
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  /** Labs only — the shop's cards to draw without a read (`itemised` opens the receipt). */
  seed?: { cards: MakeQuoteCardOption[]; picked?: string[]; itemised?: boolean };
  /** `bare` = hosted inside the text box (the composer owns the title and the ✕). */
  frame?: EditorFrame;
  /**
   * 🎂 Opened from a couple's "Cake design" (Cake Maker ruling 8): the card it was made on, the estimate as the offer
   * and the design as the note. Every field stays the supplier's to change before Send quote. v6 §03: `lines` are the
   * design's priced picks, one quote line each after the card's own line (the card's line is the offer less them).
   */
  prefill?: { picked: string[]; offerCentavos: number; note: string; lines?: MakeQuoteExtraLine[] };
}) {
  const [read, setRead] = useState<Read<MakeQuoteCardOption[]>>(seed ? { at: 'ok', data: seed.cards } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadCardsForMakeQuote(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: r.cards } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const shell = (body: React.ReactNode) => (
    <EditorShell frame={frame} topic="quote" title={MAKE_A_QUOTE_TITLE} onClose={onClose}>
      {body}
    </EditorShell>
  );
  if (read.at === 'loading') return shell(<Loading />);
  if (read.at === 'failed') return shell(<CouldNotLoad what="your service cards" onRetry={load} />);
  return shell(
    read.data.length === 0 ? (
      <div className="grid gap-3">
        <EmptyLine line="You have no service card on yet — make the quote in Full quotation." />
        <FullQuotation onClose={onClose} />
      </div>
    ) : (
      <MakeQuoteForm
        cards={read.data}
        threadId={threadId}
        eventDate={eventDate}
        onClose={onClose}
        onSent={onSent}
        startPicked={prefill ? prefill.picked.filter((id) => read.data.some((c) => c.id === id)) : seed?.picked}
        startItemised={seed?.itemised}
        startOffer={prefill && prefill.offerCentavos > 0 ? prefill.offerCentavos : null}
        startNote={prefill?.note ?? ''}
        extras={prefill?.lines ?? []}
      />
    ),
  );
}

function FullQuotation({ onClose }: { onClose?: () => void }) {
  const door = plusDoor('vendor', 'build-quote', '');
  if (!door) return null;
  return (
    <ActionButton
      tone="neutral"
      icon={ExternalLink}
      label="Full quotation"
      onClick={() => {
        onClose?.();
        window.setTimeout(() => openPlusDoor(door), 0);
      }}
    />
  );
}

function MakeQuoteForm({
  cards,
  threadId,
  eventDate,
  onClose,
  onSent,
  startPicked,
  startItemised = false,
  startOffer = null,
  startNote = '',
  extras = [],
}: {
  cards: MakeQuoteCardOption[];
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  startPicked?: string[];
  startItemised?: boolean;
  startOffer?: number | null;
  startNote?: string;
  /** 🎂 A cake design's priced picks — listed under the offer and sent as their own lines. */
  extras?: MakeQuoteExtraLine[];
}) {
  const formId = useId();
  const today = manilaTodayIsoFor(Date.now());
  // One card: it is picked. Several: the supplier picks.
  const [picked, setPicked] = useState<string[]>(startPicked ?? (cards.length === 1 ? [cards[0]!.id] : []));
  const chosen = cards.filter((c) => picked.includes(c.id));
  // The offer follows the picked cards until the supplier types their own.
  const [typed, setTyped] = useState<string | null>(startOffer != null ? String(startOffer / 100) : null);
  // 🧾 Itemised: the receipt is the quote. Null = the one-price card, exactly as it was.
  const [draft, setDraft] = useState<ReceiptDraft | null>(() => (startItemised ? receiptFromCards(cards.filter((c) => (startPicked ?? []).includes(c.id))) : null));
  const receipt = useMemo(() => (draft ? receiptMoney(draft) : null), [draft]);
  const offerC = receipt ? receipt.net : typed == null ? makeQuoteOfferStart(chosen) : Math.round(Number(typed.replace(/[^\d.]/g, '')) * 100) || 0;
  const [validUntil, setValidUntil] = useState<string | null>(() => makeQuoteGoodUntil(today, eventDate));
  const [note, setNote] = useState(startNote.slice(0, 500));
  const [sending, setSending] = useState(false);
  const plans = useMemo(() => receiptPlanChoices(null, false), []);
  const [planKey, setPlanKey] = useState(plans[0]!.key);
  const plan = (plans.find((c) => c.key === planKey) ?? plans[0]!).plan;
  // How each card books — read once the receipt opens; a refused read leaves the lines without a tag.
  const [tags, setTags] = useState<Record<string, AvailabilityStyle> | null>(null);
  const itemised = draft != null;
  useEffect(() => {
    if (!itemised) return;
    let live = true;
    void loadCardAvailability(threadId).then((r) => {
      if (live && r.ok) setTags(r.byCard);
    });
    return () => {
      live = false;
    };
  }, [itemised, threadId]);
  const refusal =
    (draft && receipt ? (chosen.length === 0 ? null : (receiptRefusal(draft, receipt) ?? receiptPlanProblem(plan, receipt, []))) : null) ??
    makeQuoteRefusal({ picked: chosen.length, offerCentavos: offerC, validUntil, todayIso: today, eventDate, extrasCentavos: makeQuoteExtrasCentavos(extras) });

  const payload = JSON.stringify({
    lineItems: makeQuoteLines(chosen, offerC, extras),
    validUntil,
    title: chosen.map((c) => c.name).join(' · ').slice(0, 120) || 'Quote',
    note: note.trim() || null,
    serviceCardIds: chosen.map((c) => c.id),
    // Itemised: the receipt's own lines and its schedule replace the one line (same writer, same re-sum on the server).
    ...(receipt ? { lineItems: receipt.lineItems, schedule: receiptSchedule(plan, receipt) } : {}),
  });
  /** A card picked or dropped while itemised adds or removes ITS line — the rest of the receipt is left alone. */
  const toggleCard = (c: MakeQuoteCardOption, on: boolean) => {
    setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]));
    setDraft((d) =>
      d == null
        ? d
        : on
          ? { ...d, lines: d.lines.filter((l) => l.cardId !== c.id) }
          : { ...d, lines: [...d.lines, { key: receiptKey(), label: c.name.trim(), pricePhp: Math.max(0, c.fromCentavos ?? 0) / 100, qty: 1, free: false, cardId: c.id, src: null }] },
    );
  };

  return (
    <form
      id={formId}
      data-make-quote=""
      className="grid gap-3"
      action={async (fd) => {
        if (refusal) return;
        setSending(true);
        onSent?.();
        await sendCustomProposalFromChat(fd);
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="payload" value={payload} />
      <ul role="group" aria-label="Your cards" className="grid gap-1.5" data-make-quote-cards="">
        {cards.map((c) => {
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggleCard(c, on)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-[14px] ${on ? 'border-mulberry bg-mulberry/[0.06] text-ink' : 'border-ink/15 text-ink/80'}`}
              >
                <span aria-hidden className={`grid h-5 w-5 flex-none place-items-center rounded-full border ${on ? 'border-mulberry bg-mulberry text-cream' : 'border-ink/25'}`}>
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.fromCentavos != null ? <span className="font-mono text-[12px] text-ink/55">{formatCentavosPhp(c.fromCentavos)}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {draft && receipt ? (
        <>
          <QuoteReceipt draft={draft} onDraft={setDraft} money={receipt} tags={tags} />
          <ReceiptPlanRow choices={plans} pick={planKey} onPick={setPlanKey} money={receipt} />
          <div className="flex">
            <ActionButton tone="neutral" quiet icon={Undo2} label="Use one price" onClick={() => setDraft(null)} data-make-quote-one-price="" />
          </div>
        </>
      ) : (
        <>
          <TypedRow
            name="Your offer"
            amount
            value={typed ?? (offerC > 0 ? String(offerC / 100) : '')}
            empty="₱"
            onType={(v) => setTyped(v)}
            onKeep={(v) => setTyped(v)}
            data="make-quote-offer"
          />
          {extras.length > 0 ? (
            <ul className="grid gap-1 rounded-xl bg-ink/[0.04] px-3 py-2 text-[13px] text-ink/75" aria-label="In your offer" data-make-quote-extras="">
              {extras.map((x, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1">{x.label}</span>
                  <span className="font-mono text-[12px]">+{formatCentavosPhp(x.centavos)}</span>
                </li>
              ))}
              <li className="text-[12px] text-ink/55">Each one is its own line on the quote; your card’s line is the rest of your offer.</li>
            </ul>
          ) : null}
          {/* Itemise builds the receipt from the cards alone, so with a cake design's lines on the offer it would drop them
              silently (ship review 22 Nov). Those quotes stay as the offer with its own lines. */}
          {chosen.length > 0 && extras.length === 0 ? (
            <div className="flex">
              {/* Same parts, your price: a typed offer under the cards' own prices opens as a Discount on the receipt. */}
              <ActionButton
                tone="neutral"
                icon={ListPlus}
                label="Itemise"
                onClick={() => setDraft(typed == null ? receiptFromCards(chosen) : fitReceiptToTarget(receiptFromCards(chosen), offerC, ''))}
                data-make-quote-itemise=""
              />
            </div>
          ) : null}
        </>
      )}
      {/* 🤝 Your lowest, private (19 Nov 2026): typed once here; an offer under it gets ONE quiet line — never a block. */}
      <UnderLowestLine threadId={threadId} totalCentavos={offerC} />
      <LowestRow threadId={threadId} />
      <DateRow
        name="Good until"
        about={{ words: 'A quote is good for 14 days unless you change it — never past the event day.' }}
        value={validUntil}
        note={validUntil ? goodUntilWords(validUntil, today) : null}
        today={today}
        min={addDaysIso(today, 1)}
        max={eventDate}
        onKeep={(d) => setValidUntil(d)}
        data="make-quote-good-until"
      />
      <TypedRow name="Note" value={note} empty="Optional" placeholder="A short message that appears above the quote." long maxLength={500} onType={setNote} onKeep={setNote} data="make-quote-note" />
      {refusal && (chosen.length > 0 || typed != null) ? <Problem text={refusal} /> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <span className="mr-auto inline-flex items-center gap-1 text-[13px] text-ink/55">
          The rest is in Full quotation
          <Explain title="Full quotation">
            Per-guest and per-hour prices, your offers, gifts and payment methods are set in Full quotation — the full form you already know. Lines, crew meal, transport, a discount and the payment plan are here too: press Itemise.
          </Explain>
        </span>
        <FullQuotation onClose={onClose} />
        <ActionButton tone="brand" main icon={Send} label="Send quote" type="submit" disabled={Boolean(refusal) || sending} />
      </div>
    </form>
  );
}
