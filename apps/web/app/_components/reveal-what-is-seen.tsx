'use client';

import { useEffect, useRef } from 'react';

/**
 * 👁 CONTENT IS NEVER INVISIBLE WHILE IT WAITS FOR AN ANIMATION (walker D7 on live f8f278f, 18 Nov 2026: after a
 * jump-scroll, Home's `.sn-reveal` sections sat blank for about a second).
 *
 * `.sn-reveal` (globals.css) plays `sn-rise` — opacity 0 → 1 with staggered delays — the moment an element MOUNTS,
 * on screen or not, and holds it at opacity 0 until its turn. So a section far down the page, or one that streamed in
 * after the first paint, was still fading in when the reader jumped to it: a blank space where the content was.
 *
 * The rule here: the reveal plays only for what the reader can SEE at that moment. Everything else is shown at once —
 *   · on mount, and whenever new content arrives (streaming, a section switch): an off-screen reveal is finished;
 *   · on a jump (a `#hash` move, or one scroll of more than ¾ of a screen): every reveal is finished.
 * Finishing an animation leaves it at its end frame (opacity 1, in place) — nothing is hidden, moved or restyled, and
 * `prefers-reduced-motion` already turns the reveal off. Draws nothing. 🛡 lib/reveal-what-is-seen.test.ts
 */
export function RevealWhatIsSeen() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root: ParentNode = ref.current?.closest('main') ?? document;
    const finish = (el: Element) => {
      for (const a of el.getAnimations?.() ?? []) a.finish();
    };
    const offScreen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= 0 || r.top >= window.innerHeight;
    };
    const showUnseen = () => root.querySelectorAll('.sn-reveal').forEach((el) => offScreen(el) && finish(el));
    const showAll = () => root.querySelectorAll('.sn-reveal').forEach(finish);

    showUnseen();
    let pending = 0;
    const mo = new MutationObserver(() => {
      if (!pending) pending = requestAnimationFrame(() => ((pending = 0), showUnseen()));
    });
    if (root instanceof Node) mo.observe(root, { childList: true, subtree: true });

    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) > window.innerHeight * 0.75) showAll();
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('hashchange', showAll);
    return () => {
      mo.disconnect();
      if (pending) cancelAnimationFrame(pending);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('hashchange', showAll);
    };
  }, []);
  return <span ref={ref} hidden data-reveal-what-is-seen="" />;
}
