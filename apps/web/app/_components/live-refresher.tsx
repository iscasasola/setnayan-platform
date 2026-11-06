'use client';

import { useRouter } from 'next/navigation';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';
import { useEventPulse } from '@/lib/use-event-pulse';
import type { PulseBaseline } from '@/lib/event-pulse';

/**
 * Drop-in, render-nothing companion for any server-rendered surface that shows
 * live seat assignments (the guest "find my table" map, the coordinator's
 * check-in desk). During the wedding-day window it quietly calls
 * router.refresh() — re-running the server component so a reseat done in the
 * editor shows up without a manual reload. Silent by design (seat-finding PR 5):
 * no toast, no notification — see {@link useDayOfLiveTick}.
 *
 * 🧯 A GUEST PAGE RE-DRAWS ONLY WHEN SOMETHING CHANGED (2026-10-18, live-day
 * polling). A page that hands over `slug` + `pulse` (its baseline from
 * `pulseBaseline`, lib/event-pulse.server.ts) asks the event's small, shared
 * "has anything changed?" answer every ~12 s instead of re-rendering every 45 s
 * ({@link useEventPulse}) — a full render was ~30 database reads per phone per
 * tick, and the answer was "nothing" nearly every time. Without a baseline (the
 * host's check-in desk and souvenirs, or a pulse that could not be read) it
 * keeps the 45 s refresh exactly as before.
 *
 * Surfaces whose result lives in client state (the free /find-seat name search)
 * can't use this — they re-fire their own query via the same hooks instead.
 */
export function LiveRefresher({
  eventDate,
  intervalMs,
  slug,
  pulse,
}: {
  eventDate: string | Date | null | undefined;
  intervalMs?: number;
  slug?: string | null;
  pulse?: PulseBaseline | null;
}) {
  const router = useRouter();
  const pulsed = Boolean(slug && pulse);
  // one-render: keep (realtime) — the event pulse says something changed elsewhere; nothing was pressed here.
  useEventPulse(slug, eventDate, pulse, () => router.refresh());
  // one-render: keep (realtime) — the day-of cadence while no pulse is wired; nothing was pressed here.
  useDayOfLiveTick(pulsed ? null : eventDate, () => router.refresh(), { intervalMs });
  return null;
}
