import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readEventMemories } from '@/lib/event-memories.server';
import { countGalleryFrames } from '@/lib/papic-gallery';
import { viewerSeesCoupleScopedPapic } from '@/lib/papic-gallery-scope';
import { resolveStoredWindow } from '@/lib/papic-window';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatCount } from '@/lib/format-number';
import { getIapGate } from '@/lib/request-platform';
import { PAPIC_UPLOADS_CAMERA_INDEX } from '@/lib/papic-cameras';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { AddToLibrary } from '@/app/dashboard/[eventId]/studio/papic/_components/add-to-library';
import { UploadsOpenChoice } from '@/app/dashboard/[eventId]/studio/papic/_components/uploads-open-choice';
import { claimUploadsCamera } from '@/app/dashboard/[eventId]/studio/papic/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { memoriesCameraWords, memoriesUnreadable } from '@/lib/event-memories-words';
import type { MemoriesAlbumKey } from '@/lib/event-memories';
import { MemoriesSettings } from './_components/memories-settings';

export const metadata = { title: 'Memories' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/memories — THIS EVENT'S MEMORIES, the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html` — Memories is this event's gallery, the approved Apple-Photos
 * grid of `prototypes/papic_controller_one_page_2026-10-23.html`).
 *
 * ONE read for every album (`readEventMemories`: Papic · Challenges · Event Hub · Suppliers · Your uploads, the
 * compressed copies only) and one honest count beside it (`countGalleryFrames` — counted with the GRID'S OWN filters, so the number never counts a frame the grid will not draw). For the
 * couple it also draws what is theirs to run: ⚙ Gallery settings (`MemoriesSettings` — the controls that left the
 * Papic page) and + Add photos (the shipped uploader; when adding by hand is off, the sheet offers to turn it on).
 *
 * 🔑 A REFUSED READ IS NEVER AN EMPTY GALLERY — `memoriesUnreadable`, and each album's own read (`refused`).
 * And `refused.photos` is set when ANY capture read errored — said as "couldn't load", never as a smaller gallery.
 * 🔒 A non-couple viewer whose "which suppliers did the couple hide?" read failed sees NO supplier shots
 * (`viewerIsCouple: false` → fail closed) — a refusal must never show what the couple chose to hide (review of #6851).
 */
export default async function EventMemoriesPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [eventRes, membershipRes, seesAll, count, iap] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, papic_window_start, papic_window_end, papic_uploads_open, venue_latitude, venue_longitude')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase.from('event_members').select('member_type').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
    // Asked separately, as the Papic page does: an RLS refusal on the couple-only sources is an empty list with no
    // error, indistinguishable from a day nobody shot.
    viewerSeesCoupleScopedPapic(supabase, eventId),
    countGalleryFrames(supabase, eventId),
    getIapGate(),
  ]);
  if (eventRes.error) logQueryError('EventMemoriesPage.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  const ev = eventRes.data as
    | {
        event_date: string | null;
        papic_window_start: string | null;
        papic_window_end: string | null;
        papic_uploads_open: boolean | null;
        venue_latitude: number | null;
        venue_longitude: number | null;
      }
    | null;
  if (!ev && !eventRes.error) notFound();
  const host = membershipRes.data?.member_type === 'couple';

  // `seesAll` = the couple's own sources reach this viewer; a viewer they do not fails closed on the hidden suppliers.
  const isCouple = seesAll;
  const read = await readEventMemories(supabase, eventId, { host, viewerIsCouple: isCouple });
  const items = read.items;
  const papicItems = items.filter((i) => i.memSource !== 'hub');
  const hubCount = items.length - papicItems.length;
  const vendorShown = papicItems.filter((p) => p.source === 'vendor').length;
  const papicTotal = seesAll ? (count === null ? null : count + vendorShown) : papicItems.length;
  const unreadable = read.refused.photos || (memoriesUnreadable(papicItems.length, papicTotal) && hubCount === 0);
  if (read.refused.photos) {
    // The reads themselves swallow their errors into [] — say so here, so the refusal reaches Sentry too.
    logQueryError('EventMemoriesPage.gallery', { message: 'a capture read was refused' }, { event_id: eventId });
  }
  const refusedParts: MemoriesAlbumKey[] = [
    ...(read.refused.hub ? (['hub'] as const) : []),
    ...(read.refused.challenges ? (['challenges'] as const) : []),
  ];

  const win = ev
    ? resolveStoredWindow({ windowStart: ev.papic_window_start, windowEnd: ev.papic_window_end, eventDate: ev.event_date })
    : null;
  const appleIap = iap.iap;

  // + ADD PHOTOS — the shipped uploader on the uploads camera (owner 2026-10-23: the one upload door, in the thumb
  // row). "Adding photos by hand" folds into it: when it is off, the sheet offers the same switch to turn it on.
  let addPhotos: React.ReactNode = null;
  if (host) {
    // ⚠ ABSENT MEANS OPEN — the switch's own rule (`the-uploads-switch-is-real.test.ts`), read off the one event select.
    const uploadsRow = ev;
    const uploadsOpen = uploadsRow?.papic_uploads_open ?? true;
    const { data: seat, error: seatErr } = await createAdminClient()
      .from('paparazzi_seats')
      .select('claim_qr_token, claimer_user_id')
      .eq('event_id', eventId)
      .eq('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
      .is('revoked_at', null)
      .maybeSingle();
    if (seatErr) logQueryError('EventMemoriesPage.uploadsSeat', seatErr, { event_id: eventId }, 'graceful_degrade');
    const token = seat?.claimer_user_id === user.id ? ((seat?.claim_qr_token as string | null) ?? null) : null;
    addPhotos = !uploadsOpen ? (
      <UploadsOpenChoice eventId={eventId} open={false} variant="row" />
    ) : token ? (
      <AddToLibrary token={token} />
    ) : (
      <form action={claimUploadsCamera} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <p className="max-w-prose text-sm text-ink/65">
          Add photos and clips from your phone or laptop — older memories too. They land in your Memories with everything
          your guests take, and cost the same: one credit a photo.
        </p>
        <SubmitButton className="sn-btn-primary">Turn this on</SubmitButton>
      </form>
    );
  }

  return (
    <>
    <EventMemoriesGallery
      eventId={eventId}
      items={items}
      host={host}
      challenges={read.challenges}
      chapters={read.chapters}
      totals={{ all: papicTotal === null ? null : papicTotal + hubCount, papic: papicTotal === null ? null : papicTotal - vendorShown - papicItems.filter((p) => p.uploads).length }}
      footLine={win ? memoriesCameraWords({ startIso: win.startIso, endIso: win.endIso, now: Date.now() }) : null}
      cappedLine={
        !unreadable && papicTotal !== null && papicTotal > papicItems.length && papicItems.length > 0
          ? `${formatCount(papicTotal)} kept · the latest from each camera shown here`
          : null
      }
      emptyLine={seesAll ? 'Your photos land here as your guests and suppliers shoot.' : 'Nothing has been shared with you yet.'}
      unreadable={unreadable}
      refusedParts={refusedParts}
      timeZone={ev ? eventTimezoneFromCoords(ev.venue_latitude, ev.venue_longitude) : null}
      settings={host ? <MemoriesSettings eventId={eventId} loginEmail={user.email ?? null} appleIap={appleIap} /> : null}
      addPhotos={addPhotos}
      blockedGuests={read.blockedGuests}
      suppliers={read.suppliers}
    />
    {/* 🔦 First visit only — a new feature gets its spotlight (house rule), after the host journey. */}
    <Spotlight tourKey={HOST_PAGE_TOURS.memories} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </>
  );
}
