'use client';

import { useEffect } from 'react';

/**
 * ⚓ A WAY IN THAT NAMES AN ANCHOR LANDS ON IT (Law 9; final check A6-B21: `/vendor-dashboard/recaps` forwards to
 * `/vendor-dashboard/shop/promote#share`, and at 375 the page opened at its top with `#share` drawn below the fold).
 * A server forward's `#hash` is not always scrolled to — the section can arrive after the router's own scroll. This
 * does what `Fold` already does for its `anchor` (app/_components/fold.tsx): on mount, and whenever the hash changes,
 * if the address names `id`, bring that element to the top. Draws nothing; does nothing for any other address.
 */
export function LandsAtHash({ id }: { id: string }) {
  useEffect(() => {
    const apply = () => {
      if (window.location.hash !== `#${id}`) return;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [id]);
  return null;
}
