'use client';

/**
 * 🎂 A DESIGN ARRIVES — the supplier's "Cake design" card (Cake Maker drawing §03, DECISION_LOG 2026-11-21).
 *
 * One clean card: in the chat where the couple's design lands, and the same card on the order. It reads the couple's
 * own message through `cakeAction` (RLS: only the shop's own thread, only the couple's words) — never the browser's copy.
 *
 *   · chat  → "Make a quote" opens the shipped Make a quote card, prefilled with the card, the estimate and the picks
 *             (ruling 8) · "Reply" goes to the message box.
 *   · order → "Open your quote" · "Open the chat".
 *
 * A failed read says so with Try again. It is never shown as an empty design.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CakeSlice, Clock, MessageCircle, RotateCw } from 'lucide-react';
import { cakeAction, type CakeActionResult } from '@/app/vendor-dashboard/cake-actions';
import { cakeQuoteNote, tiersWords, type CakeDesignLine } from '@/lib/cake-maker';
import { cakeFigureSpec } from '@/lib/cake-config';
import { formatCentavosPhp } from '@/lib/vendor-packages';
import { CakeView } from '@/app/_components/plan3d/kit/cake-view';
import { MakeQuoteCard } from './make-quote-card';
import css from './cake-design-card.module.css';

export type CakeDesignLoaded = Extract<CakeActionResult, { op: 'design' }>;
type Loaded = CakeDesignLoaded;
type ReadState = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; data: Loaded };

export function CakeDesignCard({
  threadId,
  messageId,
  place,
  eventDate = null,
  stamp = null,
  links = null,
  seed,
}: {
  threadId: string;
  messageId: string;
  place: 'chat' | 'order';
  eventDate?: string | null;
  /** "Sent from “Design your cake” · 10:24" under the card in the chat. */
  stamp?: string | null;
  /** On the order: where the quote and the chat are. */
  links?: { quoteHref: string | null; chatHref: string } | null;
  /** Labs only — a design to draw without a read (or 'failed' to draw the refused read). */
  seed?: Loaded | 'failed';
}) {
  const [read, setRead] = useState<ReadState>(seed === 'failed' ? { at: 'failed' } : seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const [quoting, setQuoting] = useState(false);
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void cakeAction({ op: 'design', threadId, messageId })
      .then((r) => setRead(r.ok && r.op === 'design' ? { at: 'ok', data: r } : { at: 'failed' }))
      .catch(() => setRead({ at: 'failed' }));
  }, [threadId, messageId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at === 'loading') {
    return (
      <section className={css.rcard} aria-busy="true" aria-label="Cake design">
        <div className={css.rh}>
          <CakeSlice aria-hidden width={18} height={18} className={css.ic} />
          <b>Cake design</b>
        </div>
        <div className={css.ghost} />
      </section>
    );
  }
  if (read.at === 'failed') {
    return (
      <section className={`${css.rcard} ${css.fail}`} aria-label="Cake design" data-cake-design="failed">
        <div className={css.rh}>
          <AlertCircle aria-hidden width={18} height={18} className={css.icFail} />
          <b>Couldn’t load this cake design</b>
        </div>
        <p className={css.lline}>The design is saved; only this read failed. It is never shown as empty.</p>
        <div className={css.ra}>
          <button type="button" className={`${css.btn} ${css.ghostBtn}`} onClick={load}>
            <RotateCw aria-hidden width={16} height={16} /> Try again
          </button>
        </div>
      </section>
    );
  }

  const { design, config, flavourLabels, cupcakeCount, monogramText, inspirationUrl, cardId, usualPrepDays } = read.data;
  const spec = cakeFigureSpec(config, (ref) => flavourLabels[ref] ?? null, cupcakeCount);
  if (quoting && place === 'chat') {
    return (
      <MakeQuoteCard
        threadId={threadId}
        eventDate={eventDate}
        onClose={() => setQuoting(false)}
        prefill={{ picked: cardId ? [cardId] : [], offerCentavos: design.estimateCentavos, note: cakeQuoteNote(design) }}
      />
    );
  }
  return (
    <section className={css.rcard} aria-label="Cake design" data-cake-design="">
      <div className={css.rh}>
        <CakeSlice aria-hidden width={18} height={18} className={css.ic} />
        <b>Cake design</b>
        {place === 'chat' ? <span className={css.chip}>New</span> : null}
      </div>
      <div className={css.stage}>
        <CakeView spec={spec} monogramText={monogramText} title={`${design.cardName} — ${tiersWords(design)}`} />
      </div>
      <Row name="Tiers" value={tiersWords(design)} />
      <ol className={css.tiers} aria-label="Each tier, bottom to top">
        {design.tiers.map((t, i) => (
          <li key={i}>
            <span>
              {t.name}
              {t.kind === 'display' ? <small> · display</small> : null}
              {t.cutting ? <small> · cutting tier</small> : null}
            </span>
            <b>{[t.flavour ? withExtra(t.flavour) : null, t.accent ? withExtra(t.accent) : null].filter(Boolean).join(' · ') || '—'}</b>
          </li>
        ))}
      </ol>
      {design.arrangement ? <PickRow name="Arrangement" line={design.arrangement} /> : null}
      {design.finish ? <PickRow name="Finish" line={design.finish} /> : null}
      {design.flowing ? <PickRow name="Flowing accent" line={design.flowing} /> : null}
      {design.colours.length > 0 ? (
        <div className={css.rr}>
          <span>Colours</span>
          <b>
            <span className={css.dots} aria-hidden>
              {design.colours.map((c, i) => (
                <i key={i} style={{ background: c.hex }} />
              ))}
            </span>{' '}
            {design.colours.map((c) => c.name).join(' · ')}
          </b>
        </div>
      ) : null}
      {design.topper ? <PickRow name="Topper" line={design.topper} /> : null}
      {design.monogram ? <PickRow name="Monogram" line={design.monogram} /> : null}
      {design.message ? <Row name="Message" value={`“${design.message}”`} /> : null}
      {design.cupcakes ? <PickRow name="Cupcakes" line={{ label: design.cupcakes.words, extraCentavos: design.cupcakes.extraCentavos }} /> : null}
      {design.instructions ? (
        <div className={css.note}>
          <span>Special instructions</span>
          <p>{design.instructions}</p>
        </div>
      ) : null}
      {inspirationUrl ? (
        <div className={css.rr}>
          <span>Inspiration</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small library thumbnail, not a page image */}
          <img src={inspirationUrl} alt="Their pinned inspiration photo" className={css.insp} loading="lazy" width={72} height={72} />
        </div>
      ) : null}
      <div className={css.rt}>
        <span>Estimate</span>
        <b>{formatCentavosPhp(design.estimateCentavos)}</b>
      </div>
      <p className={css.lline}>From your one price and the extras they picked. Your quote decides.</p>
      {usualPrepDays ? (
        <p className={css.lline}>
          <Clock aria-hidden width={14} height={14} />
          <span>
            Your usual time is {usualPrepDays} {usualPrepDays === 1 ? 'day' : 'days'} — confirm it for this design on the quote.
          </span>
        </p>
      ) : null}
      {place === 'chat' ? (
        <div className={css.ra}>
          <button type="button" className={`${css.btn} ${css.main}`} onClick={() => setQuoting(true)}>
            Make a quote
          </button>
          <button
            type="button"
            className={`${css.btn} ${css.ghostBtn}`}
            onClick={() => {
              const box = document.querySelector<HTMLTextAreaElement>('[data-chat-composer-row] textarea');
              box?.scrollIntoView({ block: 'nearest' });
              box?.focus();
            }}
          >
            <MessageCircle aria-hidden width={16} height={16} /> Reply
          </button>
        </div>
      ) : links ? (
        <div className={css.ra}>
          {links.quoteHref ? (
            <Link href={links.quoteHref} className={`${css.btn} ${css.ghostBtn}`}>
              Open your quote
            </Link>
          ) : null}
          <Link href={links.chatHref} className={`${css.btn} ${css.ghostBtn}`}>
            Open the chat
          </Link>
        </div>
      ) : null}
      {stamp ? <p className={css.meta}>{stamp}</p> : null}
    </section>
  );
}

function Row({ name, value, small }: { name: string; value: string; small?: string }) {
  return (
    <div className={css.rr}>
      <span>{name}</span>
      <b>
        {value}
        {small ? <small> {small}</small> : null}
      </b>
    </div>
  );
}

function PickRow({ name, line }: { name: string; line: CakeDesignLine }) {
  return (
    <div className={css.rr}>
      <span>{name}</span>
      <b>
        {line.label}
        {line.extraCentavos > 0 ? <small> + {formatCentavosPhp(line.extraCentavos)}</small> : null}
      </b>
    </div>
  );
}

const withExtra = (l: CakeDesignLine) => (l.extraCentavos > 0 ? `${l.label} (+${formatCentavosPhp(l.extraCentavos)})` : l.label);
