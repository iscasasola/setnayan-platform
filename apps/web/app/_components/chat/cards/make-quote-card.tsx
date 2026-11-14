'use client';

/**
 * 🧾 MAKE A QUOTE — the chat's ＋ before any quote is out (owner-approved supplier cut 7, 2026-11-14; prototype
 * `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 7). The walk: a quote could not be made in the chat —
 * it lived in the client's Quotation tab (~8 taps), and Send stayed dim until a hidden "How long is it valid?" was set.
 *
 * Now ＋ → Make a quote drops this short card: pick your cards, Your offer (starts at their own "from" prices), Good until
 * (FILLED — 14 days, or the event day if sooner — shown and changeable), a note. Send quote posts the SHIPPED writer
 * (`sendCustomProposalFromChat`), so it lands as the quote card the chat already shows (View quote · Waiting for them).
 * Full quotation opens today's builder (`#build-quote`) — discounts, payment schedule, travel and crew meal stay there.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, ExternalLink, Send } from 'lucide-react';
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
  makeQuoteOfferStart,
  makeQuoteRefusal,
  type MakeQuoteCardOption,
} from '@/lib/make-a-quote';
import { ChatCardShell } from '../chat-step-card';
import { loadCardsForMakeQuote } from './card-calls';
import { CouldNotLoad, EmptyLine, Loading, Problem, type Read } from './card-bits';

export const MAKE_A_QUOTE_TITLE = 'Make a quote';

export function MakeQuoteCard({
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
  /** Labs only — the shop's cards to draw without a read. */
  seed?: { cards: MakeQuoteCardOption[]; picked?: string[] };
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
    <ChatCardShell topic="quote" kicker="You · not sent yet" title={MAKE_A_QUOTE_TITLE} onClose={onClose}>
      {body}
    </ChatCardShell>
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
      <MakeQuoteForm cards={read.data} threadId={threadId} eventDate={eventDate} onClose={onClose} onSent={onSent} startPicked={seed?.picked} />
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
}: {
  cards: MakeQuoteCardOption[];
  threadId: string;
  eventDate: string | null;
  onClose?: () => void;
  onSent?: () => void;
  startPicked?: string[];
}) {
  const formId = useId();
  const today = manilaTodayIsoFor(Date.now());
  // One card: it is picked. Several: the supplier picks.
  const [picked, setPicked] = useState<string[]>(startPicked ?? (cards.length === 1 ? [cards[0]!.id] : []));
  const chosen = cards.filter((c) => picked.includes(c.id));
  // The offer follows the picked cards until the supplier types their own.
  const [typed, setTyped] = useState<string | null>(null);
  const offerC = typed == null ? makeQuoteOfferStart(chosen) : Math.round(Number(typed.replace(/[^\d.]/g, '')) * 100) || 0;
  const [validUntil, setValidUntil] = useState<string | null>(() => makeQuoteGoodUntil(today, eventDate));
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const refusal = makeQuoteRefusal({ picked: chosen.length, offerCentavos: offerC, validUntil, todayIso: today, eventDate });

  const payload = JSON.stringify({
    lineItems: makeQuoteLines(chosen, offerC),
    validUntil,
    title: chosen.map((c) => c.name).join(' · ').slice(0, 120) || 'Quote',
    note: note.trim() || null,
    serviceCardIds: chosen.map((c) => c.id),
  });

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
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
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
      <TypedRow
        name="Your offer"
        amount
        value={typed ?? (offerC > 0 ? String(offerC / 100) : '')}
        empty="₱"
        onType={(v) => setTyped(v)}
        onKeep={(v) => setTyped(v)}
        data="make-quote-offer"
      />
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
            Discounts, a payment schedule, travel and crew meals are set in Full quotation — the full form you already know.
          </Explain>
        </span>
        <FullQuotation onClose={onClose} />
        <ActionButton tone="brand" main icon={Send} label="Send quote" type="submit" disabled={Boolean(refusal) || sending} />
      </div>
    </form>
  );
}
