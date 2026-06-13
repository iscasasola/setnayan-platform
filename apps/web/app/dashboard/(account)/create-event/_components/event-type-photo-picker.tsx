'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  eventTypePhotoSrc,
  EVENT_TYPE_PHOTO_FALLBACK,
  type EventTypeRow,
} from './event-types';

/**
 * Event-type "feel photo" picker — owner directive 2026-06-04: "we do not want
 * the lines. we want photos without the carousel indicators. just photos of how
 * the event would feel like" + "the [photo] needs to be clickable on the center
 * when the photo is fully visible. it needs to snap also."
 *
 * A horizontal, scroll-snapping deck of full-bleed event-feel photos (one per
 * event type, from /public/event-types/{key}.webp). NO dots, NO arrows, NO bars
 * — neighbours peek dimmed + scaled-down so the centred photo is the implicit
 * focus. The deck snaps card-to-card (snap-mandatory + snap-stop). Tapping the
 * CENTRED (fully-visible) photo begins it; tapping a side photo snaps it to
 * centre instead. Replaces the bar picker (and the earlier hero carousel) on
 * the full-page create-event surface; the in-chrome add-event sheet still uses
 * event-type-carousel.tsx.
 */

// Fallback taglines for the original 9 types — the DB roster carries its own
// per-type `description` (admin-set at /admin/event-types) which wins when
// present; these keep the constant-fallback path byte-identical.
const TAGLINES: Record<string, string> = {
  wedding: 'The day you say “I do.”',
  debut: 'Her grand eighteenth.',
  gender_reveal: 'Pink or blue?',
  birthday: 'Another year, celebrated.',
  celebration: 'Moments worth gathering for.',
  travel: 'The trip you’ll always remember.',
  corporate: 'Where your brand shines.',
  tournament: 'Game day, elevated.',
  christening: 'A blessing to remember.',
};

type Props = {
  types: readonly EventTypeRow[];
  /** Fired only when the CENTERED + enabled photo is tapped. */
  onSelect: (type: EventTypeRow) => void;
  /** Index centered on mount (default 0 — Wedding). */
  initialIndex?: number;
  className?: string;
};

// Card width drives both the card sizing and the deck's centering padding so
// the first/last photo can sit dead-center with its neighbours peeking.
const DECK_STYLE = {
  paddingInline: 'max(0px, calc((100% - var(--cw)) / 2))',
  '--cw': 'clamp(244px, 74vw, 320px)',
} as CSSProperties;

export function EventTypePhotoPicker({ types, onSelect, initialIndex = 0, className }: Props) {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(initialIndex);

  // The most-centered card is "active" — the only one that begins on tap.
  const computeActive = useCallback(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const center = deck.scrollLeft + deck.clientWidth / 2;
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

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      computeActive();
    });
  }, [computeActive]);

  const centerTo = useCallback((i: number, smooth = true) => {
    const deck = deckRef.current;
    const el = cardRefs.current[i];
    if (!deck || !el) return;
    deck.scrollTo({
      left: el.offsetLeft - (deck.clientWidth - el.offsetWidth) / 2,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Center the initial card (Wedding) on mount — instant, no animation.
  useEffect(() => {
    centerTo(initialIndex, false);
    computeActive();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [initialIndex, centerTo, computeActive]);

  const onTap = useCallback(
    (i: number) => {
      if (i === active) {
        const t = types[i];
        if (t?.enabled) onSelect(t);
      } else {
        centerTo(i);
      }
    },
    [active, types, onSelect, centerTo],
  );

  return (
    <div className={className}>
      <div
        ref={deckRef}
        onScroll={onScroll}
        role="listbox"
        aria-label="Event type"
        style={DECK_STYLE}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {types.map((t, i) => {
          const isActive = i === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={t.label}
              onClick={() => onTap(i)}
              style={{ width: 'var(--cw)' }}
              className={`group relative aspect-[4/5] shrink-0 snap-center snap-always overflow-hidden rounded-[22px] text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                isActive
                  ? 'scale-100 opacity-100 shadow-[0_18px_48px_rgba(30,34,41,0.26)]'
                  : 'scale-[0.9] opacity-50 shadow-[0_10px_30px_rgba(30,34,41,0.16)]'
              }`}
            >
              <Image
                src={eventTypePhotoSrc(t)}
                alt=""
                fill
                draggable={false}
                sizes="(max-width: 640px) 74vw, 320px"
                priority={i < 2}
                className="object-cover"
                onError={(e) => {
                  // Brand-new admin-created types have no repo asset yet —
                  // swap in the generic fallback instead of a broken image.
                  const img = e.currentTarget;
                  if (!img.src.endsWith(EVENT_TYPE_PHOTO_FALLBACK)) {
                    img.src = EVENT_TYPE_PHOTO_FALLBACK;
                  }
                }}
              />
              {/* legibility scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-serif text-3xl font-semibold italic leading-none text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)]">
                  {t.label}
                </p>
                <p className="mt-1.5 text-sm text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
                  {t.description ?? TAGLINES[t.key] ?? ''}
                </p>
                {/* "Begin →" appears only on the centered photo — the tap target */}
                <span
                  className={`mt-4 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/15 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-opacity duration-300 ${
                    isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  Begin &rarr;
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-ink/40">
        Swipe to explore · tap the centered photo to begin
      </p>
    </div>
  );
}
