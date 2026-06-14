'use client';

import { useEffect, useRef } from 'react';
import { isEventDayActive } from '@/lib/day-of-mode';

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
  // Keep the latest onTick without re-subscribing the listeners every render.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!eventDate) return;

    const fire = () => {
      if (!isEventDayActive(eventDate)) return;
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
  }, [eventDate, intervalMs]);
}
