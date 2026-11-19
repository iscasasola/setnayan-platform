'use client';

import { NotYetVerifiedTag } from './not-yet-verified-tag';
import { NOT_YET_VERIFIED_SIDE_LIST } from '@/lib/not-yet-verified-markings';
import { useEffect, useRef } from 'react';
import { Check, MessageCircle, Plus } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button-class';
import { quoteSummary, type QuoteCard } from '@/lib/shop-quote';

/**
 * 🧾 THE QUOTE ON THE SHOP PAGE (v16 S3) — the card's two buttons and the tray. State lives in `ServicesGallery` (one
 * list, in the order picked) and is mirrored where the ONE Inquire reads it (`shop-quote-store.ts`).
 *
 * 🔑 ONE INQUIRE (owner 13 Nov, "Yes, only one" — `one-inquire-button.test.ts`). v16 draws "Inquire" on each card and in
 * the dock; on the shipped page the dock's Inquire IS the page's one Inquire, which already floats on a phone, and a
 * card's door already reads "Choose this service" (the grown card's words). So this realigns, never adds a second:
 *   · the card's door says "Choose this service" — a `#get-in-touch` link the pop-up catches, this card picked;
 *   · the tray is v16's `.dock .q` — "N services · from ₱X", the names and Clear — and the page's one Inquire, floating
 *     beside it, opens with every service in the quote picked.
 * No second inquiry path and no new server action.
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
        aria-label={`Choose ${card.label}`}
        className={actionButtonClass('neutral', { quiet: true, extra: 'w-full justify-center !min-h-11' })}
      >
        <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Choose this service
      </a>
    </div>
  );
}

/** The tray (v16 `.dock .q`): what is in the quote, and Clear. Drawn only while something is in it. */
export function QuoteTray({
  picked,
  cards,
  onClear,
  phoneOnly = false,
  notVerified = false,
}: {
  picked: readonly string[];
  cards: readonly QuoteCard[];
  onClear: () => void;
  /** v16 S4: true on the verified page, where a computer shows the quote in the side card instead. */
  phoneOnly?: boolean;
  /** ⚠ v16 S6 `.nvd`: the dock's line on a shop Setnayan has not checked yet. */
  notVerified?: boolean;
}) {
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
      // z-20: under the page's one Inquire, which floats over the tray's right end on a phone (`max-md:z-30`); the
      // tray leaves that end clear for it (10rem + the right inset). Both sides clear the device insets (`--sn-safe-l/r`).
      className={`${phoneOnly ? 'md:hidden ' : ''}fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-page/95 pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur max-md:min-h-[4.75rem] max-md:pr-[calc(10rem+var(--sn-safe-r))]`}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 text-sm" aria-live="polite">
        <p className="min-w-0">
          <b className="font-semibold text-ink" data-quote-head="">{sum.head}</b>{' '}
          <span className="text-ink/65" data-quote-names="">{sum.names}</span>
        </p>
        <button type="button" onClick={onClear} className="min-h-11 shrink-0 font-semibold text-sn-accent">
          Clear
        </button>
      </div>
      {notVerified ? (
        <div className="mx-auto w-full max-w-3xl" data-quote-tray-not-verified="">
          <NotYetVerifiedTag>{NOT_YET_VERIFIED_SIDE_LIST[0]}</NotYetVerifiedTag>
        </div>
      ) : null}
    </div>
  );
}
