'use client';

/**
 * 👗 THE GOWN DESIGN CARD — one card in the couple–supplier chat for every design a bride sends from the Attire Maker
 * (plan step B8; corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 2.1: "Gown design card (picture, summary, estimate
 * or 'Ask for a quote')"). Ported from the owner-held #8387 card onto the live `gown_tool` action.
 *
 * It reads the stored design through `gownAction({ op: 'design' })` (RLS: only a member of this chat), never the
 * browser's copy. The rows and the quote pre-fill are built on the server, so the bride's device never holds a cost:
 *
 *   · the bride → "Your gown design · Sent", her choices, the estimate (or "Ask for a quote") · a replaced design says so.
 *   · the shop  → "Gown design · New", the same rows · Make a quote opens the shipped quote card PREFILLED with the
 *                 estimate she saw and her priced add-ons as its lines · Reply.
 *
 * The picture (one `GownStill`, plan A10) joins the card's stage when A10 lands; until then the card shows no picture
 * rather than a placeholder. Wears the Cake design card's look (`cake-design-card.module.css`): one design-card face.
 * A failed read says so with Try again; it is never shown as an empty design.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, MessageCircle, RotateCw, Shirt } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { gownAction } from '@/app/_components/gown-maker/gown-call';
import type { GownDesignRead } from '@/app/_components/gown-maker/gown-actions';
import { GOWN_CARD_WORDS as W } from '@/lib/gown-maker';
import { formatCentavosPhp } from '@/lib/php';
import { MakeQuoteCard } from './make-quote-card';
import css from './cake-design-card.module.css';

type ReadState = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; data: GownDesignRead };

export function GownDesignCard({
  threadId,
  messageId,
  eventDate = null,
  stamp = null,
  seed,
}: {
  threadId: string;
  messageId: string;
  eventDate?: string | null;
  /** "You · sent from the Attire Maker · 10:24" under the card. */
  stamp?: string | null;
  /** Labs only: a design to draw without a read (or 'failed' to draw the refused read). */
  seed?: GownDesignRead | 'failed';
}) {
  const [read, setRead] = useState<ReadState>(seed === 'failed' ? { at: 'failed' } : seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const [quoting, setQuoting] = useState(false);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void gownAction({ op: 'design', threadId, messageId })
      .then((r) => setRead(r.ok && r.op === 'design' ? { at: 'ok', data: r } : { at: 'failed' }))
      .catch(() => setRead({ at: 'failed' }));
  }, [threadId, messageId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at === 'loading') {
    return (
      <section className={css.rcard} aria-busy="true" aria-label={W.shopTitle}>
        <div className={css.rh}>
          <Shirt aria-hidden width={18} height={18} className={css.ic} />
          <b>{W.shopTitle}</b>
        </div>
        <div className={`skeleton ${css.ghost}`} />
      </section>
    );
  }
  if (read.at === 'failed') {
    return (
      <section className={`${css.rcard} ${css.fail}`} aria-label={W.shopTitle} data-gown-design="failed">
        <div className={css.rh}>
          <AlertCircle aria-hidden width={18} height={18} className={css.icFail} />
          <b>{W.unread}</b>
        </div>
        <p className={css.lline}>{W.unreadWhy}</p>
        <div className={css.ra}>
          <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={load} />
        </div>
      </section>
    );
  }

  const { viewer, rows, estimateCentavos, quote, replaced } = read.data;
  const bride = viewer === 'couple';

  if (quoting && !bride && quote) {
    return <MakeQuoteCard threadId={threadId} eventDate={eventDate} onClose={() => setQuoting(false)} prefill={{ picked: [], offerCentavos: quote.offerCentavos, note: quote.note, lines: quote.lines }} />;
  }

  const title = bride ? W.brideTitle : W.shopTitle;
  return (
    <section className={`${css.rcard} ${replaced ? css.old : ''}`} aria-label={title} data-gown-design={viewer} data-gown-replaced={replaced ? '' : undefined}>
      <div className={css.rh}>
        <Shirt aria-hidden width={18} height={18} className={css.ic} />
        <b>{title}</b>
        <span className={css.chip}>{replaced ? W.replaced : bride ? W.sent : W.fresh}</span>
      </div>
      {replaced ? <p className={css.lline}>{bride ? W.brideReplaced : W.shopReplaced}</p> : null}
      {rows.map((r) => (
        <div key={r.label} className={css.rr}>
          <span>{r.label}</span>
          <b>{r.words}</b>
        </div>
      ))}
      <div className={css.rt}>
        <span>{estimateCentavos != null ? W.estimate : W.ask}</span>
        {estimateCentavos != null ? <b>{formatCentavosPhp(estimateCentavos)}</b> : null}
      </div>
      <p className={css.lline}>{estimateCentavos != null ? (bride ? W.brideEstimate : W.shopEstimate) : bride ? W.brideAsk : W.shopAsk}</p>
      {!bride && !replaced && quote ? (
        <div className={css.ra}>
          <ActionButton tone="brand" main icon={FileText} label="Make a quote" onClick={() => setQuoting(true)} data-gown-quote="" />
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
      ) : null}
      {stamp ? <p className={css.meta}>{stamp}</p> : null}
    </section>
  );
}
