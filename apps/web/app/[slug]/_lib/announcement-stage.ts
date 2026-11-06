import { announcementStage, type AnnouncementStage } from '@/lib/coordinator-broadcasts';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { calendarDayInZone, getDayOfPhase } from '@/lib/day-of-mode';
import { isFinishedEvent } from '@/lib/event-board';

/**
 * Which look the announcement wears now — 'before' (over the Invitation) · 'live' (over The Day) · 'after' (gone):
 * the VENUE's clock and the board's own "is it over" (`isFinishedEvent`). One rule for the layout that mounts the card
 * and the route that answers it, so the two cannot disagree about whether an announcement still shows.
 */
export function announcementStageOf(event: {
  event_date: string | null;
  event_end_date?: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
}): AnnouncementStage {
  const venueTz = eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude);
  const phase = event.event_date ? getDayOfPhase(event.event_date, venueTz) : 'inactive';
  // "Over" is the board's own definition (last day passed, venue calendar) — never a second one. The shell does not
  // carry `archived`; an archived event's guests are the couple's call elsewhere, not this banner's.
  const ended = isFinishedEvent(
    { event_date: event.event_date, event_end_date: event.event_end_date ?? null, archived: null },
    calendarDayInZone(venueTz),
  );
  return announcementStage(phase, ended);
}

