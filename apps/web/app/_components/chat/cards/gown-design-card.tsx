'use client';

/**
 * 👗 THE GOWN DESIGN CARD — one card in the couple-supplier chat for every design a shop shared from the Gown Maker as
 * a QR (owner, 26 Nov 2026: *"…and this will be seen in their chatpage."*). The message is posted when the couple
 * scans the code (Shortlist or Booked, `lib/gown-maker.server.ts` postGownDesignCard).
 *
 * It reads the stored design through `gownAction({ op: 'design' })` — the chat is checked under the reader's own
 * session, then only the card's fields come back: the tool's thumbnail, its summary lines and the proposal price it
 * showed the client. Never the shop's costs or the tool's own state.
 *
 *   · the couple → "Gown design" · the picture · the lines · the price shown · Reply.
 *   · the shop   → the same face, "What your client sees" · Make a quote (the shipped quote card, prefilled with the
 *                  price shown and the design's lines) · Reply.
 *
 * Wears the Cake design card's look (`cake-design-card.module.css`) — one design-card face, not a second one.
 * A failed read says so with Try again — it is never shown as an empty design.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, MessageCircle, RotateCw, Shirt } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { gownAction } from '@/app/_components/gown-maker/gown-call';
import type { GownCard } from '@/lib/gown-maker.server';
import { gownWhichWords } from '@/lib/gown-maker';
import { formatCentavosPhp } from '@/lib/php';
import { MakeQuoteCard } from './make-quote-card';
import css from './cake-design-card.module.css';

type ReadState = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; card: GownCard };

export function GownDesignCard({
  threadId,
  messageId,
  viewer,
  eventDate = null,
  stamp = null,
  seed,
}: {
  threadId: string;
  messageId: string;
  viewer: 'couple' | 'vendor';
  eventDate?: string | null;
  /** "From the Gown Maker · 10:24" under the card. */
  stamp?: string | null;
  /** Labs only — a design to draw without a read (or 'failed' to draw the refused read). */
  seed?: GownCard | 'failed';
}) {
  const [read, setRead] = useState<ReadState>(seed === 'failed' ? { at: 'failed' } : seed ? { at: 'ok', card: seed } : { at: 'loading' });
  const [quoting, setQuoting] = useState(false);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void gownAction({ op: 'design', threadId, messageId })
      .then((r) => setRead(r.ok ? { at: 'ok', card: r.card } : { at: 'failed' }))
      .catch(() => setRead({ at: 'failed' }));
  }, [threadId, messageId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at === 'loading') {
    return (
      <section className={css.rcard} aria-busy="true" aria-label="Gown design">
        <div className={css.rh}>
          <Shirt aria-hidden width={18} height={18} className={css.ic} />
          <b>Gown design</b>
        </div>
        <div className={`skeleton ${css.ghost}`} />
      </section>
    );
  }
  if (read.at === 'failed') {
    return (
      <section className={`${css.rcard} ${css.fail}`} aria-label="Gown design" data-gown-design="failed">
        <div className={css.rh}>
          <AlertCircle aria-hidden width={18} height={18} className={css.icFail} />
          <b>Couldn’t load this gown design</b>
        </div>
        <p className={css.lline}>The design is saved; only this read failed. It is never shown as empty.</p>
        <div className={css.ra}>
          <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={load} />
        </div>
      </section>
    );
  }

  const { card } = read;
  const shop = viewer === 'vendor';

  if (quoting && shop) {
    return (
      <MakeQuoteCard
        threadId={threadId}
        eventDate={eventDate}
        onClose={() => setQuoting(false)}
        prefill={{ picked: [], offerCentavos: card.priceShownCentavos ?? 0, note: card.summary.join('\n').slice(0, 500) }}
      />
    );
  }

  return (
    <section className={css.rcard} aria-label="Gown design" data-gown-design={viewer}>
      <div className={css.rh}>
        <Shirt aria-hidden width={18} height={18} className={css.ic} />
        <b>Gown design</b>
        <span className={css.chip}>{gownWhichWords(card.which)}</span>
      </div>
      {shop ? <p className={css.lline}>What your client sees.</p> : null}
      <div className={css.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the tool's own small PNG still (a data URL), not a page image */}
        <img src={card.thumbDataUrl} alt={`The gown design: ${card.summary[0] ?? 'from the Gown Maker'}`} loading="lazy" className={css.still} />
      </div>
      <ul aria-label="The design" className="m-0 list-none p-0">
        {card.summary.map((line, i) => (
          <li key={i} className={css.rr}>
            <b>{line}</b>
          </li>
        ))}
      </ul>
      {card.priceShownCentavos != null ? (
        <>
          <div className={css.rt}>
            <span>Price shown</span>
            <b>{formatCentavosPhp(card.priceShownCentavos)}</b>
          </div>
          <p className={css.lline}>{shop ? 'The price your client saw in the Gown Maker. Your quote decides.' : 'The price the shop showed you. Their quote decides.'}</p>
        </>
      ) : (
        <p className={css.lline}>{shop ? 'No price was shown — quote it here.' : 'The shop quotes the price in this chat.'}</p>
      )}
      <div className={css.ra}>
        {shop ? <ActionButton tone="brand" main icon={FileText} label="Make a quote" onClick={() => setQuoting(true)} data-gown-quote="" /> : null}
        <ActionButton
          tone="neutral"
          icon={MessageCircle}
          label="Reply"
          onClick={() => {
            const box = document.querySelector<HTMLTextAreaElement>('[data-chat-composer-row] textarea');
            box?.scrollIntoView({ block: 'nearest' });
            box?.focus();
          }}
        />
      </div>
      {stamp ? <p className={css.meta}>{stamp}</p> : null}
    </section>
  );
}
