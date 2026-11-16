'use client';

import { useEffect, useRef } from 'react';
import { Check, MessageCircle, Plus } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button-class';
import { quoteSummary, type QuoteCard } from '@/lib/shop-quote';

/**
 * 🧾 THE QUOTE ON THE SHOP PAGE (v16 S3) — the card's two buttons and the tray. State lives in `ServicesGallery` (one
 * list, in the order picked); both Inquire doors are the page's own `#get-in-touch` links, which the ONE Inquire
 * pop-up catches (inquire-sheet.tsx) and opens with the named services picked — no second inquiry path, no new server
 * action. Words and order are v16's (`.sc .ft`, `.dock .q`).
 */
export function CardQuoteActions({ card, inQuote, onToggle }: { card: { id: string; label: string }; inQuote: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2" data-card-quote="">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={inQuote}
        aria-label={inQuote ? `${card.label} is in your quote — take it out` : `Add ${card.label} to your quote`}
        className={actionButtonClass('neutral', { extra: 'w-full justify-center !min-h-11' })}
      >
        {inQuote ? <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> : <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />}
        {inQuote ? 'In your quote' : 'Add to quote'}
      </button>
      <a
        href="#get-in-touch"
        // The shop's Inquire pop-up catches this press and opens with THIS card picked.
        data-inquire-service={card.id}
        aria-label={`Inquire about ${card.label}`}
        className={actionButtonClass('neutral', { quiet: true, extra: 'w-full justify-center !min-h-11' })}
      >
        <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Inquire
      </a>
    </div>
  );
}

/** The tray: what is in the quote, Clear, and Inquire for exactly those services. Drawn only while something is in it. */
export function QuoteTray({ picked, cards, onClear }: { picked: readonly string[]; cards: readonly QuoteCard[]; onClear: () => void }) {
  const sum = quoteSummary(picked, cards);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const shown = sum !== null;
  // The tray sits over the page's foot while it is up, so the page makes room for it (and gives it back after).
  useEffect(() => {
    const el = trayRef.current;
    if (!shown || !el) return;
    const body = document.body;
    const before = body.style.paddingBottom;
    body.style.paddingBottom = `${Math.ceil(el.getBoundingClientRect().height)}px`;
    return () => {
      body.style.paddingBottom = before;
    };
  }, [shown]);
  if (!sum) return null;
  return (
    <div
      ref={trayRef}
      role="region"
      aria-label="Your quote"
      data-quote-tray=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-page/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
    >
      <div className="mx-auto grid w-full max-w-3xl gap-2">
        <div className="flex items-center justify-between gap-3 text-sm" aria-live="polite">
          <p className="min-w-0">
            <b className="font-semibold text-ink" data-quote-head="">{sum.head}</b>{' '}
            <span className="text-ink/65" data-quote-names="">{sum.names}</span>
          </p>
          <button type="button" onClick={onClear} className="min-h-11 shrink-0 font-semibold text-sn-accent">
            Clear
          </button>
        </div>
        <a
          href="#get-in-touch"
          // Every picked service, in the order picked: the pop-up opens with all of them chosen.
          data-inquire-service={picked.join(',')}
          className={actionButtonClass('brand', { main: true, extra: 'w-full' })}
        >
          <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Inquire
        </a>
      </div>
    </div>
  );
}
