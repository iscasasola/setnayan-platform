'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';

import {
  eventTypePhotoSrc,
  eventTypePlaceholderGradient,
} from '@/app/dashboard/(account)/create-event/_components/event-types';

export type EventTileOption = { key: string; label: string; emoji: string; heroPhotoUrl?: string | null };

/**
 * 🗣 "event", never "celebration" (the owner's standing word rule; walk 13 Nov 2026, F-W1-06). The admin roster's
 * `celebration` row is labelled "Celebration"; on the supplier door only the WORD changes — the key posted stays
 * `celebration`. Applied once where the wizard receives the roster, so the tiles and the per-event chips agree.
 */
export function supplierEventWords<T extends EventTileOption>(options: readonly T[]): T[] {
  return options.map((e) => (e.key === 'celebration' ? { ...e, label: 'Other events' } : e));
}

/**
 * 🖼 "Events you serve" as small photo tiles (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED":
 * events as small photo tiles). The owner's carve-out from "any set of choices is a dropdown".
 *
 * RULE 0 — the photo and its fallback are the shipped ones: `eventTypePhotoSrc` (the type's own hero photo, else the
 * repo photo) and, when that file does not load, `eventTypePlaceholderGradient` + the type's emoji — exactly what the
 * create-event picker (`event-type-photo-picker.tsx`) draws. Never a stand-in photo of another type.
 *
 * Each tile is a real checkbox (`event_types`), so the form posts what is ticked with no extra state. Ticked = a
 * check badge and the accent ring; three across on a phone.
 */
export function EventTiles({
  options,
  value,
  onToggle,
  describedBy,
}: {
  options: EventTileOption[];
  value: string[];
  onToggle: (key: string) => void;
  describedBy?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5" data-open-shop-event-tiles="">
      {options.map((e) => (
        <EventTile key={e.key} option={e} on={value.includes(e.key)} onToggle={onToggle} describedBy={describedBy} />
      ))}
    </div>
  );
}

function EventTile({
  option: e,
  on,
  onToggle,
  describedBy,
}: {
  option: EventTileOption;
  on: boolean;
  onToggle: (key: string) => void;
  describedBy?: string;
}) {
  const [noPhoto, setNoPhoto] = useState(false);
  return (
    <label
      className="relative isolate block aspect-[5/3] cursor-pointer select-none overflow-hidden rounded-[var(--m-r-sm)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-terracotta"
      style={{
        outline: on ? '2.5px solid var(--m-cta)' : 'none',
        outlineOffset: 1,
        background: 'var(--m-paper-2)',
      }}
      data-event-tile={e.key}
    >
      <input
        type="checkbox"
        name="event_types"
        value={e.key}
        checked={on}
        onChange={() => onToggle(e.key)}
        className="sr-only"
        aria-describedby={describedBy}
      />
      {noPhoto ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[26px] opacity-90"
          style={{ background: eventTypePlaceholderGradient(e.key) }}
        >
          {e.emoji}
        </span>
      ) : (
        <Image
          src={eventTypePhotoSrc({ key: e.key, heroPhotoUrl: e.heroPhotoUrl ?? null })}
          alt=""
          fill
          draggable={false}
          sizes="(max-width: 768px) 33vw, 160px"
          className="object-cover"
          style={{ objectPosition: '50% 20%', filter: on ? undefined : 'saturate(.75)' }}
          onError={() => setNoPhoto(true)}
        />
      )}
      {/* 🌗 A scrim over a PHOTO stays dark in both themes (the create-event picker's rule). */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: on
            ? 'linear-gradient(to top, rgba(23,22,15,.92) 0%, rgba(23,22,15,.55) 60%, rgba(23,22,15,.1) 100%)'
            : 'linear-gradient(to top, rgba(23,22,15,.88) 0%, rgba(23,22,15,.5) 55%, transparent 100%)',
        }}
      />
      <span
        className="absolute inset-x-2 bottom-[7px] text-[12px] font-semibold italic leading-[1.1] text-white"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,.5)' }}
      >
        {e.label}
      </span>
      {on ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: 'var(--m-paper)', color: 'var(--m-sage-deep)' }}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </label>
  );
}
