'use client';

/**
 * useRotatingHint — the hook every shared text field uses to cycle its example hints (`lib/rotating-hint.ts` says
 * what it does and why). It holds NO React state: the cycle writes the input's `placeholder` attribute directly, so a
 * step never re-renders the box, its row or the page. The `placeholder` prop the field renders stays the box's own
 * name — the server render, the accessible name and every "the placeholder names the place" guard read that.
 *
 * 🔒 lib/rotating-hint.test.ts
 */
import { useEffect, type RefObject } from 'react';
import { startHintCycle } from './rotating-hint';

export function useRotatingHint(
  ref: RefObject<HTMLInputElement | null>,
  place: string,
  hints: readonly string[] | null | undefined,
): void {
  // One string, so a new array with the same lines (every render of the host) never restarts the cycle.
  const key = (hints ?? []).join('\n');
  useEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return startHintCycle(el, place, key.split('\n'), {
      reduced,
      focused: () => document.activeElement === el,
      every: (fn, ms) => {
        const t = window.setInterval(fn, ms);
        return () => window.clearInterval(t);
      },
    });
  }, [ref, place, key]);
}
