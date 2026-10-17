'use client';

import { useEffect, useRef } from 'react';
import { isEventDayActive } from '@/lib/day-of-mode';
import { herdDelay, jittered } from '@/lib/live-day-timing';
import {
  PULSE_AWAY_MS,
  PULSE_MISSES_BEFORE_REFRESH,
  PULSE_POLL_MS,
  PULSE_REFRESH_SPREAD_MS,
  pulseSaysRefresh,
  type PulseAnswer,
  type PulseBaseline,
} from '@/lib/event-pulse';

/**
 * useEventPulse — on the day, re-draw the page only when something it shows has changed (2026-10-18, live-day polling).
 *
 * Replaces the 45 s `router.refresh()` of `useDayOfLiveTick` on the guests' day-of pages, where every tick was a full
 * server render (~32 database reads) on every open phone. Now a visible phone asks `/[slug]/live-pulse` every
 * `PULSE_POLL_MS` (± 20 %) — an answer remembered per EVENT at the server, so the database does not see the phone at
 * all — and calls `onChange` only when the answer says the page on screen is out of date (`pulseSaysRefresh`), after a
 * random moment (`PULSE_REFRESH_SPREAD_MS`) so a venue's phones do not re-render in the same instant.
 *
 *   · Same gate as before: only while the event day is active (`isEventDayActive`, re-asked at every tick, so a page
 *     left open across the boundary starts), and only while the tab is visible — a pocketed phone asks nothing.
 *   · Back after more than `PULSE_AWAY_MS` hidden → one re-draw (a per-guest change may have left the answer's window);
 *     back sooner → it asks at once.
 *   · `PULSE_MISSES_BEFORE_REFRESH` unanswered asks in a row → one full re-draw, the old behaviour. A broken pulse must
 *     never freeze a page: the full render then says whatever is true, including the guest boundary's "didn't load".
 *
 * `baseline` null → the hook is inert, and the caller keeps `useDayOfLiveTick` (see `LiveRefresher`, `HubShell`).
 */
export function useEventPulse(
  slug: string | null | undefined,
  eventDate: string | Date | null | undefined,
  baseline: PulseBaseline | null | undefined,
  onChange: () => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  // What has already been acted on — kept for the life of the page, NOT reset when a re-render brings a new baseline:
  // a render drawn from a remembered answer a few seconds older must not trigger the same re-draw again.
  const actedOn = useRef<Set<string>>(new Set());
  const enabled = Boolean(slug && eventDate && baseline);

  useEffect(() => {
    if (!enabled || !slug || !eventDate) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let misses = 0;
    let hiddenAt: number | null = null;
    let alive = true;

    const redraw = (because: string | null) => {
      if (because) actedOn.current.add(because);
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (alive) onChangeRef.current();
      }, herdDelay(PULSE_REFRESH_SPREAD_MS));
    };

    const ask = async () => {
      if (!isEventDayActive(eventDate) || document.visibilityState !== 'visible') return;
      const base = baselineRef.current;
      if (!base) return;
      try {
        const res = await fetch(`/${encodeURIComponent(slug)}/live-pulse`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const answer = (await res.json()) as PulseAnswer;
        if (typeof answer?.v !== 'string') throw new Error('no stamp');
        misses = 0;
        const verdict = pulseSaysRefresh(base, answer, actedOn.current);
        if (verdict.refresh) redraw(verdict.because);
      } catch {
        misses += 1;
        if (misses >= PULSE_MISSES_BEFORE_REFRESH) {
          misses = 0;
          redraw(null);
        }
      }
    };

    const schedule = () => {
      timer = setTimeout(() => {
        timer = null;
        void ask().finally(() => {
          if (alive) schedule();
        });
      }, jittered(PULSE_POLL_MS));
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away > PULSE_AWAY_MS && isEventDayActive(eventDate)) redraw(null);
      else void ask();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, slug, eventDate]);
}
