import type { HomeCover } from '@/lib/home-cover';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import { forTagWords, type ForTag } from '@/lib/for-tag';
import { ForTagMark } from '@/app/_components/for-tag-mark';
import { HomeCoverPin } from './home-cover-pin';
import { HomeSettingsGear, type HomeSettingsLanded } from './home-settings-gear';
import type { ReactNode } from 'react';

/**
 * home-cover-band.tsx — THE EVENT HOME'S COVER BAND (the name and the date line),
 * lifted out of `HomeFirstScreen` unchanged so the Home's LOADING screen can draw the very same
 * band the moment an event is tapped (`home-loading-cover.tsx`, 2026-10-16). No hooks, no data:
 * the words come in (`lib/home-cover-words.ts`), so both callers draw them one way.
 * `ground` null = the plain colour band (the loading screen has not read the hub's background).
 *
 * ⚙ NO SETTINGS PILL (owner-approved 2026-10-24, `home_control_center_2026-10-24_fable.html`: "Keeps the cover; drops
 * the pill so Event Settings has one door"). The Countdown widget is Event Details' ONE door now — the pill that opened
 * the same page (the 23 Oct ruling) was a second door to it.
 *
 * 📌 IT PINS AS ONE LINE (owner 2026-10-27, Home A — "on home, we also want to pin the header on top"): `sticky` with a
 * negative top (the bar's height − (the band's height − 52 px)), so its in-flow height never changes; stuck, the big
 * words fade and `<names> · <date>` takes their place in the bottom 52 px (`home-cover-pin.tsx`). The loading screen
 * draws this same band, so the hand-over cannot jump. No selector on Home, and no ⚙ on its cover AT REST (24 Oct).
 *
 * ⚙ HOME'S ⚙ — EVENT SETTINGS — AT THE BAND'S RIGHT END, AT REST AND PINNED (owner 2026-10-29, verbatim: *"on event
 * dashboard> home the header does not show the settings icon like the other pages with settings icon. keep it there"*;
 * amends 27 Oct's "drawn only once the band has stuck"). ONE mount (`home-settings-gear.tsx`, `MenuSettingsButton
 * menu="home"`) in the band's bottom 52 px: at rest it ends the name's row, stuck it ends `<names> · <date> · ⚙` — the
 * same spot, so it never moves. It opens the Event Settings sheet (names · date · venues · parents), not a page: the
 * Countdown stays Home's one door to Event Details. The couple gets it (`settingsFor`), and a helper too — whose sheet holds
 * only "Your access", read-only (`settingsHelper`, owner 2026-10-31); the loading screen none.
 */
/** 🔗 What Home's address says about its ⚙ sheet (`?settings=1&row=…`, a Remove's words) and this render's key. */
export type HomeSettingsLink = {
  open: boolean;
  row: string | null;
  landed: HomeSettingsLanded | null;
  renderKey: string;
  /** 🪪 A seat id (`&person=`) — the sheet lands on that person's row in People with access. */
  person?: string | null;
};

export function HomeCoverBand({
  cover,
  ground = null,
  settingsFor,
  settingsRows,
  settingsLink,
  settingsHelper = false,
}: {
  cover: HomeCoverWords;
  ground?: HomeCover | null;
  /** ⚙ The event whose Event Settings the ⚙ opens — the couple's Home only. The loading screen passes none. */
  settingsFor?: string;
  /** The Home lab's rows, already drawn on its fixture; absent = the ⚙ reads them at the press. */
  settingsRows?: ReactNode;
  /** The address's words for the ⚙ sheet — absent = it opens only at the press. */
  settingsLink?: HomeSettingsLink;
  /** 🪪 The ⚙ is a helper's: its sheet holds only "Your access" (owner 2026-10-31). */
  settingsHelper?: boolean;
}) {
  const gear = Boolean(settingsFor);
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
        className={`group/cover sticky top-[calc(var(--home-bar)-var(--home-band-h)+52px)] z-[15] -mx-4 -mt-3 flex items-end justify-between gap-3 overflow-hidden px-4 pb-[18px] pt-[22px] [transition:top_0.3s_ease-out] sm:-mx-6 sm:-mt-6 sm:px-6 lg:-mx-8 lg:px-8 ${ground ? '' : 'bg-mulberry text-cream'}`}
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
        <div className={`relative min-w-0 ${gear ? 'pr-[54px]' : ''} transition-[opacity,transform] duration-200 ease-sn group-data-[collapsed]/cover:-translate-y-2.5 group-data-[collapsed]/cover:opacity-0 motion-reduce:transition-none motion-reduce:group-data-[collapsed]/cover:translate-y-0`}>
          {/* The page's one h1. Screen-reader only: the name is drawn once, below, for the eye — and
              BEFORE the eyebrow, so `lint-page-masthead` does not read a label-over-h1. */}
          <h1 className="sr-only">{cover.name}</h1>
          <p className={`truncate text-[12px] uppercase tracking-[0.12em] ${ground ? 'opacity-85' : 'text-cream/85'}`}>{cover.eyebrow}</p>
          <p aria-hidden className="text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">{cover.name}</p>
          {cover.forWho ? <HomeForLine tag={cover.forWho} /> : null}
        </div>
        <HomeCoverPin name={cover.name} date={cover.shortDate} gear={gear} />
        {settingsFor ? (
          <HomeSettingsGear
            eventId={settingsFor}
            rows={settingsRows}
            openAtFirst={settingsLink?.open ?? false}
            landRow={settingsLink?.row ?? null}
            landPerson={settingsLink?.person ?? null}
            landed={settingsLink?.landed ?? null}
            renderKey={settingsLink?.renderKey}
            helper={settingsHelper}
          />
        ) : null}
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
