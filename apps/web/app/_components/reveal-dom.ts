'use client';

/**
 * 🔭 REVEAL ON OPEN — THE DOM SIDE (owner 2026-11-04, app-wide). The rule is `reveal-engine.ts`; this hands it the page.
 * ⚡ Loaded on the FIRST open a user makes (`reveal-on-open.ts` import()s it), never in a page's first load — the hook
 * every fold mounts carries only the press and the lazy call.
 *
 * THE PIN LINE: in the page, `--sn-pin-top` (`pinned-row/pin-line.ts`, joined while it runs so the number is fresh);
 * inside a box that scrolls on its own (a sheet, a panel), that box's top. Plus one slim line (`FOLD_SLIM_PX`) per OPEN
 * fold around the section — their heads pin slim there, so this head lands flush under them, never behind them.
 * THE VISIBLE BOTTOM: the box's bottom; in the page, what can be seen (`visibleBottom()` — the keyboard's top while it
 * is up, `lib/keyboard-ride.ts`) less the bottom dock (`--sn-bottomdock-h`).
 */
import { joinPinLine } from '@/app/_components/pinned-row/pin-line';
import { visibleBottom } from '@/lib/keyboard-ride';
import { revealAfterSettle } from './reveal-engine';

/** One slim pinned head (`fold.tsx` FOLD_SLIM_PX) — kept here as a number so this file does not import the fold. */
const SLIM_PX = 40;

/** The box this element scrolls in: the nearest ancestor that scrolls on its own, or null for the page. */
export function scrollBoxOf(el: Element): HTMLElement | null {
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
  return p && p !== document.body && p !== document.documentElement ? p : null;
}

const px = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/** Glide `head`…`end` into view, under the pin line, once it settles. Returns cancel. */
export function revealSection(head: Element, end: Element = head, opts: { minWaitMs?: number } = {}): () => void {
  const box = scrollBoxOf(head);
  let depth = 0;
  for (let p = head.parentElement; p && p !== box; p = p.parentElement) if (p.hasAttribute('data-fold-open')) depth += 1;
  const leave = box ? null : joinPinLine();
  const cancel = revealAfterSettle(
    {
      now: () => performance.now(),
      frame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
      section: () => ({ top: head.getBoundingClientRect().top, bottom: end.getBoundingClientRect().bottom }),
      view: () => {
        if (box) {
          const r = box.getBoundingClientRect();
          return { top: r.top + box.clientTop + depth * SLIM_PX, bottom: r.top + box.clientTop + box.clientHeight };
        }
        return { top: px('--sn-pin-top') + depth * SLIM_PX, bottom: visibleBottom() - px('--sn-bottomdock-h') };
      },
      getScroll: () => (box ? box.scrollTop : window.scrollY),
      setScroll: (y) => (box ?? window).scrollTo({ top: y, behavior: 'instant' }),
      reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      onInput: (cb) => {
        const kinds = ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const;
        for (const k of kinds) window.addEventListener(k, cb, { capture: true, passive: true });
        return () => {
          for (const k of kinds) window.removeEventListener(k, cb, { capture: true });
        };
      },
    },
    opts,
  );
  return () => {
    cancel();
    leave?.();
  };
}
