'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * THE PILL SELECTOR'S TRAVELLING THUMB — the one moving part of `pill-selector.tsx` (read its docblock for when a
 * pill selector is the right control at all).
 *
 * Owner, 2026-10-08 (DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"): *"i like this pill type instead of the rounded
 * edges selector"* · *"and make them animate"* · *"adjust all pill selectors to this if possible"*. Rule
 * (`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E): ONE thumb travels from the old choice to the new and
 * resizes to the label it lands on, 220 ms on the house ease; instant under "reduce motion".
 *
 * ── ANY TRACK CAN WEAR IT ───────────────────────────────────────────────────
 * Put `<PillThumb />` FIRST inside a `position: relative` track (`PILL_TRACK_CLASS`) whose choices are its direct
 * children — buttons or links. Nothing is passed in: the picked choice is whichever child says so the way it
 * already does (`aria-pressed="true"`, `aria-current="page"` or `aria-selected="true"`). A choice may add:
 *   · `data-seg-tone="plain|wine"` — which of the two house fills the thumb wears (default plain = white);
 *   · `data-seg-fill="<css colour>"` — its own fill instead (a screen's own token, e.g. `var(--sp-ink)`);
 *   · a child marked `data-seg-face` — the thumb lies on THAT box (an icon's 38-px face inside a 44-px button);
 *     the choice itself is then `position: relative`, as every choice wearing `pillSegClass` already is;
 *   · `data-seg-inset="<px>"` — the thumb lies that far INSIDE the choice's box (a 44-px button whose pill is
 *     clipped 3 px inside a transparent border).
 * The thumb then:
 *   · MEASURES the picked box (`offsetLeft/Top/Width/Height`: unequal labels, 2–5 choices, a wrapped second row);
 *   · marks the track `data-seg-thumb` — the cue for the picked choice to drop its own fill. Until then the choice
 *     paints the pill itself, so the server's first paint is already right and the thumb takes over IN PLACE: it is
 *     laid with no transition the first time and never slides in from the left;
 *   · follows a pick (`MutationObserver` on those three attributes) and a resize (`ResizeObserver` on the track — a
 *     rotated phone, a wide window, a late font, a longer label). It reads, then writes to ITSELF only;
 *   · steps aside when the track is not an either-or (none or several picked — a row of toggles keeps its fills);
 *   · moves focus with ← → (↑ ↓, Home, End) between the choices; Enter and Space press, as buttons do.
 * Transform and size only; no timer, no request, no dependency.
 */
const PICKED = ':scope > [aria-pressed="true"], :scope > [aria-current="page"], :scope > [aria-selected="true"]';
const CHOICES = ':scope > button:not(:disabled), :scope > a[href]';
const FACE = '[data-seg-face]';

/** The little of the DOM the thumb touches — so its behaviour can be driven without a browser. */
type Box = { offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number };
export type PillChoiceEl = Box & {
  dataset: { segTone?: string; segFill?: string; segInset?: string };
  querySelector(selector: string): Box | null;
  focus?: () => void;
};
export type PillTrackEl = {
  querySelectorAll(selector: string): ArrayLike<PillChoiceEl>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};
export type PillThumbEl = { style: Record<string, string>; dataset: Record<string, string | undefined>; offsetWidth: number };

/**
 * The thumb's whole behaviour for one track. `place()` lays it on the picked choice (the first time with no
 * transition); `key()` answers an arrow key; `leave()` hands the fills back to the choices.
 */
export function createPillThumb(track: PillTrackEl, thumb: PillThumbEl, activeChoice: () => unknown = () => null) {
  let laid = false;
  const place = () => {
    /* Read, then write. */
    const lay = pillThumbLay(
      Array.from(track.querySelectorAll(PICKED)).map((on) => {
        /* A face is measured inside its choice (the choice is `position: relative`, so the face's offsets are from it). */
        const face = on.querySelector(FACE);
        /* …or the choice names the clear margin its pill keeps inside its own box (a 44-px button with a 38-px pill). */
        const inset = face ? 0 : Math.max(0, Number(on.dataset.segInset) || 0);
        return {
          x: on.offsetLeft + (face?.offsetLeft ?? 0) + inset,
          y: on.offsetTop + (face?.offsetTop ?? 0) + inset,
          w: (face ?? on).offsetWidth - 2 * inset,
          h: (face ?? on).offsetHeight - 2 * inset,
          tone: on.dataset.segTone,
          fill: on.dataset.segFill,
        };
      }),
    );
    if (!lay) {
      track.removeAttribute('data-seg-thumb');
      thumb.style.opacity = '0';
      laid = false;
      return;
    }
    if (!laid) thumb.style.transition = 'none';
    thumb.style.transform = lay.transform;
    thumb.style.width = lay.width;
    thumb.style.height = lay.height;
    thumb.style.background = lay.fill;
    thumb.dataset.tone = lay.tone;
    thumb.style.opacity = '1';
    track.setAttribute('data-seg-thumb', '');
    if (!laid) {
      /* The first placement is committed as it is — only later moves travel. */
      void thumb.offsetWidth;
      thumb.style.transition = '';
      laid = true;
    }
  };
  return {
    place,
    /** True = the key was the selector's: focus moved, the caller prevents the default. */
    key(key: string): boolean {
      const step = segStep(key);
      if (step === null) return false;
      const choices = Array.from(track.querySelectorAll(CHOICES));
      const at = choices.indexOf(activeChoice() as PillChoiceEl);
      if (at < 0 || choices.length < 2) return false;
      choices[segIndex(at, step, choices.length)]!.focus?.();
      return true;
    },
    leave() {
      track.removeAttribute('data-seg-thumb');
    },
  };
}

export function PillThumb() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const track = el?.parentElement;
    if (!el || !track) return;
    const thumb = createPillThumb(track as unknown as PillTrackEl, el as unknown as PillThumbEl, () => document.activeElement);
    thumb.place();
    const picks = new MutationObserver(thumb.place);
    picks.observe(track, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-current', 'aria-selected'] });
    /* Re-measured at every size the track takes — never one cached width. */
    const size = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(thumb.place);
    size?.observe(track);
    const onKey = (e: KeyboardEvent) => {
      if (thumb.key(e.key)) e.preventDefault();
    };
    track.addEventListener('keydown', onKey);
    return () => {
      picks.disconnect();
      size?.disconnect();
      track.removeEventListener('keydown', onKey);
      thumb.leave();
    };
  }, []);
  return <span ref={ref} aria-hidden data-seg-thumb-el="" className={PILL_THUMB_CLASS} />;
}

/** The thumb's look: a pill under the choices, moving on transform and size only — and not at all under "reduce motion". */
export const PILL_THUMB_CLASS =
  'pointer-events-none absolute left-0 top-0 z-0 rounded-full opacity-0 shadow-sm transition-[transform,width,height] duration-[220ms] ease-sn motion-reduce:transition-none data-[tone=plain]:bg-white data-[tone=wine]:bg-mulberry';

/**
 * Where the thumb lies for the choices that say they are picked — or null when the track is not an either-or right
 * now (none picked, several picked, or the picked one not laid out yet): the thumb then steps aside and each choice
 * keeps its own fill.
 */
export function pillThumbLay(
  picked: readonly { x: number; y: number; w: number; h: number; tone?: string | undefined; fill?: string | undefined }[],
): { transform: string; width: string; height: string; tone: string; fill: string } | null {
  if (picked.length !== 1) return null;
  const on = picked[0]!;
  if (on.w <= 0 || on.h <= 0) return null;
  return {
    transform: `translate(${on.x}px, ${on.y}px)`,
    width: `${on.w}px`,
    height: `${on.h}px`,
    /* A choice's own fill wins; else one of the two house tones (an unknown tone is plain — never an unstyled thumb). */
    tone: on.fill ? 'own' : on.tone === 'wine' ? 'wine' : 'plain',
    fill: on.fill ?? '',
  };
}

/** Which way a key moves focus along the selector — or null for a key that is not the selector's. */
export function segStep(key: string): -1 | 1 | 'first' | 'last' | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -1;
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}

/** The choice focus lands on: the next or the previous (wrapping round), the first or the last. */
export function segIndex(at: number, step: -1 | 1 | 'first' | 'last', count: number): number {
  if (step === 'first') return 0;
  if (step === 'last') return count - 1;
  return (at + step + count) % count;
}
