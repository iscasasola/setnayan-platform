'use client';

/**
 * use-row-state.ts — ONE STATE FOR A WHOLE GROUP OF BUTTON ROWS (BUTTON_RULE
 * 3a + 3b, owner 2026-10-07: *"the 3 buttons will all be icons at the same time,
 * or text at the same time or icon with text at the same time. not each"* ·
 * *"this should always be at least 60% of the width and the 3 buttons adjust"*;
 * G36: *"what happend to (X) and (remove)"* — a 4-button row went icon-only
 * while a 3-button row stayed text).
 *
 * The prototype's `fitActs()`, ported: on the GROUP element it writes
 * `data-row-state` = full → text → icon, the first state in which NO row of the
 * group overflows and no text field in it is under 60 % of its row. The tightest
 * row decides for every row (`pickRowState`, lib/guest-roster-view.ts).
 *
 * 🔑 IT NEVER RE-RENDERS. The answer is an attribute set straight on the DOM, and
 * CSS (`guests-screen.module.css`, `[data-row-state]`) does the rest — so a
 * keystroke in the search box cannot make React rebuild the box or the rows
 * (rule 4: "why does it blink everytime i type").
 *
 * `[data-fit-row]` marks each row of the group; a row's text field is
 * `[data-fit-field]`.
 */

import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { pickRowState, type RowState } from '@/lib/guest-roster-view';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** One pass over a group. Exported for the guard and the lab. */
export function fitGroup(group: HTMLElement): RowState {
  const rows = Array.from(group.querySelectorAll<HTMLElement>('[data-fit-row]'));
  const tight = (state: RowState) => {
    group.setAttribute('data-row-state', state);
    return rows.some((row) => {
      if (row.scrollWidth > row.clientWidth + 1) return true;
      const field = row.querySelector<HTMLElement>('[data-fit-field]');
      if (field && field.getBoundingClientRect().width < row.clientWidth * 0.6 - 1) return true;
      return Array.from(row.querySelectorAll<HTMLElement>('[data-fit-acts]')).some(
        (a) => a.scrollWidth > a.clientWidth + 1,
      );
    });
  };
  const state = pickRowState(tight);
  group.setAttribute('data-row-state', state);
  return state;
}

/**
 * Keep `ref`'s group fitted: on mount, on resize, and whenever `deps` change
 * (the rows that exist). A MutationObserver is deliberately NOT used — typing
 * changes text inside the group, and re-fitting on every key is the blink.
 */
export function useRowState(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]): void {
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current) fitGroup(ref.current);
      });
    };
    fitGroup(el);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(el);
    window.addEventListener('resize', run);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
