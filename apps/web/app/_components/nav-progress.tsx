'use client';

/**
 * NavProgress — global top loading bar (owner directive 2026-06-04, "we want
 * it to be future proof").
 *
 * WHY a client bar and not a root app/loading.tsx: a root loading boundary
 * makes Next.js generate a static shell for every route at build time, which
 * runs the top-level DB fetches of the ~55 admin/dashboard pages that use the
 * service-role client without `force-dynamic` — and breaks the build. This bar
 * is pure client (mounted once in the root layout, mirroring GlobalHaptics),
 * so it has ZERO effect on static generation AND automatically covers every
 * route — including ones nobody has written yet. The per-route loading.tsx
 * skeletons (PR #892 + follow-ups) still give the rich shaped wait on the
 * important routes; this is the universal catch-all so no navigation ever
 * feels frozen.
 *
 * BEHAVIOUR
 *   - START on a navigation the user can perceive: a same-origin, path-changing
 *     <a> click (capture phase, before Next handles it) or a path-changing
 *     back/forward (popstate). Same-path hash/query changes and external /
 *     new-tab / download links are ignored — BY BOTH DOORS, through the one
 *     rule (`navStartsTheLine`, lib/nav-progress-rule.ts). Until 2026-10-11
 *     only the click asked it: Back between two tabs of one page (`?tab=`)
 *     started a line nothing could finish, and it crawled for the full ten
 *     seconds over a page that was already drawn.
 *   - THE LOAD RULES (motion standard 18 Nov 2026, § 4 #17 — `lib/load-rules.ts`, the one helper): the line
 *     WAITS 150 ms before it shows, so a navigation that resolves sooner shows NOTHING (no flash); once shown it
 *     STAYS at least 400 ms, so it never blinks. Neither rule holds the page back — the line is an overlay.
 *   - COMPLETE when usePathname() changes (the new route has rendered): a quick fill, then a quick fade (Quick
 *     200 ms · Settle). A 10s safety timer force-completes in case a navigation is aborted so the line can never
 *     get stuck.
 *   - TRANSFORM AND OPACITY ONLY: the line is a full-width strip scaled on X from its left edge. (Until 18 Nov it
 *     animated `width` — layout on every step.) Reduced motion: the global freeze makes each step a jump.
 *
 * Renders null on the server + first client paint (no hydration mismatch); all
 * listeners attach in useEffect. Colour follows the brand accent token
 * (--m-orange = Atelier kit gold-500) so it auto-tracks palette changes.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { navStartsTheLine } from '@/lib/nav-progress-rule';
import { createLoadGate, type LoadGate } from '@/lib/load-rules';
import { QUICK_MS } from '@/lib/motion-table';

/** Where the line starts, and where it crawls to while the page is still on its way (parts of the full width). */
const LINE_START = 0.08;
const LINE_CRAWL_TO = 0.9;

export function NavProgress() {
  const pathname = usePathname();
  // null = hidden; a number 0–1 = visible, scaled to that part of the width.
  const [scale, setScale] = useState<number | null>(null);
  // The pathname the page is showing — what a Back / Forward is measured from.
  const last = useRef(pathname);

  // Mutable timer/handles, kept in a ref so the start/finish helpers don't need to live in React state.
  const t = useRef<{
    gate?: LoadGate;
    trickle?: ReturnType<typeof setInterval>;
    fade?: ReturnType<typeof setTimeout>;
    max?: ReturnType<typeof setTimeout>;
  }>({});

  function clearAll() {
    const r = t.current;
    r.gate?.cancel();
    if (r.trickle) clearInterval(r.trickle);
    if (r.fade) clearTimeout(r.fade);
    if (r.max) clearTimeout(r.max);
    r.trickle = r.fade = r.max = undefined;
  }

  /** The one gate: it alone decides WHEN the line shows and hides (wait 150 · stay 400). */
  function gate(): LoadGate {
    const r = t.current;
    if (r.gate) return r.gate;
    r.gate = createLoadGate({
      show() {
        if (r.fade) clearTimeout(r.fade);
        r.fade = undefined;
        let w = LINE_START;
        setScale(w);
        // Crawl toward 90% — fast at first, easing as it approaches. One step per Quick, so each step's own
        // transition has landed before the next begins.
        r.trickle = setInterval(() => {
          w = Math.min(LINE_CRAWL_TO, w + Math.max(0.005, (LINE_CRAWL_TO - w) * 0.1));
          setScale(w);
        }, QUICK_MS);
      },
      hide() {
        if (r.trickle) clearInterval(r.trickle);
        r.trickle = undefined;
        // A quick fill, then a quick fade — then the line is gone.
        setScale(1);
        r.fade = setTimeout(() => setScale(null), QUICK_MS * 2);
      },
    });
    return r.gate;
  }

  function begin() {
    const r = t.current;
    if (r.max) clearTimeout(r.max);
    gate().start();
    // Safety: never let the line hang if a navigation is aborted.
    r.max = setTimeout(finish, 10_000);
  }

  function finish() {
    const r = t.current;
    if (r.max) clearTimeout(r.max);
    r.max = undefined;
    // Resolved before the line ever appeared → nothing shows. Shown → it stays out its 400 ms, then fills and fades.
    gate().finish();
  }

  // START triggers: link clicks + back/forward.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      const target = anchor.getAttribute('target');
      if (!href || (target && target !== '_self') || anchor.hasAttribute('download')) {
        return;
      }
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Only path-changing navigations — same-path hash/query changes resolve
      // without a usePathname() change, so they'd never "complete" the bar.
      if (!navStartsTheLine(window.location.pathname, url.pathname)) return;
      begin();
    }
    function onPopState() {
      // The address has already moved; the page still shows `last.current`.
      // Back between two tabs of one page changes no pathname — no line.
      if (!navStartsTheLine(last.current, window.location.pathname)) return;
      begin();
    }
    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
      window.removeEventListener('popstate', onPopState);
      clearAll();
    };
    // begin/clearAll only touch refs + setScale (all stable) — mount-once is
    // correct; the listeners must attach exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // COMPLETE trigger: the pathname changed → the new route has rendered.
  useEffect(() => {
    if (last.current !== pathname) {
      last.current = pathname;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (scale === null) return null;
  const done = scale >= 1;
  return (
    <div
      aria-hidden
      data-nav-progress=""
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        height: '2.5px',
        background: 'var(--m-orange)',
        boxShadow: '0 0 8px 0 var(--m-orange)',
        transformOrigin: '0 50%',
        transform: `scaleX(${scale})`,
        opacity: done ? 0 : 1,
        transition: done
          ? 'transform var(--sn-m-quick) var(--sn-m-settle), opacity var(--sn-m-quick) var(--sn-m-settle) var(--sn-m-quick)'
          : 'transform var(--sn-m-quick) var(--sn-m-settle)',
        pointerEvents: 'none',
      }}
    />
  );
}
