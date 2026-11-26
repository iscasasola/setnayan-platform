import type { EventClock } from '@/lib/event-clock';

/**
 * Is "Close out the day" open yet? (A2-P8, final check 25 Nov 2026.) The close-out is irreversible — it flips the
 * dashboard Day-of → After — so it is offered only once The Day has OPENED at the venue (the one clock's own instant,
 * never the phone's midnight). An event with no date has no day to wait for, so it stays open as before. The page
 * hides the button before then and the action refuses, so a stale tab cannot do it either.
 */
export function closeOutOpen(clock: Pick<EventClock, 'nowMs' | 'opensMs'>): boolean {
  return Number.isNaN(clock.opensMs) || clock.nowMs >= clock.opensMs;
}
