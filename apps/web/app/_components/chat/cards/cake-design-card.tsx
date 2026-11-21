'use client';

/**
 * 🎂 THE CAKE DESIGN CARD — one card in the chat for every design a couple sends (Cake Maker v6 §02/§03; DECISION_LOG
 * 2026-11-21 "THE CAKE MAKER LIVES IN THE CHAT, NOT ON SERVICE CARDS" · "CAKE MAKER v6 = THE BUILD REFERENCE").
 *
 * It reads the stored design through `cakeAction({ op: 'design' })` (RLS: only a member of this chat) — never the
 * browser's copy — and shows the face for whoever is looking:
 *
 *   · the couple → "Your cake design · Sent", the picture, the picks and the estimate · Change my design (opens the
 *                  designer from this design; Send posts a NEW version) · a replaced design says so.
 *   · the shop   → "Cake design · New" · Make a quote opens the shipped quote card PREFILLED: the card's one price,
 *                  then one line per priced pick, the estimate as the total, the making time to confirm · Reply.
 *   · the order  → the shop's face with "Open your quote" · "Open the chat".
 *
 * The picture is ONE 3D still rendered in the browser when the card scrolls into view (2D until then; nothing stored).
 * A failed read says so with Try again — it is never shown as an empty design.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CakeSlice, Clock, FileText, MessageCircle, Pencil, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { cakeAction, type CakeDesignRead } from '@/app/_components/cake-maker/cake-actions';
import { cakeQuoteLines, cakeQuoteNote } from '@/lib/cake-maker';
import { cakeFigureSpec } from '@/lib/cake-config';
import { formatCentavosPhp } from '@/lib/vendor-packages';
import { CakeStill } from '@/app/_components/plan3d/kit/cake-view';
import { MakeQuoteCard } from './make-quote-card';
import css from './cake-design-card.module.css';

const CakeDesigner = lazy(() => import('@/app/_components/cake-maker/cake-designer').then((m) => ({ default: m.CakeDesigner })));

export type CakeDesignLoaded = CakeDesignRead;
type ReadState = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; data: CakeDesignRead };

export function CakeDesignCard({
  threadId,
  messageId,
  place,
  eventDate = null,
  stamp = null,
  links = null,
  onChanged,
  seed,
}: {
  threadId: string;
  messageId: string;
  place: 'chat' | 'order';
  eventDate?: string | null;
  /** "You · sent from the Cake Maker · 10:24" under the card in the chat. */
  stamp?: string | null;
  /** On the order: where the quote and the chat are. */
  links?: { quoteHref: string | null; chatHref: string } | null;
  /** After "Change my design" posts a new version — the chat refreshes. */
  onChanged?: () => void;
  /** Labs only — a design to draw without a read (or 'failed' to draw the refused read). */
  seed?: CakeDesignRead | 'failed';
}) {
  const [read, setRead] = useState<ReadState>(seed === 'failed' ? { at: 'failed' } : seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const [quoting, setQuoting] = useState(false);
  const [changing, setChanging] = useState(false);
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
        <div className={`skeleton ${css.ghost}`} />
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
          <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={load} />
        </div>
      </section>
    );
  }

  const { viewer, design, config, cupcakeCount, monogramText, inspirationUrl, cardId, usualPrepDays, replaced } = read.data;
  const couple = viewer === 'couple';
  const spec = cakeFigureSpec(config, (ref) => design.flavourLabels[ref] ?? null, cupcakeCount);

  if (quoting && place === 'chat' && !couple) {
    const lines = cakeQuoteLines(design);
    const extras = design.cardName && design.oneCentavos != null ? lines.slice(1) : lines;
    return (
      <MakeQuoteCard
        threadId={threadId}
        eventDate={eventDate}
        onClose={() => setQuoting(false)}
        prefill={{
          picked: cardId ? [cardId] : [],
          offerCentavos: design.estimateCentavos ?? 0,
          note: cakeQuoteNote(design).slice(0, 500),
          lines: extras,
        }}
      />
    );
  }

  return (
    <section className={`${css.rcard} ${replaced ? css.old : ''}`} aria-label={couple ? 'Your cake design' : 'Cake design'} data-cake-design={viewer} data-cake-replaced={replaced ? '' : undefined}>
      <div className={css.rh}>
        <CakeSlice aria-hidden width={18} height={18} className={css.ic} />
        <b>{couple ? 'Your cake design' : 'Cake design'}</b>
        {replaced ? <span className={css.chip}>Replaced</span> : couple ? <span className={css.chip}>Sent</span> : place === 'chat' ? <span className={css.chip}>New</span> : null}
      </div>
      {replaced ? <p className={css.lline}>{couple ? 'You sent a newer design below — this one is kept for the record.' : 'They sent a newer design below — quote from that one.'}</p> : null}
      <div className={css.stage}>
        <CakeStill spec={spec} monogramText={monogramText} title={`${design.cardName ?? 'Cake'} — ${design.sizeWords}`} />
      </div>
      <Row name="Tiers" value={design.sizeWords} />
      <ol className={css.tiers} aria-label="Each tier, top to bottom">
        {design.tiers.map((t, i) => (
          <li key={i}>
            <span>{t.name}</span>
            <b>
              {t.words}
              {t.extraCentavos > 0 ? <small> +{formatCentavosPhp(t.extraCentavos)}</small> : null}
            </b>
          </li>
        ))}
      </ol>
      {design.rows.map((r) =>
        r.label === 'Colours' ? (
          <div key={r.label} className={css.rr}>
            <span>Colours</span>
            <b>
              <span className={css.dots} aria-hidden>
                {config.colours.map((c, i) => (
                  <i key={i} style={{ background: c.hex }} />
                ))}
              </span>{' '}
              {r.words}
            </b>
          </div>
        ) : (
          <div key={r.label} className={css.rr}>
            <span>{r.label}</span>
            <b>
              {r.words}
              {r.extraCentavos > 0 ? <small> +{formatCentavosPhp(r.extraCentavos)}</small> : null}
            </b>
          </div>
        ),
      )}
      {design.instructions ? (
        <div className={css.note}>
          <span>Anything else</span>
          <p>{design.instructions}</p>
        </div>
      ) : null}
      {inspirationUrl ? (
        <div className={css.rr}>
          <span>Inspiration</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a small library thumbnail, not a page image */}
          <img src={inspirationUrl} alt={couple ? 'Your pinned inspiration photo' : 'Their pinned inspiration photo'} className={css.insp} loading="lazy" width={72} height={72} />
        </div>
      ) : null}
      <div className={css.rt}>
        <span>{design.estimateCentavos != null ? 'Estimate' : 'Extras picked'}</span>
        <b>{formatCentavosPhp(design.estimateCentavos ?? design.extrasCentavos)}</b>
      </div>
      <p className={css.lline}>
        {design.estimateCentavos != null
          ? couple
            ? 'From the one price and the extras you picked. Their quote decides.'
            : 'From your one price and the extras they picked. Your quote decides.'
          : couple
            ? 'The shop quotes the price.'
            : 'You have no priced cake card, so you quote the price.'}
      </p>
      {usualPrepDays && !couple ? (
        <p className={css.lline}>
          <Clock aria-hidden width={14} height={14} />
          <span>
            Your usual time is {usualPrepDays} {usualPrepDays === 1 ? 'day' : 'days'} — confirm it for this design on the quote.
          </span>
        </p>
      ) : null}
      {place === 'chat' && couple && !replaced ? (
        <div className={css.ra}>
          <ActionButton tone="neutral" icon={Pencil} label="Change my design" onClick={() => setChanging(true)} data-cake-change="" />
        </div>
      ) : place === 'chat' && !couple && !replaced ? (
        <div className={css.ra}>
          <ActionButton tone="brand" main icon={FileText} label="Make a quote" onClick={() => setQuoting(true)} data-cake-quote="" />
          <ReplyButton />
        </div>
      ) : place === 'order' && links ? (
        <div className={css.ra}>
          {links.quoteHref ? <ActionButton tone="neutral" icon={FileText} label="Open your quote" href={links.quoteHref} /> : null}
          <ActionButton tone="neutral" icon={MessageCircle} label="Open the chat" href={links.chatHref} />
        </div>
      ) : null}
      {stamp ? <p className={css.meta}>{stamp}</p> : null}
      {changing ? (
        <Suspense fallback={null}>
          <CakeDesigner
            threadId={threadId}
            start={{ config, cardId }}
            onClose={() => setChanging(false)}
            onSent={() => {
              onChanged?.();
              load();
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function ReplyButton() {
  return (
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
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className={css.rr}>
      <span>{name}</span>
      <b>{value}</b>
    </div>
  );
}
