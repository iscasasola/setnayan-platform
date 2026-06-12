'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  eventTypePhotoSrc,
  EVENT_TYPE_PHOTO_FALLBACK,
  type EventTypeKey,
  type EventTypeRow,
} from './event-types';

/**
 * Event-type hero carousel — owner ask 2026-06-03: "we want a carousel but
 * like hero photos. let them scroll all the possible events."
 *
 * Replaces the old emoji-tile picker (single centered tile + prev/next arrows)
 * with a horizontally **swipeable scroll-snap filmstrip** of full-bleed hero
 * photos — one card per roster entry (`types` prop —
 * DB-driven since the 2026-06-13 event_type_vocab cutover). Hero photos live at
 * `/public/event-types/{key}.webp` (Recraft-generated, 4:5, warm editorial
 * grade). Coming-soon types render grayscale with a "Coming soon" badge; live
 * types get a gold "Available" badge + an optional CTA pill.
 *
 * Shared by BOTH picker surfaces so they stay identical:
 *   - the full-page `/dashboard/create-event` picker (event-type-picker.tsx)
 *   - the in-chrome add-event bottom sheet inside EventSwitcher
 *
 * Behaviour differs only in the tap handler, which the consumer owns:
 *   - full page → `onSelect` sets the selected key, revealing the name form /
 *     Continue link below (so `selectedKey` is passed in for the gold ring).
 *   - switcher  → `onSelect` closes the sheet and routes (Wedding →
 *     /onboarding/wedding, Debut → /dashboard/create-event).
 *
 * Native horizontal scroll IS the "scroll all the possible events" interaction;
 * the arrows + dots are desktop / keyboard / a11y affordances layered on top.
 */

type Props = {
  /** The roster — DB-driven rows from getEventTypeVocab()/getCreatableEventTypes(),
      threaded down from the nearest server component (2026-06-13 cutover). */
  types: readonly EventTypeRow[];
  /** Tap handler. Only fired for `enabled` types (coming-soon tiles are inert). */
  onSelect: (type: EventTypeRow) => void;
  /** When set, the matching card shows the gold selected ring + "Selected" badge. */
  selectedKey?: EventTypeKey | null;
  /** Optional CTA pill rendered on enabled cards (switcher passes "Continue →"). */
  ctaLabel?: string;
  /** next/image `sizes` for the hero photo — tune per surface width. */
  sizes?: string;
  className?: string;
};

export function EventTypeCarousel({
  types,
  onSelect,
  selectedKey,
  ctaLabel,
  sizes = '(max-width: 640px) 80vw, 256px',
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  // The most-centered card = active (drives the dots + which arrow is disabled).
  // offsetLeft is read against the `relative` scroller so it shares a coordinate
  // space with scrollLeft.
  const computeActive = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const center = sc.scrollLeft + sc.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(c - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  }, []);

  // rAF-throttle the scroll handler so we don't recompute on every scroll tick.
  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      computeActive();
    });
  }, [computeActive]);

  useEffect(() => {
    computeActive();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [computeActive]);

  // Smooth-scroll card `i` to the centre of the viewport (clamped at the edges).
  const scrollToIndex = useCallback((i: number) => {
    const sc = scrollerRef.current;
    const el = cardRefs.current[i];
    if (!sc || !el) return;
    const target = el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2;
    sc.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, []);

  return (
    <div className={className}>
      {/* The filmstrip. Edge-to-edge swipe; scrollbar hidden (no util in
          globals.css, so inline the cross-browser hide). */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {types.map((type, i) => {
          const isActive = i === active;
          const isSelected = selectedKey === type.key;
          return (
            <HeroCard
              key={type.key}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              type={type}
              isActive={isActive}
              isSelected={isSelected}
              ctaLabel={ctaLabel}
              sizes={sizes}
              onSelect={onSelect}
            />
          );
        })}
      </div>

      {/* Controls: ‹ prev · dots · next › — centered below the filmstrip. */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          disabled={active === 0}
          aria-label="Previous event type"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-colors hover:border-terracotta/40 hover:bg-terracotta/10 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:bg-cream disabled:hover:text-ink/70"
        >
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>

        <div role="tablist" aria-label="Event type pages" className="flex items-center gap-2">
          {types.map((t, i) => {
            const isActive = i === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show ${t.label}`}
                onClick={() => scrollToIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  isActive ? 'w-6 bg-terracotta' : 'w-2 bg-ink/20 hover:bg-ink/40'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollToIndex(Math.min(types.length - 1, active + 1))}
          disabled={active === types.length - 1}
          aria-label="Next event type"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-colors hover:border-terracotta/40 hover:bg-terracotta/10 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:bg-cream disabled:hover:text-ink/70"
        >
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

const HeroCard = ({
  ref,
  type,
  isActive,
  isSelected,
  ctaLabel,
  sizes,
  onSelect,
}: {
  ref: (el: HTMLButtonElement | null) => void;
  type: EventTypeRow;
  isActive: boolean;
  isSelected: boolean;
  ctaLabel?: string;
  sizes: string;
  onSelect: (type: EventTypeRow) => void;
}) => {
  const enabled = type.enabled;

  // Inactive neighbours dim + shrink slightly on ≥sm (where more than one card
  // is visible) to focus the centred card — mirrors the old picker's
  // `sm:scale-[0.92] sm:opacity-70` neighbour treatment.
  const emphasis = isActive ? 'sm:scale-100 sm:opacity-100' : 'sm:scale-[0.95] sm:opacity-80';

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => enabled && onSelect(type)}
      disabled={!enabled}
      aria-pressed={isSelected}
      aria-disabled={!enabled}
      className={`group relative aspect-[4/5] w-[80%] shrink-0 snap-center overflow-hidden rounded-2xl text-left shadow-sm ring-1 ring-ink/10 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta sm:w-64 ${emphasis} ${
        enabled ? 'cursor-pointer' : 'cursor-not-allowed'
      }`}
    >
      <Image
        src={eventTypePhotoSrc(type)}
        alt=""
        fill
        sizes={sizes}
        className={`object-cover transition-transform duration-500 ${
          enabled ? 'group-hover:scale-105' : 'grayscale'
        }`}
        onError={(e) => {
          // Admin-created types may have no hero asset yet — generic fallback.
          const img = e.currentTarget;
          if (!img.src.endsWith(EVENT_TYPE_PHOTO_FALLBACK)) {
            img.src = EVENT_TYPE_PHOTO_FALLBACK;
          }
        }}
      />

      {/* Legibility scrim — dark at the bottom, clear at the top. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />

      {/* Selected ring (full-page picker only). */}
      {isSelected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-[3px] ring-inset ring-terracotta"
        />
      ) : null}

      {/* Status badge, top-right. */}
      <span
        className={`absolute right-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] backdrop-blur-sm ${
          isSelected
            ? 'bg-terracotta text-cream'
            : enabled
              ? 'bg-terracotta/90 text-cream'
              : 'bg-ink/55 text-cream/90'
        }`}
      >
        {isSelected ? 'Selected' : enabled ? 'Available' : 'Coming soon'}
      </span>

      {/* Label + optional CTA, bottom. White text reads on the scrim. */}
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
        <span className="flex min-w-0 flex-col">
          <span aria-hidden className="text-2xl leading-none drop-shadow">
            {type.emoji}
          </span>
          <span className="mt-1.5 truncate text-lg font-semibold text-white drop-shadow-sm">
            {type.label}
          </span>
        </span>
        {enabled && ctaLabel ? (
          <span className="shrink-0 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-colors group-hover:bg-mulberry-600">
            {ctaLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
};
