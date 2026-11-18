'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePrefersReducedMotion, useIsMobile } from '@/lib/use-responsive';
import { activeTabIndex, pushDir, tabSlideDir } from '@/lib/nav-slide';
import { MOVE_MS } from '@/lib/motion-table';

/**
 * NavSlideController — the mobile bottom-nav "carousel" page slide (owner 2026-06-21).
 *
 * Tapping a tab to the RIGHT in the pill's order → the current page slides OUT to
 * the left and the new page slides IN from the right; tapping LEFT → the reverse.
 * It's a SINGLE slide regardless of how many tabs are skipped (Home→Explore slides
 * the same way as Home→Guests) because direction is the SIGN of the index delta,
 * never the count.
 *
 * HOW (no fork of the lint-locked BottomNav): one global capture-phase click
 * listener (same pattern as nav-progress.tsx) scoped to the locked nav's existing
 * `aria-label="Primary navigation"` marker. It reads the clicked <a href> + the
 * live DOM tab order (so it's automatically phase-aware / role-scoped / registry-
 * override-aware — no hardcoded tab list), derives the direction, and drives the
 * navigation inside `document.startViewTransition`. `bottom-nav.tsx` is untouched;
 * the only paired change is `view-transition-name: sn-page` on the content
 * element each signed-in tree renders — `.sn-vt-page`, carried by the layout's
 * own `<main>` in the event, vendor, launcher and account trees, by Discover's
 * `[data-fd-page]`, and by a wrapper `<div>` in the admin one — so ONLY the
 * content slides; the bar and the FAB carry names of their own and hold still,
 * the rail and the top bar live in `root`, which the CSS freezes.
 *
 * ── ONE SLIDE ON ALL THREE DASHBOARDS (owner 2026-10-24) ──────────────────
 * *"The transition animation between menus found in event dashboard does not
 * apply to the user and shop dashboard."* Same listener, same direction rule
 * (`lib/nav-slide.ts`), same keyframes, same 320 ms. The account trees' content
 * is marked `data-sn-slide="while-sliding"`: named only while a slide runs, so
 * at rest those pages keep no stacking context and no containing block for
 * their `position: fixed` sheets, exactly as before. Held by
 * `one-tab-slide-everywhere.test.ts`.
 *
 * ⚠ IT USED TO LIVE IN `sidebar-shell.tsx`, WHICH IS DELETED (2026-08-15).
 * Exactly one element in the whole app may carry that name: zero leaves this
 * controller starting a transition that animates NOTHING, and two make the
 * browser skip the transition outright. Both are silent.
 *
 * Progressive enhancement — the slide runs ONLY when ALL hold: mobile viewport
 * (<lg), motion allowed, View Transitions supported (iOS Safari 18.2+ / Chrome
 * 111+), it's a real top-level-tab change (not a sub-page or the same tab), and
 * the broken-out FAB / sidebar links are excluded (they're outside the nav). Any
 * miss → we never preventDefault, so the native <Link> navigates instantly. No
 * error on older browsers, reduced-motion, or desktop.
 *
 * ── → PUSH: A PAGE DEEPER IN ITS SECTION, AND ITS BACK (motion standard 18 Nov 2026, § 5 #30) ──
 * The same listener also NOTES — it never stops or redirects — a tap on a link that goes deeper into the section you
 * are in (or back up out of it), and the phone's / browser's Back: it writes `html[data-sn-push="fwd" | "back"]`
 * (`pushDir`, lib/nav-slide.ts) and the four shell templates' `.sn-page-enter` then arrives from the right, or from
 * the left for a Back, instead of the plain Enter (globals.css). The mark is cleared once the page has landed. Nothing
 * is intercepted: a link whose own handler cancels the navigation, or that opens a risen page over this one, simply
 * leaves a mark nobody reads. Every width; never under reduced motion (the page then keeps its 120 ms fade / freeze).
 * 🔒 app/_components/nav/the-screens-move-by-the-standard.test.ts
 */

type VTDocument = Document & {
  startViewTransition?: (cb: () => unknown) => { finished: Promise<unknown> };
};

const NAV_SEL = 'nav[aria-label="Primary navigation"]';
/** After the page lands, the mark stays for the Push's own length plus this, then goes. */
const PUSH_SETTLE_MS = 80;
/** A mark nobody answered (the tap did not navigate) is dropped after this long. */
const PUSH_STALE_MS = 4000;

export function NavSlideController() {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  // Lets the in-flight transition proceed once the destination route has rendered.
  const pending = useRef<{ path: string; resolve: () => void } | null>(null);
  const token = useRef(0);

  // When the route we're sliding to has committed, resolve the held transition.
  useEffect(() => {
    if (pending.current && pathname === pending.current.path) {
      pending.current.resolve();
      pending.current = null;
    }
  }, [pathname]);

  // → PUSH — note which way the next page arrives; clear the note once it has landed.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    lastPath.current = pathname;
    const root = document.documentElement;
    if (!root.dataset.snPush) return;
    const t = window.setTimeout(() => delete root.dataset.snPush, MOVE_MS + PUSH_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);
  useEffect(() => {
    if (reduced) return;
    const root = document.documentElement;
    let stale = 0;
    const mark = (dir: 'fwd' | 'back' | null) => {
      window.clearTimeout(stale);
      if (!dir) {
        delete root.dataset.snPush;
        return;
      }
      root.dataset.snPush = dir;
      // A tap that never navigated (its own handler said no) must not colour a later, unrelated arrival.
      stale = window.setTimeout(() => delete root.dataset.snPush, PUSH_STALE_MS);
    };
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      // A tab press is the Slide's, not a Push.
      if (anchor.closest(NAV_SEL)) return mark(null);
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      mark(pushDir(location.pathname, url.pathname));
    }
    // The phone's Back (and Forward): the address has already moved; `lastPath` is still the page being left.
    const onPop = () => mark(lastPath.current ? pushDir(lastPath.current, location.pathname) : null);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(stale);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      delete root.dataset.snPush;
    };
  }, [reduced]);

  useEffect(() => {
    const doc = document as VTDocument;
    const supported = typeof document !== 'undefined' && typeof doc.startViewTransition === 'function';

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      // mobile-only · motion allowed · VT supported — else let <Link> navigate instantly.
      if (!isMobile || reduced || !supported) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      // Scope to the locked bottom-nav pill — excludes the desktop sidebar, the
      // broken-out FAB (a sibling outside the nav) and any in-page link.
      const nav = anchor.closest(NAV_SEL);
      if (!nav) return;

      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return;

      const tabs = Array.from(nav.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      // The lit tab is the BAR's own answer (`aria-current`), so a shop page lit
      // through a tab's `activeMatch` list slides too (lib/nav-slide.ts).
      const activeIdx = activeTabIndex(
        tabs.map((a) => {
          let path = '';
          try {
            path = new URL(a.href).pathname;
          } catch {
            /* an unreadable tab can still be the lit one */
          }
          return { path, current: a.getAttribute('aria-current') === 'page' };
        }),
        location.pathname,
      );
      // No slide for: re-tap of the active tab, a sub-page that maps to the same
      // tab, or an unresolvable active tab (avoid sliding the wrong direction).
      const dir = tabSlideDir(tabs.indexOf(anchor), activeIdx);
      if (!dir) return;
      e.preventDefault();

      const myToken = ++token.current;
      document.documentElement.dataset.snNavDir = dir;

      const dest = url.pathname + url.search;
      const navDone = new Promise<void>((resolve) => {
        pending.current = { path: url.pathname, resolve };
        // Safety valve: never hold the frozen old frame longer than ~600ms (slow
        // route / redirect) — slide with whatever rendered.
        window.setTimeout(() => {
          if (pending.current && pending.current.resolve === resolve) {
            pending.current = null;
            resolve();
          }
        }, 600);
      });

      const vt = doc.startViewTransition!(() => {
        router.push(dest);
        return navDone;
      });
      vt.finished.finally(() => {
        // Clear only if no newer slide superseded us (fast double-taps).
        if (token.current === myToken) delete document.documentElement.dataset.snNavDir;
      });
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [router, reduced, isMobile]);

  // 🖼 PICTURE LEADS, card → its page (motion standard 18 Nov 2026, § 5 #33): a link marked `data-picture-leads` whose
  // photo (`[data-picture]`, else its first image) becomes the next page's picture (`[data-picture-hero]`) — a
  // same-document View Transition with ONE shared name, `sn-picture`, worn only while it runs. Opt-in per link, so
  // nothing else is ever intercepted; every width; no support or reduced motion → the link simply navigates.
  useEffect(() => {
    const doc = document as VTDocument;
    if (reduced || typeof doc.startViewTransition !== 'function') return;
    function onPicture(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href][data-picture-leads]') as HTMLAnchorElement | null;
      const photo = anchor?.querySelector<HTMLElement>('[data-picture], img') ?? null;
      if (!anchor || !photo) return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();

      const myToken = ++token.current;
      const root = document.documentElement;
      root.dataset.snNavDir = 'picture';
      photo.style.setProperty('view-transition-name', 'sn-picture');
      const navDone = new Promise<void>((resolve) => {
        pending.current = { path: url.pathname, resolve };
        window.setTimeout(() => {
          if (pending.current && pending.current.resolve === resolve) {
            pending.current = null;
            resolve();
          }
        }, 600);
      });
      const vt = doc.startViewTransition!(() => {
        router.push(url.pathname + url.search);
        return navDone;
      });
      vt.finished.finally(() => {
        photo.style.removeProperty('view-transition-name');
        if (token.current === myToken) delete root.dataset.snNavDir;
      });
    }
    document.addEventListener('click', onPicture, true);
    return () => document.removeEventListener('click', onPicture, true);
  }, [router, reduced]);

  return null;
}
