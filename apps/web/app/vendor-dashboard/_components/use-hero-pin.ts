'use client';

import { useEffect, useState } from 'react';

/**
 * 📌 THE HERO → PINNED-ROW HAND-OFF — Portfolio's shipped `pin` (lane C4), lifted out unchanged so Today rides the SAME
 * mechanism (owner 11 Nov, *"Today settings yes"* — ask e of `supplier_queued_asks_2026-11-11`).
 *
 * Returns 0 while the hero (`SupplierHero`) is on screen and rises to 1 over the last 48 px as it leaves under the bar;
 * a tab mounts its ONE ⚙ on the hero while `pin < 0.5` and on its pinned row from `pin >= 0.5` — one mount at a time,
 * never two sheets. `getBand` returns the hero's wrapper (null = not drawn → stays 0, the ⚙ stays on the hero).
 *
 * 🔒 app/vendor-dashboard/_components/today-gear-rides-the-header.test.ts
 */
export function useHeroPin(getBand: () => Element | null): number {
  const [pin, setPin] = useState(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = getBand();
      if (!el) return;
      const v = Math.max(0, Math.min(1, (48 + 44 - el.getBoundingClientRect().bottom) / 48));
      setPin((p) => (Math.abs(p - v) < 0.01 ? p : v));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      if (raf) cancelAnimationFrame(raf);
    };
    // The band is read on every measure, so the getter's identity never matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return pin;
}
