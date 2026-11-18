'use client';

/**
 * search-grows.ts — SEARCH GROWS INTO THE ROW, THE ONE SHARED PART (the motion standard, owner 18 Nov 2026: *"Yes, take
 * it"* on `prototypes/motion_search_grows_2026-11-18.html`; specs `MOTION_STANDARD_2026-11-18.md` § 4 #11 + § 9).
 *
 *   · the search field GROWS across its row — Move 320 on Spring — from the box it had to the whole row;
 *   · the row's other buttons give it the row, and FADE BACK (Quick 200 on Settle) when it folds;
 *   · it FOLDS BACK faster than it opens — Quick 200 on Settle;
 *   · reduced motion: at once.
 *
 * Transform and opacity only: the row is laid out ONCE in its new shape, and the field is played from the box it had
 * (measured by putting the old shape back for one read) to the box it has — a translate and a scaleX, its own words
 * fading in behind the move so they are never read stretched. Tapped again mid-move it turns around from where it is.
 *
 * WHO USES IT: `components/thumb-row.tsx` — the ONE row every list's search sits in (Guests, the supplier's Clients,
 * the couple's Suppliers, and every other list screen), so each of them inherits it. A screen never writes this move
 * of its own. 🔒 lib/search-grows-is-one-shared-part.test.ts
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { EASE_SETTLE, MOVE_MS, QUICK_MS } from '@/lib/motion-table';
import { motionReduced, springEasing } from '@/lib/rows-move';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const GROW_ID = 'sn-search-grows';

/** The move itself: from the box the field had (`from`) to the box it has (`to`) — pure, so the guard can read it. */
export function searchGrowsFrames(from: { left: number; width: number }, to: { left: number; width: number }): Keyframe[] | null {
  if (to.width < 1) return null;
  if (Math.abs(from.width - to.width) < 1 && Math.abs(from.left - to.left) < 1) return null;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const sx = from.width / to.width;
  return [{ transform: `translateX(${dx}px) scaleX(${sx})` }, { transform: 'translateX(0px) scaleX(1)' }];
}

/** The timing: open on Spring in Move, fold back on Settle in Quick. */
export function searchGrowsTiming(open: boolean): { duration: number; easing: string } {
  return open ? { duration: MOVE_MS, easing: springEasing() } : { duration: QUICK_MS, easing: EASE_SETTLE };
}

/**
 * Play it. The row is ALREADY in its new shape; `undo` puts the old shape back for one measure and returns the
 * function that restores the new one.
 */
export function playSearchGrows(row: HTMLElement, field: HTMLElement, open: boolean, undo: () => () => void): void {
  if (typeof field.animate !== 'function' || motionReduced()) return;
  const seen = field.getBoundingClientRect(); // the new shape, plus a move in flight
  for (const el of [field, ...Array.from(row.querySelectorAll<HTMLElement>('*'))]) for (const a of el.getAnimations()) if (a.id === GROW_ID) a.cancel();
  const to = field.getBoundingClientRect();
  const redo = undo();
  const was = field.getBoundingClientRect();
  redo();
  const midMove = Math.abs(seen.width - to.width) > 0.5 || Math.abs(seen.left - to.left) > 0.5;
  const frames = searchGrowsFrames(midMove ? seen : was, to);
  const timing = searchGrowsTiming(open);
  if (frames) {
    field.animate(frames, { ...timing, id: GROW_ID });
    // Its own words arrive behind the move (never read stretched).
    if (open) for (const child of Array.from(field.children)) if (child instanceof HTMLElement) child.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: MOVE_MS, easing: EASE_SETTLE, id: GROW_ID });
  }
  // Folded back: the buttons it had covered return.
  if (!open) {
    for (const seat of Array.from(row.children)) {
      if (seat instanceof HTMLElement && seat !== field && !seat.contains(field)) seat.animate([{ opacity: 0 }, { opacity: 1 }], { duration: QUICK_MS, easing: EASE_SETTLE, id: GROW_ID });
    }
  }
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
