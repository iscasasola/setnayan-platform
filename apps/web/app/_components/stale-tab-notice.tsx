'use client';

/**
 * stale-tab-notice.tsx — the live notice that says your tab is older than the site (inventory #46).
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

import { useCallback, useEffect, useState } from 'react';
import { LazyInlineNotice } from './notices/inline-notice-lazy';
import {
  LOADED_BUILD_VERSION,
  servingVersionFrom,
  shouldOfferReload,
} from '@/lib/build-version';

export function StaleTabNotice() {
  const [stale, setStale] = useState(false);
  const [servingVersion, setServingVersion] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!LOADED_BUILD_VERSION) return; // nothing to compare — see build-version.ts
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const serving = servingVersionFrom(await res.json());
      if (!serving) return;
      setServingVersion(serving);
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

  // 🔔 Inventory #46 — a LIVE notice (info) in the one notice system (owner approved 14 Nov 2026): "Reload · Hide", at the
  // very top, never fixed over the page, never reloads by itself. "Hide" is kept by the one notice memory against the
  // SERVING version, so the next deploy is a new fact and speaks again. (The fixed bottom bar and its body-padding
  // reserve went with it: "No bar fixed to the screen.")
  if (!stale || !servingVersion) return null;
  return (
    <div data-app-chrome="" role="status" aria-live="polite" className="px-4">
      <LazyInlineNotice
        kind="live"
        tone="info"
        noticeKey={`app-updated:${servingVersion}`}
        title="Setnayan was updated while this page was open"
        actions={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-mulberry px-4 text-sm font-semibold text-cream"
          >
            Reload
          </button>
        }
        onClose={() => setStale(false)}
      />
    </div>
  );
}
