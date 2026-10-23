import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { countGalleryFrames, fetchPapicGallery } from '@/lib/papic-gallery';
import { viewerSeesCoupleScopedPapic } from '@/lib/papic-gallery-scope';
import { resolveStoredWindow } from '@/lib/papic-window';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatCount } from '@/lib/format-number';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { memoriesCameraWords, memoriesCountWords, memoriesUnreadable } from '@/lib/event-memories-words';
import { Suspense, type ReactNode } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventMemberTypeOnce } from '@/lib/event-membership-once';
import { fetchEventHubMedia } from '@/lib/event-hub-media.server';
import { groupIntoChapters } from '@/lib/alaala-chapters';
import { fetchScheduleBlocks, DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { PAPIC_UPLOADS_CAMERA_INDEX } from '@/lib/papic-cameras';
import { getIapGate } from '@/lib/request-platform';
import type { Moment } from '@/lib/memories-albums';
import { AddToLibrary } from '@/app/dashboard/[eventId]/studio/papic/_components/add-to-library';
import { claimUploadsCamera } from '@/app/dashboard/[eventId]/studio/papic/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { MemoriesSettings } from './_components/memories-settings';

export const metadata = { title: 'Memories' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/memories — THIS EVENT'S MEMORIES, the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html`: *"Home · Guests · Suppliers · Hub · Memories"* — Memories is
 * this event's gallery, the same Apple-Photos grid as the approved Papic one-page prototype).
 *
 * One read of the photos (`fetchPapicGallery`, the Papic page's own: crew, guests and suppliers, newest first) and one
 * honest count beside it (`countGalleryFrames` — counted with the GRID'S OWN filters: not hidden, not blocked, not
 * expired, so the number never counts a frame the grid will not draw). The grid, the zoom and the thumb row are
 * `EventMemoriesGallery`.
 *
 * 🗂 PR-B (owner 2026-10-23): Albums ▾ · ⚙ Memories settings · + Add photos · the photo sheet's moderation. The
 * Event Hub album, the day's moments and the uploads camera are read here; the settings, add-photos and moderation
 * are the COUPLE's (a coordinator sees the photos, not the switches).
 *
 * 🔑 A REFUSED READ IS NEVER AN EMPTY GALLERY. `fetchPapicGallery` answers a refusal with `[]`, so an empty list
 * only means "nothing yet" when the count beside it read 0 — a null count, or a count above zero over an empty
 * list, is said as "couldn't load". And `status.refused` names every read that errored: ANY refused read is said as
 * "couldn't load", never as a smaller gallery.
 *
 * 🔒 A non-couple viewer whose "which suppliers did the couple hide?" read failed sees NO supplier shots
 * (`viewerIsCouple: false` → fail closed) — a refusal must never show what the couple chose to hide.
 */
export default async function EventMemoriesPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Asked first, as the Papic page does: an RLS refusal on the couple-only sources is an empty list with no error,
  // indistinguishable from a day nobody shot. It also says whether a failed hidden-suppliers read fails closed.
  const seesAllRead = viewerSeesCoupleScopedPapic(supabase, eventId);
  const status: { refused: Array<'seat' | 'guest' | 'vendor' | 'hiddenSuppliers'> } = { refused: [] };
  const [eventRes, seesAll, photos, count, member, schedule, gate] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, papic_window_start, papic_window_end, venue_latitude, venue_longitude')
      .eq('event_id', eventId)
      .maybeSingle(),
    seesAllRead,
    // 🗜 Memories always shows the compressed copy — never an original (owner 2026-10-23).
    seesAllRead.then((isCouple) =>
      fetchPapicGallery(supabase, eventId, { compressedOnly: true, status, viewerIsCouple: isCouple }),
    ),
    countGalleryFrames(supabase, eventId),
    eventMemberTypeOnce(supabase, eventId, user.id),
    fetchScheduleBlocks(supabase, eventId).catch(() => null),
    getIapGate(),
  ]);
  // The couple themselves (not a coordinator): the settings, + Add photos and the photo sheet are theirs.
  const isCoupleMember = (member.data as { member_type?: string | null } | null)?.member_type === 'couple';
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
  const unreadable = status.refused.length > 0 || memoriesUnreadable(photos.length, total);
  if (status.refused.length > 0) {
    // The reads themselves swallow their errors into [] — say which ones here, so the refusal reaches Sentry too.
    logQueryError('EventMemoriesPage.gallery', { message: `refused: ${status.refused.join(', ')}` }, { event_id: eventId });
  }

  const win = ev
    ? resolveStoredWindow({ windowStart: ev.papic_window_start, windowEnd: ev.papic_window_end, eventDate: ev.event_date })
    : null;

  // 🗂 The Event Hub album — only for a viewer shown the couple's sources; null = not read.
  const hub = seesAll ? await fetchEventHubMedia(eventId).catch(() => null) : null;

  // "Follow moments in order" — the day's moments, from the run of show (`groupIntoChapters`, the Papic page's own).
  // A schedule that cannot be read, or one moment over everything, is no moments at all (the stream stays).
  let moments: Moment[] | null = null;
  try {
  if (schedule && schedule.length > 0 && photos.length > 0) {
    const { days } = groupIntoChapters({
      frames: photos.map((ph) => ({ id: ph.id, capturedAt: ph.capturedAt })),
      blocks: schedule.map((b) => ({
        blockId: b.block_id,
        label: b.label,
        startAt: b.start_at,
        endAt: b.end_at,
        actualStartAt: b.actual_start_at,
        actualEndAt: b.actual_end_at,
      })),
      tz: DEFAULT_EVENT_TZ,
    });
    const flat = days.flatMap((d) => d.chapters);
    if (flat.length > 1) moments = flat.map((c) => ({ key: c.key, label: c.label, photoIds: c.frames.map((f) => f.id) }));
  }
  } catch {
    // A schedule that cannot be grouped leaves Memories whole — one stream, newest first.
    moments = null;
  }

  // + Add photos — the couple's uploads camera (`PAPIC_UPLOADS_CAMERA_INDEX`), behind their own switch. The seat is
  // read with the service client because an unclaimed seat is not theirs to see yet (the Papic page's own read).
  const admin = createAdminClient();
  const [open, seat] = isCoupleMember
    ? await Promise.all([
        supabase.from('events').select('papic_uploads_open').eq('event_id', eventId).maybeSingle(),
        admin
          .from('paparazzi_seats')
          .select('claim_qr_token, claimer_user_id')
          .eq('event_id', eventId)
          .eq('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
          .is('revoked_at', null)
          .maybeSingle(),
      ])
    : [null, null];
  if (open?.error) logQueryError('EventMemoriesPage.uploadsOpen', open.error, { event_id: eventId }, 'graceful_degrade');
  if (seat?.error) logQueryError('EventMemoriesPage.uploadsSeat', seat.error, { event_id: eventId }, 'graceful_degrade');
  // ⚠ ABSENT MEANS OPEN — the switch's own rule (`the-uploads-switch-is-real.test.ts`).
  const uploadsRow = (open?.data ?? null) as { papic_uploads_open?: boolean | null } | null;
  const uploadsOpen = (uploadsRow?.papic_uploads_open ?? true) !== false;
  const mine =
    seat && !seat.error && seat.data?.claimer_user_id === user.id ? (seat.data.claim_qr_token as string | null) : null;
  // The couple's only. A refused seat read offers nothing rather than a door that cannot work; OFF offers nothing.
  const addPhotos: ReactNode =
    !isCoupleMember || !seat || seat.error ? null : !uploadsOpen ? null : mine ? (
      <AddToLibrary token={mine} />
    ) : (
      <form action={claimUploadsCamera} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="return_to" value="memories" />
        <p className="max-w-prose text-sm text-ink/65">
          Add photos and clips from your phone or laptop — older memories too. They land with everything your
          cameras take, and cost the same: one credit a photo.
        </p>
        <SubmitButton className="sn-btn-primary">Turn this on</SubmitButton>
      </form>
    );

  return (
    <>
    <EventMemoriesGallery
      photos={photos}
      countLine={total === null ? null : memoriesCountWords(total)}
      footLine={win ? memoriesCameraWords({ startIso: win.startIso, endIso: win.endIso, now: Date.now() }) : null}
      cappedLine={
        !unreadable && total !== null && total > photos.length && photos.length > 0
          ? `${formatCount(total)} kept · the latest from each camera shown here`
          : null
      }
      emptyLine={
        seesAll
          ? 'Your photos land here as your guests and suppliers shoot.'
          : 'Nothing has been shared with you yet.'
      }
      unreadable={unreadable}
      timeZone={ev ? eventTimezoneFromCoords(ev.venue_latitude, ev.venue_longitude) : null}
      hub={hub}
      moments={moments}
      settings={
        isCoupleMember ? (
          <Suspense fallback={<p className="text-sm text-ink/60">Loading your settings…</p>}>
            <MemoriesSettings eventId={eventId} apple={gate.iap} loginEmail={user.email ?? null} uploadsOpen={uploadsOpen} />
          </Suspense>
        ) : null
      }
      addPhotos={addPhotos}
      moderate={isCoupleMember ? { eventId } : null}
    />
    {/* 🔦 First visit only — a new feature gets its spotlight (house rule), after the host journey. */}
    <Spotlight tourKey={HOST_PAGE_TOURS.memories} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </>
  );
}
