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
import { PAPIC_UPLOADS_CAMERA_INDEX, provisionUploadsCameraAdmin } from '@/lib/papic-cameras';
import { UPLOADS_TAKEN_LINE } from '@/lib/uploads-seat-claim';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { AddToLibrary } from '@/app/dashboard/[eventId]/studio/papic/_components/add-to-library';
import type { UploadPot } from '@/app/dashboard/[eventId]/studio/papic/_lib/upload-credits';
import { PapicBuySheet } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-buy-sheet';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { MagazineCard } from '@/app/dashboard/[eventId]/studio/papic/_components/magazine-card';
import { RecapCard } from '@/app/dashboard/[eventId]/studio/papic/_components/recap-card';
import { LifeFlashCard } from '@/app/dashboard/[eventId]/studio/papic/_components/life-flash-card';
import { eventHasPapicUnlock } from '@/lib/entitlements';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { UploadsOpenChoice } from '@/app/dashboard/[eventId]/studio/papic/_components/uploads-open-choice';
import { memoriesCameraWords, memoriesUnreadable } from '@/lib/event-memories-words';
import type { MemoriesAlbumKey } from '@/lib/event-memories';
import { MemoriesSettings } from './_components/memories-settings';
import { memoriesNotice } from '@/lib/memories-notice';
import { memoriesManagerRole } from '@/lib/memories-rules.server';
import type { MemoriesManagerRole } from '@/lib/memories-rules';

export const metadata = { title: 'Memories' };

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /dashboard/[eventId]/memories — THIS EVENT'S MEMORIES, the event bar's fifth tab (owner 2026-10-23, "Yes", on
 * `prototypes/event_bar_memories_tab_2026-10-23.html` — Memories is this event's gallery, the approved Apple-Photos
 * grid of `prototypes/papic_controller_one_page_2026-10-23.html`).
 *
 * ONE read for every album (`readEventMemories`: Papic · Challenges · Event Hub · Suppliers · Your uploads, the
 * compressed copies only) and one honest count beside it (`countGalleryFrames` — counted with the GRID'S OWN filters, so the number never counts a frame the grid will not draw). For the
 * couple it also draws what is theirs to run: ⚙ Gallery settings (`MemoriesSettings` — the controls that left the
 * Papic page) and + Add photos (the shipped uploader — one press: pick, the camera is claimed on the way; when adding by
 * hand is off, the sheet offers that switch).
 *
 * 🔑 A REFUSED READ IS NEVER AN EMPTY GALLERY — `memoriesUnreadable`, and each album's own read (`refused`).
 * And `refused.photos` is set when ANY capture read errored — said as "couldn't load", never as a smaller gallery.
 * 🔒 A non-couple viewer whose "which suppliers did the couple hide?" read failed sees NO supplier shots
 * (`viewerIsCouple: false` → fail closed) — a refusal must never show what the couple chose to hide (review of #6851).
 */
export default async function EventMemoriesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  // What the last press answered (moderation, + Add photos, a supplier's photos, Google Drive) — said, never silent.
  const notice = memoriesNotice(search);
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
  /* 👥 WHO MANAGES THE MEMORIES RULES (owner 2026-10-30): the hosts — `host` above, the couple + every co-host — and
     the event's coordinator. Asked only of a non-host (a host needs no second read); a failed read answers null, so a
     refusal hides the ⚙ rather than drawing a control whose save would be refused (`lib/memories-rules.server.ts`). */
  const managerRole: MemoriesManagerRole | null = host ? 'host' : await memoriesManagerRole(supabase, eventId, user.id);

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
  // 🍎 In the app — whether or not Apple sells there yet — the sheet names no web price and offers no web checkout
  // (Keep full resolution, the photo wall): `storeShell` OR the Apple gate, never only the gate (review 2026-10-24).
  const appleIap = iap.iap || iap.storeShell;

  // + ADD PHOTOS — the shipped uploader on the uploads camera (owner 2026-10-23: the one upload door, in the thumb
  // row). ONE PRESS (owner 2026-10-26, live: "it seems there is no add photos" · "the turn on is not working as well
  // fix it"): "Choose photos" opens the picker at once, and the camera is claimed on the way (`startAddingPhotos`).
  let addPhotos: React.ReactNode = null;
  if (host) {
    // ⚠ ABSENT MEANS OPEN — the switch's own rule (`the-uploads-switch-is-real.test.ts`), read off the one event select.
    const uploadsRow = ev;
    const uploadsOpen = uploadsRow?.papic_uploads_open ?? true;
    const admin = createAdminClient();
    /* 🪪 THE CAMERA IS MINTED HERE TOO — this render already ran the couple check (`host`, the viewer's OWN membership
       read on their own session), and the event id is the route's, never a form field: the same two facts that make
       the studio render safe (`the-uploads-camera-has-no-back-door.test.ts`). Until 2026-10-26 only the studio page
       minted it, and since 2026-10-24 that page sends the couple to Home before it gets there — so on 7 of 13 live
       events the sheet's press found no camera and could only ever answer "please try again". Idempotent (the
       UNIQUE upsert), best-effort, never throws; the same capture window as every camera. */
    if (uploadsOpen && win) {
      await provisionUploadsCameraAdmin(admin, eventId, { validFrom: win.startIso, validUntil: win.endIso });
    }
    const { data: seat, error: seatErr } = await admin
      .from('paparazzi_seats')
      .select('seat_id, claim_qr_token, claimer_user_id')
      .eq('event_id', eventId)
      .eq('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
      .is('revoked_at', null)
      .maybeSingle();
    if (seatErr) logQueryError('EventMemoriesPage.uploadsSeat', seatErr, { event_id: eventId }, 'graceful_degrade');
    const claimer = (seat?.claimer_user_id as string | null | undefined) ?? null;
    // The token reaches the browser only once the camera is THIS person's; unclaimed, the picker claims it on the pick.
    const token = claimer === user.id ? ((seat?.claim_qr_token as string | null) ?? null) : null;
    const takenByOther = claimer !== null && claimer !== user.id;
    /* 🪙 WHAT THIS CAMERA CAN STILL SPEND (owner 2026-10-25: "adding photos will use up papic credits") — the presign
       gate's OWN question (`papic_capture_points_available`: the seat's own credits + the event's one pot), so the
       number on the sheet is the number the server refuses at. The Papic Unlock pass shoots unmetered, as at the gate.
       A read that failed is null — "Couldn't check", never 0. Asked whenever the uploader is drawn — claimed or not. */
    let pot: UploadPot = null;
    if (uploadsOpen && !takenByOther && seat?.seat_id) {
      const unlocked = await eventHasPapicUnlock(await eventEntitlementClient(eventId), eventId).catch(() => false);
      if (unlocked) pot = 'unmetered';
      else {
        const { data: left, error: potErr } = await admin.rpc('papic_capture_points_available', {
          p_seat_id: seat.seat_id as string,
          p_event_id: eventId,
        });
        if (potErr) logQueryError('EventMemoriesPage.uploadsPot', potErr, { event_id: eventId }, 'graceful_degrade');
        pot = typeof left === 'number' ? Math.max(0, left) : null;
      }
    }
    // The ONE Add more — Apple's sheet in the app (it sells there), the web's sheet on the web; the app without Apple's
    // shop offers no web checkout (the rule `appleIap` above records), so no door there.
    const buy = iap.iap ? (
      <IapPapicSheet eventId={eventId} left={typeof pot === 'number' ? pot : null} label="Add more" />
    ) : iap.storeShell ? null : (
      <PapicBuySheet eventId={eventId} left={typeof pot === 'number' ? pot : null} tone="brand" label="Add more" />
    );
    addPhotos = !uploadsOpen ? (
      <UploadsOpenChoice eventId={eventId} open={false} variant="row" back="memories" />
    ) : takenByOther ? (
      // Said before the press, never discovered after a pick: the one Uploads camera belongs to the other host.
      <p className="text-sm text-ink/70" data-add-photos-taken="">
        {UPLOADS_TAKEN_LINE}
      </p>
    ) : (
      <AddToLibrary token={token} eventId={eventId} pot={pot} buy={buy} />
    );
  }

  return (
    <>
    {/* 🔒 WITHHELD, NOT ABSENT — a viewer the couple's sources do not reach (a coordinator) is told the guests' and
        crew's photos exist and are the couple's; zero photos must never read as "there are none". Moved with the
        library from the Papic page (`lib/papic-gallery-scope.test.ts`). */}
    {notice ? (
      <p
        role={notice.tone === 'bad' ? 'alert' : 'status'}
        className={`mx-4 mt-3 rounded-xl px-3 py-2 text-[13px] ${notice.tone === 'bad' ? 'bg-danger-50 text-danger-900' : 'bg-success-50 text-success-900'}`}
        data-memories-notice={notice.tone}
      >
        {notice.text}
      </p>
    ) : null}
    {seesAll ? null : (
      <p className="px-4 pt-3 text-[13px] text-ink/60" data-memories-withheld="">
        You&rsquo;re seeing what the couple&rsquo;s suppliers shot for their records. The photos the crew and guests took belong to the couple and aren&rsquo;t
        shared with you.
      </p>
    )}
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
      settings={
        managerRole ? (
          <MemoriesSettings eventId={eventId} loginEmail={user.email ?? null} appleIap={appleIap} role={managerRole} />
        ) : null
      }
      addPhotos={addPhotos}
      blockedGuests={read.blockedGuests}
      suppliers={read.suppliers}
    />
    {/* 📖 MADE FROM YOUR MEMORIES — Photo Notes Magazine, Your Recap and this day's Life-Flash, moved here unchanged from
        the Papic page when it was removed (2026-10-26; controller's call, DECISION_LOG "THE PAPIC CARD LIVES ON HOME ›
        TODAY"): they are made FROM these photos, so they sit under them. The host's, as the page was; each self-gates. */}
    {host ? (
      <section className="flex flex-col gap-3 px-4 pb-8 pt-2" aria-label="Made from your memories" data-memories-keepsakes="">
        <MagazineCard eventId={eventId} />
        <RecapCard eventId={eventId} />
        <LifeFlashCard eventId={eventId} />
      </section>
    ) : null}
    {/* 🔦 First visit only — a new feature gets its spotlight (house rule), after the host journey. */}
    <Spotlight tourKey={HOST_PAGE_TOURS.memories} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </>
  );
}
