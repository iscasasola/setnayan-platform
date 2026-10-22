'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 📌 The sticky head sits UNDER the shell's top bar while the bar shows (`--gs-top`, read by
 * `guests-screen.module.css` `.stick`). Lifted out of `guests-screen.tsx` unchanged (2026-10-22) so
 * People — which wears the Guest list's clothes (owner 2026-10-22: "People must look similar to
 * guests") — reads the bar the same way instead of keeping a copy.
 */
export function useShellBarOffset(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    if (!el) return;
    const sync = () => {
      const shown = bar && bar.getAttribute('data-hidden') !== 'true' && getComputedStyle(bar).display !== 'none';
      el.style.setProperty('--gs-top', shown ? `${bar!.getBoundingClientRect().height}px` : '0px');
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
  }, [root]);
}

