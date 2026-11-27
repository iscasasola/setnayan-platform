'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 📌 The sticky head sits UNDER the shell's top bar while the bar shows (`--gs-top`, read by
 * `guests-screen.module.css` `.stick`). Lifted out of `guests-screen.tsx` unchanged (2026-10-22) so
 * People — which wears the Guest list's clothes (owner 2026-10-22: "People must look similar to
 * guests") — reads the bar the same way instead of keeping a copy.
 */
/**
 * `name` is the custom property it writes (`--gs-top` for Guests and People). The event Home's pinned cover band
 * reads the same bar through it as `--home-bar` (2026-10-27, "on home, we also want to pin the header on top") —
 * one read of the bar, never a copy (`home-cover-pin.tsx`).
 */
/**
 * 🪤 Whether the shell's top bar is ON SCREEN. `data-hidden="true"` is the scroll's REQUEST to slide away; the bar only
 * honours it where `front-door.css` lets it (`.fd[data-chrome='app'] .fd-topwrap[data-hidden='true']`): below 1024 px,
 * and not on the 701–1023 tab layout (`data-boundary='tab'`). On a desk the bar stays put while `data-hidden` still
 * reads "true" — reading the attribute alone pinned every sticky head UNDER the bar there (found 2026-10-27, building
 * the pinned rows: at 1280 the Guests row and the Suppliers segments sat hidden behind the 60-px bar).
 */
export function shellBarShows(bar: HTMLElement | null): bar is HTMLElement {
  if (!bar || getComputedStyle(bar).display === 'none') return false;
  if (bar.getAttribute('data-hidden') !== 'true') return true;
  if (!bar.closest("[data-chrome='app']")) return true;
  if (window.matchMedia('(min-width: 1024px)').matches) return true;
  return window.matchMedia('(min-width: 701px)').matches && !!bar.closest("[data-boundary='tab']");
}

/**
 * 🗂 HOW MUCH OF A LINE ABOVE THE PAGE STILL SHOWS UNDER THE BAR (bug, 27 Nov 2026, Apple build 10: the coordinator's
 * Guests wore dark side bars and a blank gap). The coordinator's slim dark line (`coordinating-line.tsx`) sits in the
 * flow under the bar; a row FIXED at the bar's bottom covered it, its dark edges peeked out either side of the row, and
 * the row's holder left an empty band under the line. The row now sits under whatever part of the line still shows,
 * and rises with it as it scrolls away: 0 once the line is under the bar, the line's height at rest.
 */
export function lineShowingPx(line: { top: number; bottom: number }, barBottom: number): number {
  return Math.round(Math.max(0, Math.min(line.bottom - line.top, line.bottom - barBottom)));
}

/**
 * `under` (Guests only): a line drawn between the bar and the page (the coordinator's line). When it is on the page its
 * showing part is added to `name`, and written alone as `--gs-under`, so the paper band above the row stops at the line.
 * No line → no scroll listener and the same one write as before.
 */
export function useShellBarOffset(root: RefObject<HTMLElement | null>, name = '--gs-top', opts: { under?: string } = {}) {
  const under = opts.under ?? null;
  useEffect(() => {
    const el = root.current;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    if (!el) return;
    const line = under ? document.querySelector<HTMLElement>(under) : null;
    if (!line) {
      const sync = () => {
        /* Bar gone → the head pins at the top of the SAFE AREA, never at 0: on an iPhone 0 is under the clock and the
           Dynamic Island (owner 2026-10-30, a screenshot of Home's pinned cover line "intersecting with the floating
           island of iphone"). env() is 0 on every screen without an inset, so desktop and Android are unchanged. */
        el.style.setProperty(name, shellBarShows(bar) ? `${bar.getBoundingClientRect().height}px` : 'env(safe-area-inset-top, 0px)');
      };
      sync();
      if (!bar) return;
      const mo = new MutationObserver(sync);
      mo.observe(bar, { attributes: true, attributeFilter: ['data-hidden', 'style', 'class'] });
      window.addEventListener('resize', sync);
      return () => {
        mo.disconnect();
        window.removeEventListener('resize', sync);
      };
    }
    let last = '';
    let raf = 0;
    const sync = () => {
      raf = 0;
      // Every reading first, then the writes (one layout per call).
      const shows = shellBarShows(bar);
      const barH = shows ? bar.getBoundingClientRect().height : 0;
      const extra = lineShowingPx(line.getBoundingClientRect(), shows ? bar.getBoundingClientRect().bottom : 0);
      const top = shows ? `${barH + extra}px` : `calc(env(safe-area-inset-top, 0px) + ${extra}px)`;
      if (top === last) return;
      last = top;
      el.style.setProperty(name, top);
      el.style.setProperty('--gs-under', `${extra}px`);
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    sync();
    const mo = bar ? new MutationObserver(soon) : null;
    mo?.observe(bar!, { attributes: true, attributeFilter: ['data-hidden', 'style', 'class'] });
    window.addEventListener('resize', soon);
    window.addEventListener('scroll', soon, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo?.disconnect();
      window.removeEventListener('resize', soon);
      window.removeEventListener('scroll', soon);
    };
  }, [root, name, under]);
}
