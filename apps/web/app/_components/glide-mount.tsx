'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GLIDE_NUDGE, glideAt, nudgeOnArrive, type GlideAt } from '@/lib/glide';
import { EASE_SETTLE, springEase } from '@/lib/motion-table';

/**
 * 🛷 GLIDE — ONE MOUNT FOR EVERY RAIL AND INNER LIST (MOTION_STANDARD_2026-11-18 § 4 #12; drawing
 * `motion_standard_2026-11-18_fable.html` Part B "Glide").
 *
 * A rail or an inner list wears `.sn-glide-x` / `.sn-glide-y` (globals.css: `overscroll-behavior: contain` + the ONE
 * shared edge fade) — nothing else. This mount, once in the root layout, keeps two things for all of them with ONE
 * listener (a scroll does not bubble, so it is caught on the way down):
 *
 *   1 · `data-glide-at` — where the scroller stands, so only an edge with MORE TO SHOW fades (a rail resting at its
 *       start never fades its first card; a rail with nothing to scroll never fades at all);
 *   2 · the nudge — when a scroll ARRIVES at an end, the content goes 12 px over and comes back in Quick on Spring
 *       (`translate`, nothing laid out again). Skipped where the phone plays its own rubber band inside the box (iOS),
 *       and under reduced motion.
 *
 * The slow-down itself is the phone's own; nothing here retimes a scroll.
 */
const SEL = '.sn-glide-x, .sn-glide-y';

function measure(el: HTMLElement): GlideAt {
  const x = el.classList.contains('sn-glide-x');
  const at = x ? glideAt(el.scrollLeft, el.scrollWidth, el.clientWidth) : glideAt(el.scrollTop, el.scrollHeight, el.clientHeight);
  if (el.dataset.glideAt !== at) el.dataset.glideAt = at;
  return at;
}

/** iOS keeps its rubber band inside a `contain` box — it needs no nudge of ours. */
function hasNativeBand(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports?.('-webkit-touch-callout', 'none') === true;
}

export function GlideMount() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const native = hasNativeBand();
    const moving = new WeakSet<HTMLElement>();

    const nudge = (el: HTMLElement, dir: -1 | 1) => {
      if (reduced || native || moving.has(el) || !el.animate) return;
      const x = el.classList.contains('sn-glide-x');
      const over = `${dir * GLIDE_NUDGE.px}px`;
      const at = (v: string) => (x ? `${v} 0` : `0 ${v}`);
      const total = GLIDE_NUDGE.outMs + GLIDE_NUDGE.backMs;
      moving.add(el);
      // Every child rides together, so the box (and its edge fade) stays where it is.
      const kids = Array.from(el.children).slice(0, 24) as HTMLElement[];
      const runs = kids.map((k) =>
        k.animate(
          [
            { translate: at('0px'), easing: EASE_SETTLE },
            { translate: at(over), offset: GLIDE_NUDGE.outMs / total, easing: springEase() },
            { translate: at('0px') },
          ],
          { duration: total, fill: 'none' },
        ),
      );
      const done = () => moving.delete(el);
      if (runs[0]) runs[0].finished.then(done, done);
      else done();
    };

    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.matches(SEL)) return;
      const was = (el.dataset.glideAt as GlideAt | undefined) ?? 'none';
      const now = measure(el);
      const dir = nudgeOnArrive(was, now);
      if (dir) nudge(el, dir);
    };
    const sweep = () => document.querySelectorAll<HTMLElement>(SEL).forEach(measure);
    const onTouch = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(SEL) : null;
      if (el) measure(el);
    };

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('pointerdown', onTouch, { capture: true, passive: true });
    window.addEventListener('resize', sweep, { passive: true });
    // After this page has drawn — and once more when late content (photos, a client list) has landed.
    const raf = requestAnimationFrame(sweep);
    const late = window.setTimeout(sweep, 1200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      document.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('pointerdown', onTouch, { capture: true });
      window.removeEventListener('resize', sweep);
    };
  }, [pathname]);

  return null;
}
