'use client';

import { useEffect } from 'react';

/**
 * useEscapeKey — the single shared Escape-to-dismiss hook for modals, sheets,
 * popovers, and drawers.
 *
 * WHY: the 2026-06-20 user-flow audit found many overlays missing Escape (a
 * keyboard/accessibility dead-end) or hand-rolling the same keydown listener
 * inline across the app. One overlay = one `useEscapeKey(onClose)` call.
 *
 * Pass `active=false` to suspend (e.g. while a submit is pending, so Escape
 * can't cancel mid-flight) — mirror whatever guard the overlay's click-outside
 * / close button already uses.
 */
export function useEscapeKey(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onEscape, active]);
}
