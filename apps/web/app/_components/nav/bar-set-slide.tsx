'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { barSlideFor } from '@/lib/bar-set';

/**
 * BarSetSlide — the bottom bar's build-out / build-in when a press changes
 * WHICH bar a page carries: account ↔ shop ↔ an event (owner 22 Oct 2026,
 * `lib/bar-set.ts` has the verbatim and the direction map).
 *
 * ── EXTENDS THE SLIDE THAT SHIPPED, IT IS NOT A SECOND ONE ─────────────────────
 * `NavSlideController` (root layout) already slides the page on a tab press
 * inside ONE bar, and globals.css already lifts the dock into its own view-
 * transition group (`sn-bottomnav`) so it is never painted under the sliding
 * page (2026-09-22, "i want the bottom and top nav to persist"). That
 * controller only reads the bar's own tabs, so a press that LEAVES the bar's
 * set — the account bar's Shop tab, an event card on the board, the event's way
 * back to Events — fell through to a plain navigation: the old bar was gone and
 * the new one drawn, with nothing between. Here the same View Transition runs
 * for those presses, and `html[data-sn-bar-dir]` tells the stylesheet to slide
 * the DOCK too (its old icons out one way, the new set's in from the other) and
 * the page with it — "everything moves to the left". The top bar stays in the
 * frozen `root` snapshot, so it holds still.
 *
 * ── WHERE IT LOADS ─────────────────────────────────────────────────────────────
 * Fetched by <BottomDock> after it mounts (a plain `import()`, the pattern the
 * event bar's More sheet uses — `next/dynamic`'s loadable runtime once put the
 * Maker over its ceiling), so it is in no page's first load and only on pages
 * that draw a bar. Listens on `window`, capture phase, so it runs BEFORE the
 * controller's `document` listener and its `preventDefault` makes that one
 * stand down for the same press (it checks `defaultPrevented` first).
 *
 * ── NO SLIDE, PLAIN LINK ───────────────────────────────────────────────────────
 * Reduced motion, no View Transitions, no bar on screen (desktop), a modified
 * click, another tab/origin, or a press within one set — nothing is prevented
 * and the link navigates as it always did (`barSlideFor`).
 */

type VTDocument = Document & {
  startViewTransition?: (cb: () => unknown) => { finished: Promise<unknown> };
};

/* Module-level, not component state: the dock that started the slide belongs to
   the layout being LEFT, so it unmounts mid-transition. */
let token = 0;

export function BarSetSlide() {
  const router = useRouter();
  useEffect(() => {
    const doc = document as VTDocument;
    const root = doc.documentElement;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      const dock = doc.querySelector('[data-bottom-dock]');
      const dir = barSlideFor({
        fromPath: location.pathname,
        toPath: url.pathname,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        supported: typeof doc.startViewTransition === 'function',
        dockShown: !!dock && getComputedStyle(dock).display !== 'none',
        tabletUp: matchMedia('(min-width: 701px)').matches,
      });
      if (!dir) return;
      e.preventDefault();

      const mine = ++token;
      root.dataset.snNavDir = dir;
      root.dataset.snBarDir = dir;
      const dest = url.pathname + url.search + url.hash;
      const vt = doc.startViewTransition!(() => {
        router.push(dest);
        // Hold the old frame until the new route has committed (its address is
        // in the bar) — never longer than ~600 ms, the controller's own valve.
        return new Promise<void>((done) => {
          const t0 = Date.now();
          const wait = () =>
            location.pathname === url.pathname || Date.now() - t0 > 600 ? done() : setTimeout(wait, 16);
          wait();
        });
      });
      vt.finished.finally(() => {
        if (token !== mine) return;
        delete root.dataset.snNavDir;
        delete root.dataset.snBarDir;
      });
    }
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [router]);
  return null;
}
