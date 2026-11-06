import { pulseBaseline } from '@/lib/event-pulse.server';
import { LiveRefresher } from './live-refresher';

/**
 * PulsedLiveRefresher — `LiveRefresher` for a guest page, with its pulse baseline resolved on the server
 * (2026-10-18, live-day polling). The page re-draws only when the event's shared "has anything changed?" answer moves
 * (`lib/event-pulse.server.ts`), instead of a full render every 45 s. `guest` (the signed-in guest of THIS event) lets
 * their own arrival or photo tag re-draw their page; without it only event-wide changes do.
 *
 * The baseline comes from the event's remembered pulse — no new read in the common case. If it cannot be read the
 * refresher falls back to the 45 s refresh, never to a frozen page.
 */
export async function PulsedLiveRefresher({
  slug,
  eventDate,
  guest = null,
  renderedAt,
}: {
  slug: string;
  eventDate: string | Date | null | undefined;
  guest?: { eventId: string; guestId: string } | null;
  /** When the page's render began (ISO). Defaults to now. */
  renderedAt?: string;
}) {
  const pulse = await pulseBaseline(slug, guest, renderedAt ?? new Date().toISOString());
  return <LiveRefresher eventDate={eventDate} slug={slug} pulse={pulse} />;
}
