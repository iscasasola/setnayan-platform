'use client';

import { useEffect } from 'react';

/**
 * CockpitFx — the App Performance premium animation system (ported from the
 * approved prototype · spec corpus App_Performance_Cockpit_2026-07-02.html).
 *
 * Doctrine (owner "make all graphs premium and animated" + the established
 * scroll-into-view pattern):
 *  - IntersectionObserver reveals each [data-reveal] card ONCE as it enters
 *    the viewport (no pulsing, no loops).
 *  - Chart strokes tagged .apx-draw draw in via pathLength=1 dashoffset.
 *  - Numbers tagged [data-countup] count 0 → final, then the exact original
 *    string is restored (tabular-nums = zero layout shift).
 *  - MOTION SAFETY: the pre-animation CSS only applies under the `apx-anim`
 *    class, which THIS component adds — so no-JS and prefers-reduced-motion
 *    both render the final state instantly. Server markup is the final state.
 */
export function CockpitFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.getElementById('apx-root');
    if (!root) return;
    root.classList.add('apx-anim');

    const counters = new WeakMap<Element, boolean>();

    const countUp = (el: Element) => {
      if (counters.get(el)) return;
      counters.set(el, true);
      const finalText = el.textContent ?? '';
      const digits = finalText.replace(/[^0-9.]/g, '');
      const target = Number.parseFloat(digits);
      if (!Number.isFinite(target) || target <= 0) return;
      const started = performance.now();
      const dur = 800;
      const fmt = (v: number) =>
        finalText.replace(digits, () => {
          const isInt = !digits.includes('.');
          return isInt
            ? Math.round(v).toLocaleString('en-PH')
            : v.toFixed(digits.split('.')[1]?.length ?? 1);
        });
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(target * eased);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = finalText; // restore byte-exact
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('apx-in');
          entry.target
            .querySelectorAll('[data-countup]')
            .forEach((el) => countUp(el));
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.2 },
    );
    root.querySelectorAll('[data-reveal]').forEach((el, i) => {
      (el as HTMLElement).style.setProperty('--apx-d', `${Math.min(i, 6) * 70}ms`);
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}

