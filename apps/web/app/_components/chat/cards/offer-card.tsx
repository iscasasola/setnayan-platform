'use client';

/**
 * 🏷 THE OFFER CARD (Quote + negotiation · Piece 1 · PR-4, owner 2026-11-12; approved design quote-maker-polish.html —
 * the (+) "Offer · They apply it with one tap" sheet and the "Your offer · <name>" card).
 *
 *   OfferDropCard     the supplier's (+) draft: Which offer? · Good until → "Drop into the chat" (their own insert)
 *   DroppedOfferCard  the card in the stream, both sides: open (couple: Not now · Apply to my quote) · applied ·
 *                     expired · ended — every state from `dropState` (lib/offer-drop.ts), never a flag of its own
 *
 * LAZY: reached only through a `next/dynamic` entry in `thread-parts` (the controller registers it in lazy-cards.tsx
 * when PR-3's (+) lands — see the PR body). Prices nothing itself: the preview is `offerVersion` → `offersForQuote`,
 * and the Apply is priced again on the server.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { DateRow } from '@/app/_components/form-row-date';
import { applyDroppedOffer } from '@/app/_actions/offer-card-actions';
import { isRunning } from '@/lib/offers';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { applyRefusal, dayWords, dropState, goodUntilWords, offerTakesWords, offerVersion, priceWordsFor, reachedLines } from '@/lib/offer-drop';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { dropOfferIntoChat, loadDroppedOffer, loadMyOffers, type DroppableOffer, type DroppedOffer } from './offer-calls';
import { CouldNotLoad, EmptyLine, EqualRow, Loading, Problem, type Read } from './card-bits';

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── The supplier's drop ───────────────────────────────────────────────────────

export function OfferDropCard({
  threadId,
  onClose,
  onDropped,
  seed,
  startStep = 0,
}: {
  threadId: string;
  onClose: () => void;
  onDropped?: () => void;
  /** The shop's offers already in hand (the dev lab) — skips the first fetch. */
  seed?: DroppableOffer[];
  startStep?: number;
}) {
  const id = useId();
  const today = manilaTodayIsoFor(Date.now());
  const [read, setRead] = useState<Read<DroppableOffer[]>>(seed ? { at: 'ok', data: seed.filter((o) => isRunning(o.offer, today)) } : { at: 'loading' });
  const [pick, setPick] = useState<string | null>(seed && startStep > 0 ? (seed[0]?.offer.id ?? null) : null);
  const [goodUntil, setGoodUntil] = useState<string | null>(null);
  const [step, setStep] = useState(startStep);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRead({ at: 'loading' });
    const r = await loadMyOffers(threadId);
    setRead(r.ok ? { at: 'ok', data: r.offers.filter((o) => isRunning(o.offer, today)) } : { at: 'failed' });
  }, [threadId, today]);
  useEffect(() => {
    if (!seed) void load();
  }, [load, seed]);

  if (read.at !== 'ok' || read.data.length === 0) {
    return (
      <ChatCardShell topic="quote" kicker="You · not sent yet" title="Drop an offer" onClose={onClose}>
        {read.at === 'loading' ? <Loading /> : read.at === 'failed' ? <CouldNotLoad what="your offers" onRetry={() => void load()} /> : <EmptyLine line="No running offer yet — make one in Shop › Offers first." />}
      </ChatCardShell>
    );
  }
  const chosen = read.data.find((o) => o.offer.id === pick) ?? null;
  // The drop holds a week by default, never past the offer's own last day.
  const maxDay = chosen?.offer.untilDate ?? null;
  const shown = maxDay && maxDay < addDays(today, 7) ? maxDay : addDays(today, 7);
  const steps: ChatCardStep[] = [
    {
      title: 'Which offer?',
      body: (
        <div className="grid gap-2" data-offer-drop-pick="">
          <PickMenu
            label="Which offer?"
            value={pick}
            options={read.data.map((o) => ({ key: o.offer.id, label: `${o.offer.name.trim() || 'Your offer'} · ${priceWordsFor(o.offer)}` }))}
            onPick={(k) => setPick(k)}
            buttonText={pick ? undefined : 'Pick one'}
            dataAttr="data-offer-drop-offer"
          />
          <p className="text-[13px] text-ink/60">They apply it with one tap — it comes off its own card only.</p>
        </div>
      ),
      ok: !!chosen,
    },
    {
      title: 'Good until',
      sub: chosen?.offer.untilDate ? `The offer itself ends ${dayWords(chosen.offer.untilDate)}` : 'The offer itself runs until you switch it off',
      body: (
        <div className="grid gap-2" data-offer-drop-until="">
          <DateRow name="Good until" value={goodUntil} shown={shown} today={today} min={today} max={maxDay} onKeep={(d) => setGoodUntil(d)} />
          <Problem text={problem} />
        </div>
      ),
      ok: !!chosen,
    },
  ];
  return (
    <form
      id={id}
      action={async () => {
        if (!chosen) return;
        setSending(true);
        setProblem(null);
        const r = await dropOfferIntoChat({ threadId, rowId: chosen.rowId, offer: chosen.offer, goodUntil: goodUntil ?? shown });
        setSending(false);
        if (r.ok) {
          onDropped?.();
          onClose();
        } else setProblem(r.message);
      }}
    >
      <ChatStepCard topic="quote" kicker="You · not sent yet" title="Drop an offer" steps={steps} step={step} onStep={setStep} sendLabel="Drop into the chat" sending={sending} onClose={onClose} submitForm={id} />
    </form>
  );
}

// ── The card in the stream ────────────────────────────────────────────────────

export function DroppedOfferCard({
  messageId,
  viewer,
  kicker,
  seed,
}: {
  messageId: string;
  /** Who is looking: the couple gets Apply; the supplier sees where it stands. */
  viewer: 'couple' | 'supplier';
  /** "You · 14:02" / "Rosa · 14:02" — the stream's own sender line. */
  kicker: string;
  /** A read already in hand (the dev lab, a test) — skips the first fetch. */
  seed?: DroppedOffer;
}) {
  const today = manilaTodayIsoFor(Date.now());
  const [read, setRead] = useState<Read<DroppedOffer>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRead({ at: 'loading' });
    const r = await loadDroppedOffer(messageId);
    setRead(r.ok ? { at: 'ok', data: r.drop } : { at: 'failed' });
  }, [messageId]);
  useEffect(() => {
    if (!seed) void load();
  }, [load, seed]);

  if (read.at !== 'ok') {
    return (
      <ChatCardShell topic="quote" kicker={`Offer · ${kicker}`} title="Your offer" tone={viewer === 'supplier' ? 'mine' : 'theirs'}>
        {read.at === 'loading' ? <Loading /> : <CouldNotLoad what="this offer" onRetry={() => void load()} />}
      </ChatCardShell>
    );
  }
  const d = read.data;
  const st = dropState({ markerPresent: d.markerPresent, offer: d.offer, goodUntil: d.goodUntil, today, appliedIn: d.appliedIn });
  const name = d.offer?.name.trim() || 'Your offer';
  const preview =
    st.k === 'open' && d.offer && d.quote
      ? offerVersion({
          offer: d.offer,
          lines: d.quote.lines,
          totalCentavos: d.quote.totalCentavos,
          quoteCardIds: d.quote.cardIds,
          paymentSchedule: d.quote.schedule,
          paidSeqs: new Set(),
          today,
          eventDate: d.eventDate,
          now: new Date(),
        })
      : null;
  const reachedLabels = d.offer && d.quote ? reachedLines(d.quote.lines, d.offer, d.quote.cardIds).map((l) => String(l.label)) : [];

  const apply = async () => {
    const early = applyRefusal({ offer: d.offer, goodUntil: d.goodUntil, today });
    if (early) return setProblem(early);
    setBusy(true);
    setProblem(null);
    const r = await applyDroppedOffer(d.messageId);
    setBusy(false);
    if (r.ok) void load();
    else setProblem(r.message);
  };

  return (
    <ChatCardShell topic="quote" kicker={`Offer · ${kicker}`} title={name} tone={viewer === 'supplier' ? 'mine' : 'theirs'}>
      <div className={`grid gap-2 ${st.k === 'expired' || st.k === 'ended' || st.k === 'gone' ? 'opacity-60' : ''}`} data-offer-card={st.k}>
        {d.offer ? <p className="text-[15px] text-ink">{priceWordsFor(d.offer)}</p> : null}
        {preview?.ok ? (
          <p className="text-[14px] tabular-nums text-ink/75" data-offer-card-takes="">
            {offerTakesWords(preview.version.fit, reachedLabels)}
          </p>
        ) : null}
        {st.k === 'open' && d.goodUntil ? <p className="text-[13px] text-ink/60">{goodUntilWords(d.goodUntil, today)}</p> : null}

        {st.k === 'applied' ? (
          <p role="status" className="text-[14px] font-medium text-success-700">Applied · it is the named line on v{st.version}</p>
        ) : st.k === 'expired' ? (
          <p role="status" className="text-[14px] text-ink/70">Expired {dayWords(st.goodUntil)} · ask again</p>
        ) : st.k === 'ended' ? (
          <p role="status" className="text-[14px] text-ink/70">This offer has ended</p>
        ) : st.k === 'gone' ? (
          <p role="status" className="text-[14px] text-ink/70">This offer was removed</p>
        ) : viewer === 'supplier' ? (
          <p role="status" className="text-[14px] text-ink/70">Dropped · they can apply it{d.goodUntil ? ` until ${dayWords(d.goodUntil)}` : ''}</p>
        ) : later ? (
          <p role="status" className="text-[14px] text-ink/70">Kept in the chat · apply it any time{d.goodUntil ? ` until ${dayWords(d.goodUntil)}` : ''}</p>
        ) : (
          <>
            {preview && !preview.ok ? <Problem text={preview.reason} /> : null}
            <EqualRow data="data-offer-card-actions">
              <ActionButton tone="neutral" icon={X} label="Not now" onClick={() => setLater(true)} />
              <ActionButton tone="ok" main icon={Check} label={busy ? 'Applying…' : 'Apply to my quote'} disabled={busy || (preview != null && !preview.ok)} onClick={() => void apply()} />
            </EqualRow>
          </>
        )}
        <Problem text={problem} />
      </div>
    </ChatCardShell>
  );
}
