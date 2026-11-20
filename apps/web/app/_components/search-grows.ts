'use client';

/**
 * search-grows.ts — SEARCH GROWS INTO THE ROW, THE ONE SHARED PART (the motion standard, owner 18 Nov 2026: *"Yes, take
 * it"* on `prototypes/motion_search_grows_2026-11-18.html`; specs `MOTION_STANDARD_2026-11-18.md` § 4 #11 + § 9).
 *
 * 🎞 21 NOV 2026 — FROM JUST THE ICON TO THE WHOLE ROW (owner: *"When search icon is pressed. we want the search bar to
 * animate from just the icon to the full width search bar"* · *"use fable to design the animation"*; Fable's drawing
 * `prototypes/search_icon_grows_2026-11-21_fable.html`, its build table copied here 1:1). The 18 Nov move played the
 * pill with a scaleX, which stretched the 44 px round's radius, ring and glass into an oval, and the Show round beside
 * it simply vanished. Now:
 *
 *   · the PILL's real width grows — 44 px → the row — Move 320 on Spring, its overshoot capped at 8 px, so the radius,
 *     the ring and the glass are true on every frame (a clip could not keep the inset ring on the moving end);
 *   · the MAGNIFIER is one node that slides from the round's centre to the field's left glyph on the pill's own curve;
 *   · the PLACEHOLDER words wait Tap 100, then fade in Quick 200 on Settle — never read while the pill is still narrow;
 *     the cursor is there from frame 0 (tap and type, untouched);
 *   · a round the field takes the row from (Show) GIVES WAY — fades out, 6 px right and .9 smaller, Quick 200 on Settle,
 *     drawn at its old place under the pill until the fade ends;
 *   · it FOLDS BACK faster than it opens — Quick 200 on Settle, the words gone in Tap 100 — and a round it had covered
 *     COMES BACK 100 ms in (Quick 200 on Settle);
 *   · reduced motion: at once.
 * Tapped again mid-move it turns around from where it is.
 *
 * WHO USES IT: `components/thumb-row.tsx` — the ONE row every list's search sits in (Today, Guests, the supplier's
 * Clients, the couple's Suppliers, and every other list screen), so each of them inherits it. A screen never writes
 * this move of its own. 🔒 lib/search-grows-is-one-shared-part.test.ts
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { EASE_SETTLE, MOVE_MS, QUICK_MS, TAP_MS } from '@/lib/motion-table';
import { motionReduced, springEasing } from '@/lib/rows-move';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const GROW_ID = 'sn-search-grows';

/** How far the spring may carry the pill past the row (Fable's `max-width: calc(100% + 8px)`). */
export const SEARCH_GROWS_OVERSHOOT_PX = 8;

type Box = { left: number; width: number };

/**
 * The pill: from the box it had (`from`) to the box it has (`to`) — its real width (as the flex basis, so the radius
 * is never stretched) and its left edge (a translate). Pure, so the guard can read it.
 */
export function searchGrowsFrames(from: Box, to: Box): Keyframe[] | null {
  if (to.width < 1) return null;
  if (Math.abs(from.width - to.width) < 1 && Math.abs(from.left - to.left) < 1) return null;
  const cap = `${Math.round(Math.max(from.width, to.width) + SEARCH_GROWS_OVERSHOOT_PX)}px`;
  const frame = (box: Box, dx: number): Keyframe => ({
    transform: `translateX(${Math.round(dx * 100) / 100}px)`,
    flexBasis: `${Math.round(box.width * 100) / 100}px`,
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: cap,
  });
  return [frame(from, from.left - to.left), frame(to, 0)];
}

/** The magnifier: from where it sat in the pill to where it sits now, on the pill's own curve. */
export function searchGlyphFrames(fromOffset: number, toOffset: number): Keyframe[] | null {
  const dx = Math.round((fromOffset - toOffset) * 100) / 100;
  if (Math.abs(dx) < 0.5) return null;
  return [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0px)' }];
}

/** A round the field takes the row from gives way; one it gives back returns — the same frames, played either way. */
export const SEARCH_GIVES_WAY: Keyframe[] = [
  { opacity: 1, transform: 'none' },
  { opacity: 0, transform: 'translateX(6px) scale(0.9)' },
];

/** The timing: open on Spring in Move, fold back on Settle in Quick. */
export function searchGrowsTiming(open: boolean): { duration: number; easing: string } {
  return open ? { duration: MOVE_MS, easing: springEasing() } : { duration: QUICK_MS, easing: EASE_SETTLE };
}

const rectIn = (el: Element | null | undefined) => (el ? el.getBoundingClientRect() : null);
const shown = (r: DOMRect | null) => Boolean(r && r.width >= 1);

/**
 * Play it. The row is ALREADY in its new shape; `undo` puts the old shape back for one measure and returns the
 * function that restores the new one.
 */
export function playSearchGrows(row: HTMLElement, field: HTMLElement, open: boolean, undo: () => () => void): void {
  if (typeof field.animate !== 'function' || motionReduced()) return;
  const seen = field.getBoundingClientRect(); // the new shape, plus a move in flight
  for (const el of [field, ...Array.from(row.querySelectorAll<HTMLElement>('*'))]) for (const a of el.getAnimations()) if (a.id === GROW_ID) a.cancel();
  const seats = Array.from(row.children).filter((s): s is HTMLElement => s instanceof HTMLElement && s !== field && !s.contains(field));
  // The magnifier is an <svg> (lucide) or the 🔍/＋ button — an Element either way, not always an HTMLElement.
  const glyph = field.firstElementChild as (HTMLElement | SVGElement | null);
  const input = field.querySelector('input');
  // The new shape …
  const to = field.getBoundingClientRect();
  const inputTo = rectIn(input);
  const seatsTo = seats.map(rectIn);
  // … and, for one read, the old one.
  const redo = undo();
  const was = field.getBoundingClientRect();
  const glyphWas = rectIn(glyph);
  const inputWas = rectIn(input);
  const seatsWas = seats.map(rectIn);
  const rowWas = row.getBoundingClientRect();
  redo();
  // Where the magnifier sits in the NEW shape at the width the pill starts from — at rest it is centred, so on the
  // fold it would ride the middle of the shrinking pill; held at the starting width once, the slide is exact (its
  // place is a straight line in the width, and the width runs on the same curve).
  const glyphAtStart = (w: number) => {
    if (!glyph) return null;
    const keep = field.getAttribute('style');
    field.style.flex = `0 0 ${w}px`;
    field.style.maxWidth = 'none';
    const g = glyph.getBoundingClientRect().left - field.getBoundingClientRect().left;
    if (keep === null) field.removeAttribute('style');
    else field.setAttribute('style', keep);
    return g;
  };
  const midMove = Math.abs(seen.width - to.width) > 0.5 || Math.abs(seen.left - to.left) > 0.5;
  const from = midMove ? seen : was;
  const timing = searchGrowsTiming(open);

  // 1 · The pill.
  const frames = searchGrowsFrames(from, to);
  if (!frames) return;
  const glyphStart = glyphAtStart(from.width);
  field.animate(frames, { ...timing, id: GROW_ID });

  // 2 · The magnifier, from the round's centre to the field's left (or back), on the pill's curve.
  if (glyph && glyphWas && glyphStart !== null) {
    const g = searchGlyphFrames(glyphWas.left - was.left, glyphStart);
    if (g) glyph.animate(g, { ...timing, id: GROW_ID });
  }

  if (open) {
    // 3 · The words wait, then arrive behind the growth (the cursor is already there).
    field.setAttribute('data-search-words-wait', '');
    window.setTimeout(() => field.removeAttribute('data-search-words-wait'), TAP_MS);
    // 4 · A round the field took the row from gives way, drawn at its old place under the pill until the fade ends.
    seats.forEach((seat, i) => {
      const w = seatsWas[i] ?? null;
      if (!w || !shown(w) || shown(seatsTo[i] ?? null)) return;
      seat.setAttribute('data-search-gives-way', '');
      seat.style.left = `${w.left - rowWas.left}px`;
      seat.style.top = `${w.top - rowWas.top}px`;
      const a = seat.animate(SEARCH_GIVES_WAY, { duration: QUICK_MS, easing: EASE_SETTLE, id: GROW_ID });
      const done = () => {
        seat.removeAttribute('data-search-gives-way');
        seat.style.removeProperty('left');
        seat.style.removeProperty('top');
      };
      a.onfinish = done;
      a.oncancel = done;
    });
    return;
  }

  // 5 · Folding back: the words go in Tap, where they were, while the pill folds.
  if (input instanceof HTMLElement && inputWas && inputTo && shown(inputWas)) {
    const dx = Math.round((inputWas.left - was.left - (inputTo.left - to.left)) * 100) / 100;
    input.animate([{ opacity: 1, transform: `translateX(${dx}px)` }, { opacity: 0, transform: `translateX(${dx}px)` }], { duration: TAP_MS, easing: EASE_SETTLE, id: GROW_ID });
  }
  // 6 · A round it had covered comes back, 100 ms in.
  seats.forEach((seat, i) => {
    if (shown(seatsWas[i] ?? null) || !shown(seatsTo[i] ?? null)) return;
    seat.animate([...SEARCH_GIVES_WAY].reverse(), { duration: QUICK_MS, delay: TAP_MS, easing: EASE_SETTLE, fill: 'backwards', id: GROW_ID });
  });
}

/**
 * The hook a search row calls: when `open` flips, the field (`fieldSelector`, inside the row) grows across the row or
 * folds back. `shape` is the attribute on the row that CAUSES the layout change (the thumb row's `data-riding`) — it
 * is put back for one measure, then restored. Never plays on the first drawing.
 */
export function useSearchGrows(rowRef: RefObject<HTMLElement | null>, open: boolean, { field: fieldSelector, shape }: { field: string; shape: string }): void {
  const was = useRef(open);
  useIsoLayoutEffect(() => {
    if (was.current === open) return;
    was.current = open;
    const row = rowRef.current;
    const field = row?.querySelector<HTMLElement>(fieldSelector);
    if (!row || !field) return;
    playSearchGrows(row, field, open, () => {
      row.toggleAttribute(shape, !open);
      return () => {
        row.toggleAttribute(shape, open);
      };
    });
  }, [open, fieldSelector, shape, rowRef]);
}

/**
 * 👆 TAP AND TYPE — put the cursor in the search NOW (owner 18 Nov 2026: *"it should be tap and type"*). Called from the
 * seat's own click handler and nowhere else: iPhone Safari opens the keyboard only for a focus made INSIDE the user's
 * gesture, so this is a plain synchronous `.focus()` — never inside a timer, a frame, a promise or an animation's end.
 * (At rest the real input already lies over the whole icon, so the tap itself lands on it; this covers a tap that
 * lands on the seat's edge, and a seat whose control draws its own box.) `preventScroll`: the row is already in view.
 */
export function focusSearchNow(seat: HTMLElement): void {
  const input = seat.querySelector<HTMLInputElement>("input[type='search']");
  if (!input || document.activeElement === input) return;
  input.focus({ preventScroll: true });
}
