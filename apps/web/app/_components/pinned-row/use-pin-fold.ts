'use client';

/**
 * 📌 A PAGE'S TOP ROW COMPRESSES ONCE THE PAGE RUNS UNDER IT (owner 2026-10-29, DECISION_LOG "EVERY SUPPLIER-DASHBOARD
 * PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL": *"we want pinning the top rows to a compressed single row
 * versions on the different pages"*; prototype v13 "PIN ON SCROLL — hysteresis so the fold never flickers at the edge").
 *
 * The Guests sticky block's own mechanism (`guests-screen.tsx`, "THE ONE PINNED ROW, PINNED ONCE"), lifted so every page
 * gets it from ONE place instead of a copy per page:
 *   · the row says it is folded with an ATTRIBUTE (`data-folded`), never React state — the list under it never
 *     re-renders for a scroll;
 *   · read once per frame from one passive capture scroll listener (the page may scroll the window or a column);
 *   · it folds only once it is STUCK and the page has gone 44 px further under it, and unfolds within 6 px of where it
 *     stuck — the prototype's hysteresis, so the edge never flickers;
 *   · the doors are the same buttons folded or not: a tap still filters.
 * What a folded row looks like is `pin-fold.css` (`[data-pin-fold][data-folded]`, loaded once by the root layout): the tiles become one slim line,
 * number and word side by side. Back at the top the full tiles return.
 *
 * Use: put `data-pin-fold=""` and this ref on the page's sticky row, `data-pin-door` on each count, `data-pin-n` /
 * `data-pin-w` on its number and word. 🔒 app/_components/pinned-row/a-top-row-folds-on-scroll.test.ts
 */
import { useEffect, type RefObject } from 'react';

export const PIN_FOLD_AFTER_PX = 44;
export const PIN_UNFOLD_WITHIN_PX = 6;

/** The fold decision, pure — `stuckAt` is the scroll offset at which the row became stuck (null = not stuck). */
export function pinFoldNext(folded: boolean, stuckAt: number | null, y: number): boolean {
  if (stuckAt === null) return false;
  const under = y - stuckAt;
  if (!folded && under > PIN_FOLD_AFTER_PX) return true;
  if (folded && under < PIN_UNFOLD_WITHIN_PX) return false;
  return folded;
}

export function usePinFold(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let stuckAt: number | null = null;
    let folded = false;
    const read = () => {
      raf = 0;
      const top = parseFloat(getComputedStyle(el).top) || 0;
      const stuck = el.getBoundingClientRect().top <= top + 0.5;
      const y = window.scrollY;
      if (!stuck) stuckAt = null;
      else if (stuckAt === null) stuckAt = y;
      const next = pinFoldNext(folded, stuckAt, y);
      if (next !== folded) {
        folded = next;
        el.setAttribute('data-pin-was', '');
        el.toggleAttribute('data-folded', next);
      }
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      el.removeAttribute('data-folded');
      el.removeAttribute('data-pin-was');
    };
  }, [ref]);
}
