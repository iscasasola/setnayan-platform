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
 *     <a> click (capture phase, before Next handles it) or a back/forward
 *     (popstate). Same-path hash/query changes and external / new-tab / download
 *     links are ignored.
 *   - DEBOUNCED ~120ms: the bar only appears if the navigation actually takes a
 *     moment. With the staleTimes Router-Cache window, many revisits resolve
 *     in <120ms — those show NOTHING (no flash), which is the point.
 *   - COMPLETE when usePathname() changes (the new route has rendered): the bar
 *     snaps to 100% and fades out. A 10s safety timer force-completes in case a
 *     navigation is aborted so the bar can never get stuck.
 *
 * Renders null on the server + first client paint (no hydration mismatch); all
 * listeners attach in useEffect. Colour follows the brand accent token
 * (--m-orange = Royal Champagne Gold) so it auto-tracks palette changes.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavProgress() {
  const pathname = usePathname();
  // null = hidden; a number 0-100 = visible at that width %.
  const [width, setWidth] = useState<number | null>(null);

  // Mutable timer/handles + a "did the bar actually show" flag, kept in a ref
  // so the start/finish helpers don't need to live in React state.
  const t = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    trickle?: ReturnType<typeof setInterval>;
    fade?: ReturnType<typeof setTimeout>;
    max?: ReturnType<typeof setTimeout>;
    shown: boolean;
  }>({ shown: false });

  function clearAll() {
    const r = t.current;
    if (r.delay) clearTimeout(r.delay);
    if (r.trickle) clearInterval(r.trickle);
    if (r.fade) clearTimeout(r.fade);
    if (r.max) clearTimeout(r.max);
    r.delay = r.trickle = r.fade = r.max = undefined;
  }

  function begin() {
    clearAll();
    t.current.shown = false;
    // Debounce: only reveal the bar if the nav is still in flight after 120ms.
    t.current.delay = setTimeout(() => {
      t.current.shown = true;
      let w = 8;
      setWidth(w);
      // Trickle toward 90% — fast at first, easing as it approaches.
      t.current.trickle = setInterval(() => {
        w = Math.min(90, w + Math.max(0.5, (90 - w) * 0.1));
        setWidth(w);
      }, 180);
      // Safety: never let the bar hang if a navigation is aborted.
      t.current.max = setTimeout(finish, 10_000);
    }, 120);
  }

  function finish() {
    const r = t.current;
    if (r.delay) clearTimeout(r.delay);
    if (r.trickle) clearInterval(r.trickle);
    if (r.max) clearTimeout(r.max);
    r.delay = r.trickle = r.max = undefined;
    if (!r.shown) {
      // Navigation resolved before the bar ever appeared — show nothing.
      setWidth(null);
      return;
    }
    setWidth(100);
    r.fade = setTimeout(() => {
      setWidth(null);
      t.current.shown = false;
    }, 280);
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
      if (url.pathname === window.location.pathname) return;
      begin();
    }
    function onPopState() {
      begin();
    }
    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
      window.removeEventListener('popstate', onPopState);
      clearAll();
    };
    // begin/clearAll only touch refs + setWidth (all stable) — mount-once is
    // correct; the listeners must attach exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // COMPLETE trigger: the pathname changed → the new route has rendered.
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current !== pathname) {
      last.current = pathname;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (width === null) return null;
  const done = width >= 100;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000,
        height: '2.5px',
        width: `${width}%`,
        background: 'var(--m-orange, #C5A059)',
        boxShadow: '0 0 8px 0 var(--m-orange, #C5A059)',
        borderRadius: '0 2px 2px 0',
        opacity: done ? 0 : 1,
        transition: done
          ? 'width 180ms ease, opacity 260ms ease 100ms'
          : 'width 180ms ease',
        pointerEvents: 'none',
      }}
    />
  );
}
