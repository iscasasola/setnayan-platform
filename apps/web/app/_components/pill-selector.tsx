'use client';

import dynamic from 'next/dynamic';
import type { ComponentType, ReactNode } from 'react';

/**
 * PILL SELECTOR — the app's segmented selector: a full pill whose one thumb slides to the choice picked.
 *
 * Owner, 2026-10-08 (DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"), on the Maker's Stages | Studio: *"i like this
 * pill type instead of the rounded edges selector"* · *"as we discuss this there will be changes on the universal
 * buttons since we will use pill type selectors"* · *"and make them animate"* · *"adjust all pill selectors to this
 * if possible"*.
 *
 * ── WHEN TO USE IT — AND WHEN NOT ───────────────────────────────────────────
 * `INTERACTION_RULES.md`: *"Sections inside a panel = ONE segmented control … max 3 on a phone, 4 on desktop, one or
 * two words each; never used to pick a value (values are dropdowns)."*
 *   ✔ switching between SECTIONS or VIEWS of one place (Stages | Studio · Background · Elements · Music · a
 *     schedule's views — as links when each view has its own address);
 *   ✘ picking a VALUE from three or more → one dropdown (`PickMenu`);
 *   ✘ an on / off → a switch;
 *   ✘ several that may be on at once (Bold · Italic · Underline) → the same pill LOOK, but `slide={false}`: it is a
 *     row of toggles, and no thumb travels between things that are not either-or.
 *
 * ── THE RULE (`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E) ──────────
 *   · SHAPE: a full pill track with 3 px of padding, 44 px tall on a phone; each choice a pill inside it (38 px),
 *     the finger's target the track's whole height.
 *   · ONE COLOUR (owner 2026-10-08: *"pill selector should have a consistent color"* · *"Terracota is our color? and
 *     greyed out when off?"*): the picked choice is the Setnayan terracotta (the `mulberry` token, #C24E25) with
 *     white words; a choice that is off is grey words on the grey track. Every pill selector — there is no other
 *     tone to choose.
 *   · SLIDE, BOUNCE, PULSE (*"and make them animate"* · *"a bit of bounce and a pulse to imitate it has been
 *     pressed"*): one thumb, moving on transform and resizing to the label it lands on, landing with a small
 *     overshoot (`ease-sn-spring`); on a pick it pulses once (a dip in scale, one soft ring). The words cross-fade
 *     over the same time. ONE speed for the family — `--sn-pill-dur` in `globals.css` (*"in between normal and slow
 *     motion"*), worn as `duration-sn-pill`. Instant, with no pulse, under "reduce motion".
 *   · FIRST PAINT IS ALREADY RIGHT: until the thumb has measured, the picked choice paints the pill itself; the
 *     thumb then takes over in place (`pill-thumb.tsx`). It loads after first paint — a screen that draws a pill
 *     selector carries no measuring code in its first load.
 *
 * ── TWO WAYS IN ─────────────────────────────────────────────────────────────
 *   1. `<PillSelector label value options onPick />` — the whole control from a list. An option with `href` is a
 *      link (`aria-current="page"`; pass `link={Link}` for Next's); an option whose `label` is an icon takes
 *      `ariaLabel` and `icon` on the selector draws fixed 46-px faces.
 *   2. A track you already draw yourself: wear `PILL_TRACK_CLASS` on it, `pillSegClass(on, tone)` on each choice,
 *      and put `<PillThumb />` first inside it (the Maker's `ISegmented` / `ISeg` and `Phases` do exactly this).
 * Nothing here knows any one screen, and no caller chooses a colour.
 */
export const PillThumb = dynamic(() => import('./pill-thumb').then((m) => m.PillThumb), { ssr: false });

/** The track's SHAPE (the caller adds its own ground — `PILL_TRACK_GROUND` is the house one). `group/seg` is what a choice reads the thumb's cue from. */
export const PILL_TRACK_CLASS = 'group/seg relative flex min-w-0 rounded-full p-[3px]';
/** The house ground of a track: a quiet ink wash. */
export const PILL_TRACK_GROUND = 'bg-ink/[0.06]';

/**
 * @deprecated There is ONE tone now (owner 2026-10-08, "pill selector should have a consistent color"). The name is
 * kept so the callers that still pass one compile; whatever is passed, the selector is terracotta when on and grey
 * when off.
 */
export type PillTone = 'plain' | 'wine';

/** The picked choice: the Setnayan terracotta, white words. The ONE fill of every pill selector (and of its thumb). */
export const PILL_ON_CLASS = 'bg-mulberry text-white';
/** A choice that is off: grey words on the grey track. */
export const PILL_OFF_CLASS = 'text-ink/55 hover:text-ink';

/**
 * One choice's look, picked or not. A picked choice paints its own pill until the thumb is laid, then hands the
 * fill over (`group-data-[seg-thumb]/seg:`) — so there is never a frame with no pill, and never two.
 * `_tone` is ignored (see `PillTone`).
 */
export function pillSegClass(on: boolean, _tone?: PillTone): string {
  return `sn-press relative z-[1] inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold transition-colors duration-sn-pill ease-sn after:absolute after:inset-x-0 after:-inset-y-[3px] after:content-[''] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 ${
    on ? `${PILL_ON_CLASS} shadow-sm group-data-[seg-thumb]/seg:bg-transparent group-data-[seg-thumb]/seg:shadow-none` : PILL_OFF_CLASS
  }`;
}

export type PillOption<K extends string> = {
  key: K;
  /** The words — one or two — or an icon (then give `ariaLabel`). */
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
  /** A view with its own address: the choice is a LINK (opens in a new tab, deep-links, comes back on Back). */
  href?: string;
  disabled?: boolean;
};

export function PillSelector<K extends string>({
  label,
  value,
  options,
  onPick,
  grow = true,
  slide = true,
  icon = false,
  link: LinkAs = 'a',
  className = '',
  data,
}: {
  /** The selector's name, for a screen reader ("Look", "Schedule view"). */
  label: string;
  /** The choice picked — or several (a row of toggles: no thumb travels), or none. */
  value: K | readonly K[] | null;
  options: readonly PillOption<K>[];
  /** A button choice was pressed. (A link choice navigates by itself.) */
  onPick?: (key: K) => void;
  /** Fill the row it sits in (default) — false keeps the selector as wide as its choices. */
  grow?: boolean;
  /** The travelling thumb. False for a row that is not an either-or. */
  slide?: boolean;
  /** Icon-only choices: fixed 46-px faces instead of equal shares of the width. */
  icon?: boolean;
  /** The link element for `href` choices — Next's `Link`; a plain `<a>` when left out. */
  link?: ComponentType<{ href: string; className?: string; children?: ReactNode }> | 'a';
  /** More classes for the track (its ground, a ring). Left out, the house ground. */
  className?: string;
  /** `data-pill-selector="<data>"`. */
  data?: string;
}) {
  const picked = (k: K) => (Array.isArray(value) ? (value as readonly K[]).includes(k) : value === k);
  const several = Array.isArray(value);
  return (
    <div role="group" aria-label={label} data-pill-selector={data ?? ''} className={`${PILL_TRACK_CLASS} ${className || PILL_TRACK_GROUND} ${grow ? 'flex-1' : 'inline-flex'}`}>
      {slide && !several ? <PillThumb /> : null}
      {options.map((o) => {
        const on = picked(o.key);
        const cls = `${pillSegClass(on)}${icon ? ' w-[46px] flex-none px-0' : ''}`;
        const marks = { 'data-seg': o.key, ...(o.ariaLabel ? { 'aria-label': o.ariaLabel } : {}), ...(o.title ? { title: o.title } : {}) };
        return o.href && !o.disabled ? (
          <LinkAs key={o.key} href={o.href} className={cls} {...marks} {...(on ? { 'aria-current': 'page' as const } : {})}>
            {o.label}
          </LinkAs>
        ) : (
          <button key={o.key} type="button" aria-pressed={on} disabled={o.disabled} onClick={() => onPick?.(o.key)} className={cls} {...marks}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
