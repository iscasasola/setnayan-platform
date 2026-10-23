import { Settings } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { HomeCover } from '@/lib/home-cover';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import { forTagWords, type ForTag } from '@/lib/for-tag';
import { ForTagMark } from '@/app/_components/for-tag-mark';

/**
 * home-cover-band.tsx — THE EVENT HOME'S COVER BAND (the name, the date line, ⚙ Settings — the Event Details door),
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
  cover: HomeCoverWords;
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
          {cover.forWho ? <HomeForLine tag={cover.forWho} /> : null}
        </div>
        {/* ⚙ SETTINGS — the header image's one button, the Event Details door (owner 2026-10-23: *"Home has NO
            segmented tabs — the header image carries one 'Settings' button"*, prototypes/event_bar_memories_tab_2026-10-23.html
            frame 2; "Settings", one word, as on Guests). The same address #6838 left as the ONE door to Event Details. */}
        <span className="relative shrink-0" data-home-event-details="">
          <ActionButton href={`/dashboard/${eventId}/details`} tone="neutral" icon={<Settings aria-hidden="true" strokeWidth={1.9} />} label="Settings" className="home-cover-ab" />
        </span>
      </div>
  );
}

/**
 * "FOR <NAME>" (owner 22 Oct 2026, prototypes/for_tag_on_event_cards_2026-10-22.html): one quiet
 * line under the name, only when the event is for a subject the viewer holds — the shop's round
 * logo or the loved one's initials. The eyebrow is untouched.
 */
function HomeForLine({ tag }: { tag: ForTag }) {
  return (
    <p data-home-for="" className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold opacity-[0.92]">
      <ForTagMark tag={tag} place="band" />
      <span className="truncate">{forTagWords(tag.name)}</span>
    </p>
  );
}
