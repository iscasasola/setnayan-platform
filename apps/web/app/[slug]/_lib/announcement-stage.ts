import { announcementStage, type AnnouncementStage } from '@/lib/coordinator-broadcasts';
import { eventClockNow } from '@/lib/event-clock.server';

/**
 * Which look the announcement wears now — 'before' (over the Invitation) · 'live' (over The Day) · 'after' (gone):
 * THE ONE CLOCK (owner ruling, 10 Nov 2026). One rule for the layout that mounts the card and the route that answers
 * it, so the two cannot disagree about whether an announcement still shows.
 *
 * ⚠ "Over" used to be the board's own definition (`isFinishedEvent`: the last day before TODAY at the venue — so it
 * flipped at MIDNIGHT) while "live" ran to noon the next day; between the two the card was 'live' AND the event was
 * over. Both now come from the same two instants: The Day is open → 'live'; it has closed → 'after'.
 */
export function announcementStageOf(event: {
  event_date: string | null;
  event_end_date?: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
}): AnnouncementStage {
  const clock = eventClockNow(event);
  const ended = Number.isFinite(clock.closesMs) && clock.nowMs >= clock.closesMs;
  return announcementStage(clock.day, ended);
}
