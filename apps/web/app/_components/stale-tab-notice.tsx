'use client';

/**
 * stale-tab-notice.tsx — the bar that says your tab is older than the site.
 *
 * The whole reasoning lives in `lib/build-version.ts`, including why this is a
 * mitigation rather than the cure. In short: we deploy every 15–25 minutes, and
 * a tab open across a deploy can break in a way that throws NOTHING — the guest
 * list went blank on the owner on 2026-09-20 with no exception, so no error
 * boundary and no stale-bundle reload. This gives that silence a voice.
 *
 * ── WHEN IT CHECKS ─────────────────────────────────────────────────────────
 * On the tab becoming visible again, and on window focus. NOT on an interval:
 * a poll burns a function invocation per tab per tick forever, and the moment
 * that matters is exactly when someone comes BACK to a tab they left open —
 * which is the event we already get for free.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 * 🔑 IT NEVER RELOADS BY ITSELF. A couple may be halfway through a guest's
 * name, a supplier halfway through a quote; throwing that away to fix a
 * cosmetic staleness would be a worse bug than the one being fixed. The reload
 * is a button. `lib/stale-bundle.ts` still auto-reloads its own case, because
 * there the page is ALREADY broken and there is nothing left to lose.
 *
 * It also never retries a failed check. If `/api/health` does not answer, that
 * is a network problem, not a version problem, and inventing a version bar out
 * of a failed fetch would be the same class of lie as rendering an empty list
 * for a refused read.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LOADED_BUILD_VERSION,
  servingVersionFrom,
  shouldOfferReload,
} from '@/lib/build-version';

export function StaleTabNotice() {
  const [stale, setStale] = useState(false);
  // Once dismissed, stay quiet for THIS version. A new deploy after the
  // dismissal is a new fact and may speak again.
  const dismissedFor = useRef<string | null>(null);

  const check = useCallback(async () => {
    if (!LOADED_BUILD_VERSION) return; // nothing to compare — see build-version.ts
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const serving = servingVersionFrom(await res.json());
      if (!serving) return;
      if (dismissedFor.current === serving) return;
      setStale(shouldOfferReload(LOADED_BUILD_VERSION, serving));
    } catch {
      // A failed check is a network fact, not a version fact. Say nothing.
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    // One check on mount covers a tab restored by the browser at start-up,
    // which fires neither event.
    void check();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  /*
    🔑 THE BAR MUST NOT HIDE THE PAGE'S LAST LINE. Owner 2026-09-21: "i cannot
    see the bottom of the guest list." It is `fixed` over the bottom of the
    screen, so without room reserved the last thing on ANY page — the final
    guest row — sat underneath it and could not be scrolled clear. While it
    shows, the body's bottom padding grows by the bar's height (measured, so a
    wrapped two-line bar on a phone reserves two lines), and is put back exactly
    as it was when the bar goes.
  */
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!stale || !el) return;
    const body = document.body;
    const before = body.style.paddingBottom;
    const base = parseFloat(getComputedStyle(body).paddingBottom) || 0;
    const reserve = () => {
      body.style.paddingBottom = `${base + el.getBoundingClientRect().height}px`;
    };
    reserve();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserve);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      body.style.paddingBottom = before;
    };
  }, [stale]);

  if (!stale) return null;

  return (
    <div
      ref={bar}
      data-app-chrome=""
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-ink/10 bg-cream/95 px-4 py-2.5 text-center text-sm text-ink/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <span>Setnayan was updated while this page was open.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-sm bg-mulberry px-3 py-1 text-xs font-medium tracking-wide text-cream transition-colors hover:bg-mulberry-600"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => {
          // Remember WHICH version was waved away, not merely "dismissed" —
          // otherwise the next deploy is silenced too.
          void fetch('/api/health', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((p) => {
              dismissedFor.current = servingVersionFrom(p);
            })
            .catch(() => {
              dismissedFor.current = null;
            });
          setStale(false);
        }}
        className="text-xs text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
      >
        Not now
      </button>
    </div>
  );
}
