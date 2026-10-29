'use client';

/**
 * 📌 THE PIN LINE — where the next thing that pins should sit (owner 2026-10-29, the pin rules of supplier dashboard v13:
 * "an opened row's head stays pinned" · "every page's section headers pin too and hand over to the next"; the app-wide
 * accordion rule: "an OPEN accordion's head pins at the top as ONE SLIM LINE").
 *
 * ONE number for the whole page, written as `--sn-pin-top` on `<html>`: the lowest edge of what is pinned at the top
 * right now —
 *   · the shell's bar, while it shows (on a phone it slides away on scroll; from 701 on the supplier tree it is the
 *     pinned row and never does), and
 *   · a page's own sticky row (`main [data-pinned-row]`) while it is stuck.
 * An open fold's head (`fold.tsx`) and the right column (`SupplierColumns`) sit on this line, so they ride flush under
 * whatever is pinned instead of behind it — and follow it as the bar comes and goes.
 *
 * Shared, not per-consumer: ONE passive capture scroll listener + resize for the page, started by the first user and
 * stopped by the last; read once per frame; written only when the number changes (an attribute-style write — nothing
 * re-renders for a scroll). Guests' sticky block measures its bar the same way (`guests-screen.tsx`, `--gs-top`).
 */
import { useEffect } from 'react';

let users = 0;
let raf = 0;
let last = -1;

function measure(): void {
  raf = 0;
  let line = 0;
  const bar = document.querySelector<HTMLElement>('.fd-topwrap');
  if (bar) line = Math.max(line, bar.getBoundingClientRect().bottom);
  for (const el of document.querySelectorAll<HTMLElement>('main [data-pinned-row]')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    const top = parseFloat(cs.top) || 0;
    if (r.height > 0 && r.top <= top + 1 && r.bottom > 0) line = Math.max(line, r.bottom);
  }
  const next = Math.max(0, Math.round(line));
  if (next !== last) {
    last = next;
    document.documentElement.style.setProperty('--sn-pin-top', `${next}px`);
  }
}

function soon(): void {
  if (!raf) raf = requestAnimationFrame(measure);
}

/** Start (or join) the page's one pin-line reader. Returns the leave function. */
export function joinPinLine(): () => void {
  users += 1;
  if (users === 1) {
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
  }
  soon();
  return () => {
    users -= 1;
    if (users > 0) return;
    document.removeEventListener('scroll', soon, { capture: true });
    window.removeEventListener('resize', soon);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}

/** Keep `--sn-pin-top` current while this component is mounted. */
export function usePinLine(on = true): void {
  useEffect(() => (on ? joinPinLine() : undefined), [on]);
}

/** The pin line now, in px — the value `--sn-pin-top` carries (0 before the first read). */
export function pinLineNow(): number {
  if (typeof document === 'undefined') return 0;
  return parseFloat(document.documentElement.style.getPropertyValue('--sn-pin-top')) || 0;
}
