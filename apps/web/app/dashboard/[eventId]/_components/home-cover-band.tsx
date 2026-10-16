import { Info } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { HomeCover } from '@/lib/home-cover';

/**
 * home-cover-band.tsx — THE EVENT HOME'S COVER BAND (the name, the date line, Event Details),
 * lifted out of `HomeFirstScreen` unchanged so the Home's LOADING screen can draw the very same
 * band the moment an event is tapped (`home-loading-cover.tsx`, 2026-10-16). No hooks, no data:
 * the words come in (`lib/home-cover-words.ts`), so both callers draw them one way.
 * `ground` null = the plain colour band (the loading screen has not read the hub's background).
 */
export function HomeCoverBand({
  eventId,
  cover,
  ground = null,
}: {
  eventId: string;
  cover: { eyebrow: string; name: string };
  ground?: HomeCover | null;
}) {
  return (
      <div
        data-home-cover={ground?.kind ?? 'colour'}
        /* Full-bleed on a phone, under the top bar (the prototype's `.cover{margin:0 -16px}` —
           the event layout's gutter is px-4 / pt-3); a rounded band from `sm` up. */
        /* 📐 A FULL-WIDTH BAND AT EVERY WIDTH (owner 2026-10-07: "i thought this will be
           changed to full width"): it cancels the event layout's own gutter (px-4 · sm:px-6 ·
           lg:px-8, pt-3 · sm:pt-6) and pads by the same amount, so it runs edge to edge of
           the content area, square-edged, with its words on the page's gutter. The cards
           below keep their column (`data-home-column`). */
        className={`relative -mx-4 -mt-3 flex items-end justify-between gap-3 overflow-hidden px-4 pb-[18px] pt-[22px] sm:-mx-6 sm:-mt-6 sm:px-6 lg:-mx-8 lg:px-8 ${ground ? '' : 'bg-mulberry text-cream'}`}
        style={ground ? { background: ground.kind === 'paper' ? ground.background : undefined, color: ground.ink } : undefined}
      >
        {ground?.kind === 'image' ? (
          <span aria-hidden className="absolute inset-0 block">
            {/* A presigned R2 URL or the theme's public still — a plain <img>: the signing host is not in the next/image allowlist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ground.src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 block" style={{ background: ground.scrim }} />
          </span>
        ) : null}
        <div className="relative min-w-0">
          {/* The page's one h1. Screen-reader only: the name is drawn once, below, for the eye — and
              BEFORE the eyebrow, so `lint-page-masthead` does not read a label-over-h1. */}
          <h1 className="sr-only">{cover.name}</h1>
          <p className={`truncate text-[12px] uppercase tracking-[0.12em] ${ground ? 'opacity-85' : 'text-cream/85'}`}>{cover.eyebrow}</p>
          <p aria-hidden className="text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">{cover.name}</p>
        </div>
        <span className="relative shrink-0" data-home-event-details="">
          <ActionButton href={`/dashboard/${eventId}/details`} tone="neutral" icon={<Info aria-hidden="true" strokeWidth={1.9} />} label="Event Details" className="home-cover-ab" />
        </span>
      </div>
  );
}
