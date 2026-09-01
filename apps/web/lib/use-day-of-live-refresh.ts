'use client';

import { useEffect, useRef } from 'react';
import { isEventDayActive } from '@/lib/day-of-mode';

/**
 * THE TICK MACHINERY, on its own.
 *
 * Fires `onTick` on a gentle interval, on tab-focus and on visibility-regain —
 * but only while `shouldFire()` says the surface has something worth re-reading,
 * and only while the tab is actually visible. A hidden tab costs nothing.
 *
 * ⚠ `shouldFire` IS A PREDICATE, NOT A BOOLEAN, and that is load-bearing. It is
 * re-evaluated at every tick, so a gate that becomes true while the page is
 * already open starts firing — a page left open across the T-12h day-of boundary
 * would never begin ticking if the gate were captured once at render.
 *
 * Extracted from {@link useDayOfLiveTick}, which now delegates to it, because the
 * Panood control room needs the same visible/focus behaviour behind a DIFFERENT
 * gate (see lib/live-studio-channel-freshness.ts). Writing a second copy of the
 * listener bookkeeping is how two surfaces quietly stop agreeing about when they
 * refresh.
 */
export function useVisibleTick(
  shouldFire: () => boolean,
  onTick: () => void,
  { intervalMs, enabled = true }: { intervalMs: number; enabled?: boolean },
): void {
  // Keep the latest callbacks without re-subscribing the listeners every render.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const shouldFireRef = useRef(shouldFire);
  shouldFireRef.current = shouldFire;

  useEffect(() => {
    // `enabled` is the STATIC question — "can this surface ever tick?" — and it
    // gates the listeners themselves, so an inert surface installs no interval at
    // all. `shouldFire` is the DYNAMIC one, re-asked at each tick. Collapsing the
    // two would either leave a no-op timer running forever or freeze a gate that
    // has to be able to turn on mid-session.
    if (!enabled) return;

    const fire = () => {
      if (!shouldFireRef.current()) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      onTickRef.current();
    };

    const id = setInterval(fire, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    window.addEventListener('focus', fire);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener('focus', fire);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}

/**
 * Silent day-of "live propagation" tick (seat-finding PR 5).
 *
 * Fires `onTick` while the wedding day is active (see {@link isEventDayActive})
 * AND the tab is visible — on a gentle interval, on tab-focus, and on
 * visibility-regain. This is the "live propagation" the seat plan promises: a
 * guest's finder / a coordinator's check-in board reflects a live reseat
 * WITHOUT a manual reload.
 *
 * Deliberately a PULL, never a push: no notification, no email, no realtime
 * channel — it just re-reads current truth on a quiet cadence, honoring the
 * owner's "silent-only updates · reflect current truth only when next viewed"
 * lock (no push/email infra for reseating). Outside the wedding-day window it
 * is inert (the interval no-ops), so it never polls during normal planning.
 *
 * @param eventDate  the event's date (string 'YYYY-MM-DD' or Date); null/undefined → inert
 * @param onTick     called when a refresh is due (e.g. router.refresh() or re-run the last query)
 * @param intervalMs background cadence while active + visible (default 45s)
 */
export function useDayOfLiveTick(
  eventDate: string | Date | null | undefined,
  onTick: () => void,
  { intervalMs = 45_000 }: { intervalMs?: number } = {},
): void {
  // Byte-identical to what this hook did before the extraction: a missing date
  // installs NO listeners (`enabled`), and the day-of window is re-checked at
  // every tick rather than captured at render (`shouldFire`).
  useVisibleTick(() => isEventDayActive(eventDate!), onTick, {
    intervalMs,
    enabled: Boolean(eventDate),
  });
}
