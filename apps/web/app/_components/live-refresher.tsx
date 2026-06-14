'use client';

import { useRouter } from 'next/navigation';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';

/**
 * Drop-in, render-nothing companion for any server-rendered surface that shows
 * live seat assignments (the guest "find my table" map, the coordinator's
 * check-in desk). During the wedding-day window it quietly calls
 * router.refresh() — re-running the server component so a reseat done in the
 * editor shows up without a manual reload. Silent by design (seat-finding PR 5):
 * no toast, no notification — see {@link useDayOfLiveTick}.
 *
 * Surfaces whose result lives in client state (the free /find-seat name search)
 * can't use this — they re-fire their own query via the same hook instead.
 */
export function LiveRefresher({
  eventDate,
  intervalMs,
}: {
  eventDate: string | Date | null | undefined;
  intervalMs?: number;
}) {
  const router = useRouter();
  useDayOfLiveTick(eventDate, () => router.refresh(), { intervalMs });
  return null;
}
