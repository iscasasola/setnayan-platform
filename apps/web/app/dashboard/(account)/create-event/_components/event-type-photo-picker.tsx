'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  eventTypePhotoSrc,
  eventTypePlaceholderGradient,
  type EventTypeRow,
} from './event-types';

/**
 * Event-type picker — a responsive GRID of full-bleed "feel photos", one per
 * event type (from /public/event-types/{key}.webp). Owner directive 2026-07-10:
 * "just show a grid of the different events — maximize screen space for both
 * mobile and desktop."
 *
 * Columns scale with width so the whole roster stays visible without endless
 * scrolling as the type count grows: 2-up on phones, 3-up on tablets, 4-up on
 * desktop, 5-up on wide desktop. NO dots, NO arrows: the photos ARE the
 * affordance. The in-chrome add-event sheet uses event-type-carousel.tsx; only
 * this full-page surface is a grid.
 *
 * Types WITHOUT a hero photo (newly enabled / admin-created, no repo asset and
 * no upload) render a branded gradient + emoji placeholder — never a wrong
 * stand-in photo — so the grid never shows the same picture twice.
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
  /** Fired when an enabled tile is tapped. */
  onSelect: (type: EventTypeRow) => void;
  className?: string;
};

export function EventTypePhotoPicker({ types, onSelect, className }: Props) {
  return (
    <div
      role="listbox"
      aria-label="Event type"
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 ${className ?? ''}`}
    >
      {types.map((t, i) => (
        <PhotoTile key={t.key} type={t} index={i} onSelect={onSelect} />
      ))}
    </div>
  );
}

function PhotoTile({
  type: t,
  index,
  onSelect,
}: {
  type: EventTypeRow;
  index: number;
  onSelect: (type: EventTypeRow) => void;
}) {
  const enabled = t.enabled;
  // Start optimistic (try the photo); flip to the branded placeholder the first
  // time the image 404s — covers both a missing repo asset AND a broken
  // admin-uploaded heroPhotoUrl, without a wrong stand-in photo.
  const [noPhoto, setNoPhoto] = useState(false);
  const tagline = t.description ?? TAGLINES[t.key] ?? '';

  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      aria-label={t.label}
      disabled={!enabled}
      onClick={() => enabled && onSelect(t)}
      className={`group relative aspect-[4/5] overflow-hidden rounded-2xl text-left shadow-[0_10px_30px_rgba(30,34,41,0.16)] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
        enabled
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(30,34,41,0.26)]'
          : 'cursor-not-allowed opacity-60'
      }`}
    >
      {noPhoto ? (
        // Branded placeholder — deterministic warm gradient + oversized emoji.
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: eventTypePlaceholderGradient(t.key) }}
        >
          <span
            className={`absolute inset-0 flex items-center justify-center text-6xl opacity-90 drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] transition-transform duration-500 sm:text-7xl ${
              enabled ? 'group-hover:scale-105' : 'grayscale'
            }`}
          >
            {t.emoji}
          </span>
        </div>
      ) : (
        <Image
          src={eventTypePhotoSrc(t)}
          alt=""
          fill
          draggable={false}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          priority={index < 4}
          className={`object-cover transition-transform duration-500 ${
            enabled ? 'group-hover:scale-105' : ''
          }`}
          onError={() => setNoPhoto(true)}
        />
      )}
      {/* legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-serif text-2xl font-semibold italic leading-none text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:text-3xl">
          {t.label}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)] sm:text-sm">
          {tagline}
        </p>
        {enabled ? (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/15 px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
            Begin &rarr;
          </span>
        ) : (
          <span className="mt-3 inline-flex items-center rounded-full border border-white/40 bg-white/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
            Coming soon
          </span>
        )}
      </div>
    </button>
  );
}
