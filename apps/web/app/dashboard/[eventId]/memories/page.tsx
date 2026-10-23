import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { viewerSeesCoupleScopedPapic } from '@/lib/papic-gallery-scope';
import { countPapicCaptures } from '@/lib/papic-home-tile';
import { resolveStoredWindow } from '@/lib/papic-window';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatCount } from '@/lib/format-number';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { memoriesCameraWords, memoriesCountWords, memoriesUnreadable } from '@/lib/event-memories-words';

export const metadata = { title: 'Memories' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/memories — THIS EVENT'S MEMORIES, the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html`: *"Home · Guests · Suppliers · Hub · Memories"* — Memories is
 * this event's gallery, the same Apple-Photos grid as the approved Papic one-page prototype).
 *
 * One read of the photos (`fetchPapicGallery`, the Papic page's own: crew, guests and suppliers, newest first) and one
 * honest count beside it (`countPapicCaptures`, Home's "See N photos" number). The grid, the zoom and the thumb row
 * are `EventMemoriesGallery`.
 *
 * 🔑 A REFUSED READ IS NEVER AN EMPTY GALLERY. `fetchPapicGallery` answers a refusal with `[]`, so an empty list
 * only means "nothing yet" when the count beside it read 0 — a null count, or a count above zero over an empty
 * list, is said as "couldn't load".
 */
export default async function EventMemoriesPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [eventRes, photos, seesAll, count] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, papic_window_start, papic_window_end, venue_latitude, venue_longitude')
      .eq('event_id', eventId)
      .maybeSingle(),
    // 🗜 Memories always shows the compressed copy — never an original (owner 2026-10-23).
    fetchPapicGallery(supabase, eventId, { compressedOnly: true }),
    // Asked separately, as the Papic page does: an RLS refusal on the couple-only sources is an empty list with no
    // error, indistinguishable from a day nobody shot.
    viewerSeesCoupleScopedPapic(supabase, eventId),
    countPapicCaptures(supabase, eventId),
  ]);
  if (eventRes.error) logQueryError('EventMemoriesPage.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  const ev = eventRes.data as
    | {
        event_date: string | null;
        papic_window_start: string | null;
        papic_window_end: string | null;
        venue_latitude: number | null;
        venue_longitude: number | null;
      }
    | null;
  if (!ev && !eventRes.error) notFound();

  const vendorShown = photos.filter((p) => p.source === 'vendor').length;
  // The couple's count is every capture, crew and guests, plus the suppliers' shots on the page. A viewer who sees
  // only the suppliers' shots is shown what they can see.
  const total = seesAll ? (count === null ? null : count + vendorShown) : photos.length;
  const unreadable = memoriesUnreadable(photos.length, total);

  const win = ev
    ? resolveStoredWindow({ windowStart: ev.papic_window_start, windowEnd: ev.papic_window_end, eventDate: ev.event_date })
    : null;

  return (
    <>
    <EventMemoriesGallery
      photos={photos}
      countLine={total === null ? null : memoriesCountWords(total)}
      footLine={win ? memoriesCameraWords({ startIso: win.startIso, endIso: win.endIso, now: Date.now() }) : null}
      cappedLine={
        total !== null && total > photos.length && photos.length > 0
          ? `${formatCount(total)} kept · showing the newest ${formatCount(photos.length)}`
          : null
      }
      emptyLine={
        seesAll
          ? 'Your photos land here as your guests and suppliers shoot.'
          : 'Nothing has been shared with you yet.'
      }
      unreadable={unreadable}
      timeZone={ev ? eventTimezoneFromCoords(ev.venue_latitude, ev.venue_longitude) : null}
    />
    {/* 🔦 First visit only — a new feature gets its spotlight (house rule), after the host journey. */}
    <Spotlight tourKey={HOST_PAGE_TOURS.memories} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </>
  );
}
