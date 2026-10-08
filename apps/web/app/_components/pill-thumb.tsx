'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * THE PILL SELECTOR'S TRAVELLING THUMB — the one moving part of `pill-selector.tsx` (read its docblock for when a
 * pill selector is the right control at all).
 *
 * Owner, 2026-10-08 (DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"): *"i like this pill type instead of the rounded
 * edges selector"* · *"and make them animate"* · *"adjust all pill selectors to this if possible"* · *"let's add a
 * bit of bounce and a pulse to imitate it has been pressed"*. Rule (`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md`
 * § 2.E): ONE terracotta thumb travels from the old choice to the new and resizes to the label it lands on, landing
 * with a small overshoot and pulsing once on a pick; the family's one speed is `--sn-pill-dur`; instant, with no
 * pulse, under "reduce motion".
 *
 * ── ANY TRACK CAN WEAR IT ───────────────────────────────────────────────────
 * Put `<PillThumb />` FIRST inside a `position: relative` track (`PILL_TRACK_CLASS`) whose choices are its direct
 * children — buttons or links. Nothing is passed in: the picked choice is whichever child says so the way it
 * already does (`aria-pressed="true"`, `aria-current="page"` or `aria-selected="true"`). The thumb is ONE colour for
 * every selector — the terracotta — so no choice names a fill. A choice may add:
 *   · a child marked `data-seg-face` — the thumb lies on THAT box (an icon's 38-px face inside a 44-px button);
 *     the choice itself is then `position: relative`, as every choice wearing `pillSegClass` already is;
 *   · `data-seg-inset="<px>"` — the thumb lies that far INSIDE the choice's box (a 44-px button whose pill is
 *     clipped 3 px inside a transparent border).
 * The thumb then:
 *   · MEASURES the picked box (`offsetLeft/Top/Width/Height`: unequal labels, 2–5 choices, a wrapped second row);
 *   · marks the track `data-seg-thumb` — the cue for the picked choice to drop its own fill. Until then the choice
 *     paints the pill itself, so the server's first paint is already right and the thumb takes over IN PLACE: it is
 *     laid with no transition the first time and never slides in from the left;
 *   · follows a pick (`MutationObserver` on those three attributes — a microtask, not a frame: it is told even in a
 *     hidden tab, where only the CSS travel itself is paused) and PULSES once when the picked choice changed
 *     (`data-pulse`; never on mount, never on a resize); follows a resize (`ResizeObserver` on the track — a
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
  dataset: { segInset?: string };
  querySelector(selector: string): Box | null;
  focus?: () => void;
};
export type PillTrackEl = {
  querySelectorAll(selector: string): ArrayLike<PillChoiceEl>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};
export type PillThumbEl = {
  style: Record<string, string>;
  offsetWidth: number;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

/**
 * The thumb's whole behaviour for one track. `place()` lays it on the picked choice (the first time with no
 * transition); `key()` answers an arrow key; `leave()` hands the fills back to the choices.
 */
export function createPillThumb(track: PillTrackEl, thumb: PillThumbEl, activeChoice: () => unknown = () => null) {
  let laid = false;
  /** The choice the thumb last lay on — a different one next time is a PICK (it pulses); the same one is a resize. */
  let last: PillChoiceEl | null = null;
  const place = () => {
    /* Read, then write. */
    const picked = Array.from(track.querySelectorAll(PICKED));
    const lay = pillThumbLay(
      picked.map((on) => {
        /* A face is measured inside its choice (the choice is `position: relative`, so the face's offsets are from it). */
        const face = on.querySelector(FACE);
        /* …or the choice names the clear margin its pill keeps inside its own box (a 44-px button with a 38-px pill). */
        const inset = face ? 0 : Math.max(0, Number(on.dataset.segInset) || 0);
        return {
          x: on.offsetLeft + (face?.offsetLeft ?? 0) + inset,
          y: on.offsetTop + (face?.offsetTop ?? 0) + inset,
          w: (face ?? on).offsetWidth - 2 * inset,
          h: (face ?? on).offsetHeight - 2 * inset,
        };
      }),
    );
    if (!lay) {
      track.removeAttribute('data-seg-thumb');
      thumb.style.opacity = '0';
      thumb.removeAttribute('data-pulse');
      laid = false;
      last = null;
      return;
    }
    const on = picked[0]!;
    /* A PICK: the thumb was already lying on another choice. (Not the first placement; not a resize.) */
    const pick = laid && last !== null && last !== on;
    if (!laid) thumb.style.transition = 'none';
    /* The pulse plays from its start each time: taken off before the move, put back after it is committed. */
    if (pick) thumb.removeAttribute('data-pulse');
    thumb.style.transform = lay.transform;
    thumb.style.width = lay.width;
    thumb.style.height = lay.height;
    thumb.style.opacity = '1';
    track.setAttribute('data-seg-thumb', '');
    if (!laid || pick) void thumb.offsetWidth;
    if (!laid) {
      /* The first placement is committed as it is — only later moves travel. */
      thumb.style.transition = '';
      laid = true;
    }
    if (pick) thumb.setAttribute('data-pulse', '');
    last = on;
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

/**
 * The thumb's look: ONE terracotta pill under the choices (`bg-mulberry`, the fill a picked choice wears —
 * `PILL_ON_CLASS`), travelling on transform and size at the family's one speed (`duration-sn-pill`) and landing with
 * a small overshoot (`ease-sn-spring`). `sn-pill-thumb` is its pulse (`globals.css`). Nothing moves under "reduce
 * motion".
 */
export const PILL_THUMB_CLASS =
  'sn-pill-thumb pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-mulberry opacity-0 shadow-sm transition-[transform,width,height] duration-sn-pill ease-sn-spring motion-reduce:transition-none';

/**
 * Where the thumb lies for the choices that say they are picked — or null when the track is not an either-or right
 * now (none picked, several picked, or the picked one not laid out yet): the thumb then steps aside and each choice
 * keeps its own fill.
 */
export function pillThumbLay(picked: readonly { x: number; y: number; w: number; h: number }[]): { transform: string; width: string; height: string } | null {
  if (picked.length !== 1) return null;
  const on = picked[0]!;
  if (on.w <= 0 || on.h <= 0) return null;
  return { transform: `translate(${on.x}px, ${on.y}px)`, width: `${on.w}px`, height: `${on.h}px` };
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
