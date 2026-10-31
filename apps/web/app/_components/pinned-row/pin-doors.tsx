'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { PinDoorMark } from './pin-door';

/**
 * The doors' strip of a pinned row — the part that gives: it never pushes the selector or the ⚙ off the 44-px line.
 *
 * 📏 THE FIT PASS (the house rule "a row of buttons shrinks together"; measured 2026-10-31 at 390: `Customers · Money ▾`
 * beside "₱186K received · ₱98K to come in · 1 overdue" cut the second door to "₱98K t"): when the doors cannot show
 * every word, they first TIGHTEN (`data-tight` — smaller type, less air), and only if that still does not fit the strip
 * SLIDES sideways under a fade at its right edge (`data-slides`) — every door stays whole and reachable, never cut
 * mid-word. Written as attributes, before paint, so nothing re-renders for a resize and nothing flashes.
 */
// The People row's `.pinDoors` (flex · gives first · clips), and the slide: sideways under a 24-px fade, no scrollbar.
const STRIP = [
  'flex min-w-0 flex-[0_1_auto] items-center gap-[2px] overflow-hidden',
  'data-[slides]:overflow-x-auto data-[slides]:overscroll-x-contain data-[slides]:[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  'data-[slides]:[-webkit-mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] data-[slides]:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]',
].join(' ');

export function PinDoors({
  children,
  label,
  mark,
  'data-tour': tour,
}: {
  children: ReactNode;
  label?: string;
  mark?: PinDoorMark;
  /** 🔦 A spotlight stop on the doors. */
  'data-tour'?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.removeAttribute('data-tight');
    el.removeAttribute('data-slides');
    if (el.scrollWidth <= el.clientWidth + 1) return;
    el.setAttribute('data-tight', '');
    if (el.scrollWidth > el.clientWidth + 1) el.setAttribute('data-slides', '');
  };
  // Every render (a count changed, the month re-counted): re-fit before paint.
  useLayoutEffect(fit);
  useEffect(() => {
    const row = ref.current?.parentElement;
    if (!row || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(row);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={ref} className={STRIP} role={label ? 'group' : undefined} aria-label={label} data-pin-doors="" {...mark} data-tour={tour}>
      {children}
    </span>
  );
}
