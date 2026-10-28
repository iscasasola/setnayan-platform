'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useShellBarOffset } from '../guests/_components/use-shell-bar-offset';

/** The pinned line's height — the part of the band left on screen once it has stuck. */
export const HOME_PIN_H = 52;

/**
 * home-cover-pin.tsx — 📌 THE HOME'S COVER PINS AS ONE LINE (owner 2026-10-27, "on home, we also want to pin the
 * header on top" → "pinned approve", Home A; prototype `guests_pinned_row_2026-10-27`, frame `h-A`).
 *
 * The band (`home-cover-band.tsx`) is `position: sticky` with a NEGATIVE top — the shell bar's height minus
 * (the band's height − 52 px) — so its in-flow height never changes and the Today line and the cards below never
 * move; once stuck, only its bottom 52 px stay on screen. This piece is the line drawn there: `<names> · <date>`
 * then Home's ⚙ at its right end (owner 2026-10-27, "EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO" — the pinned row is the
 * app-wide template: name line · … · ⚙). The ⚙ is NOT drawn here any more (owner 2026-10-29, *"keep it there"*): it is
 * the band's own ONE `MenuSettingsButton menu="home"` (`home-settings-gear.tsx`), drawn at rest and stuck in the same
 * spot — this line only leaves it room (`gear`). It writes, on the band:
 *   --home-bar     the shell bar's height while it shows (the shared read, `useShellBarOffset`);
 *   --home-band-h  the band's own height (a ResizeObserver — the "For <name>" line makes it taller);
 *   data-collapsed once the band has stuck (one rect read per scroll frame, written only when it changes) — the big
 *                  words fade out and this line fades in, in place.
 * With no script the vars are unset, `top` is invalid and the band simply scrolls, as it always did.
 * 🔒 lib/the-pinned-row-is-one-row.test.ts
 */
export function HomeCoverPin({ name, date, gear = false }: { name: string; date?: string; gear?: boolean }) {
  const line = useRef<HTMLSpanElement>(null);
  const band = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    band.current = line.current?.parentElement ?? null;
  }, []);
  useShellBarOffset(band, '--home-bar');
  useEffect(() => {
    const el = band.current;
    if (!el) return;
    let raf = 0;
    let lastH = -1;
    let lastOn: boolean | null = null;
    const read = () => {
      raf = 0;
      if (el.offsetHeight !== lastH) {
        lastH = el.offsetHeight;
        el.style.setProperty('--home-band-h', `${lastH}px`);
      }
      const top = parseFloat(getComputedStyle(el).top);
      const on = window.scrollY > 0 && Number.isFinite(top) && el.getBoundingClientRect().top <= top + 1;
      if (on !== lastOn) {
        lastOn = on;
        el.toggleAttribute('data-collapsed', on);
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
  }, []);
  return (
    <span
      ref={line}
      data-home-cover-pin=""
      className={`pointer-events-none absolute inset-x-4 bottom-0 ${gear ? 'pr-[54px]' : ''} flex h-[52px] translate-y-2 items-center gap-2.5 opacity-0 transition-[opacity,transform] duration-200 ease-sn group-data-[collapsed]/cover:translate-y-0 group-data-[collapsed]/cover:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none sm:inset-x-6 lg:inset-x-8`}
    >
      <span aria-hidden className="min-w-0 flex-1 truncate text-[17px] font-semibold">{name}</span>
      {date ? <span aria-hidden className="shrink-0 text-[13px] opacity-90">{date}</span> : null}
    </span>
  );
}
