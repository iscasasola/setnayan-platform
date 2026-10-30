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

export function useShellBarOffset(root: RefObject<HTMLElement | null>, name = '--gs-top') {
  useEffect(() => {
    const el = root.current;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    if (!el) return;
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
  }, [root, name]);
}

