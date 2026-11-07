'use client';

import { useCallback, useEffect, useState } from 'react';
import { LOADED_BUILD_VERSION, servingVersionFrom, shouldOfferReload } from '@/lib/build-version';

/**
 * 🔄 "PAGE LEFT OPEN ACROSS A DEPLOY" (owner 2026-11-06, the sign-up redesign, step 4 · stale).
 *
 * A sign-up tab left open over a deploy posts its form to a server action the new build no longer has — the press
 * does nothing, or fails, and the supplier thinks the shop would not open. The site-wide `StaleTabNotice` bar says
 * so at the bottom of the screen; on THIS page the owner wants the answer on the button itself: the primary action
 * becomes "Tap Reload to keep going", and the draft is parked first so the reload loses nothing.
 *
 * The check is the SAME one the bar runs (`/api/health` → `servingVersionFrom` → `shouldOfferReload`), on the same
 * triggers (mount, focus, the tab becoming visible) — never an interval. A failed check says nothing: a network
 * fact is not a version fact.
 */
export function useStaleBuild(): boolean {
  const [stale, setStale] = useState(false);

  const check = useCallback(async () => {
    if (!LOADED_BUILD_VERSION) return; // nothing to compare — see build-version.ts
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const serving = servingVersionFrom(await res.json());
      if (!serving) return;
      setStale(shouldOfferReload(LOADED_BUILD_VERSION, serving));
    } catch {
      // Say nothing.
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void check();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  return stale;
}
