'use client';

import { useEffect, type RefObject } from 'react';
import { isStuck } from './collapse-progress';

/**
 * 📌 useStuck — the ONE read of "has this sticky block stuck?" (THE ONE BUILD F2, 8 Nov 2026), lifted unchanged out of
 * the event Home's cover band (`home-cover-pin.tsx`, owner 2026-10-27 "on home, we also want to pin the header on top")
 * so the shared collapsing top and Home read it one way. On the block it writes:
 *   `heightVar`  its own height (a ResizeObserver — a taller line makes it taller), the H in top = T + R − H;
 *   `attr`       once it has stuck (one rect read per scroll frame, written only when it changes).
 * Never React state: a scroll re-renders nothing. With no script nothing is written and the block simply scrolls.
 */
export function useStuck(block: RefObject<HTMLElement | null>, { heightVar, attr }: { heightVar: string; attr: string }) {
  useEffect(() => {
    const el = block.current;
    if (!el) return;
    let raf = 0;
    let lastH = -1;
    let lastOn: boolean | null = null;
    const read = () => {
      raf = 0;
      if (el.offsetHeight !== lastH) {
        lastH = el.offsetHeight;
        el.style.setProperty(heightVar, `${lastH}px`);
      }
      const on = isStuck(window.scrollY, el.getBoundingClientRect().top, parseFloat(getComputedStyle(el).top));
      if (on !== lastOn) {
        lastOn = on;
        el.toggleAttribute(attr, on);
      }
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(soon) : null;
    ro?.observe(el);
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
    };
  }, [block, heightVar, attr]);
}
