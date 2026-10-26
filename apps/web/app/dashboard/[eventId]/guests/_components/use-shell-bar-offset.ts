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
export function useShellBarOffset(root: RefObject<HTMLElement | null>, name = '--gs-top') {
  useEffect(() => {
    const el = root.current;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    if (!el) return;
    const sync = () => {
      const shown = bar && bar.getAttribute('data-hidden') !== 'true' && getComputedStyle(bar).display !== 'none';
      el.style.setProperty(name, shown ? `${bar!.getBoundingClientRect().height}px` : '0px');
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

