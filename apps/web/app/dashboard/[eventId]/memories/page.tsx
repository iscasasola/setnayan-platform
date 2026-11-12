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
import { hostCameraSeat, provisionUploadsCameraAdmin, readHostCamera } from '@/lib/papic-cameras';
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { AddToLibrary } from '@/app/dashboard/[eventId]/studio/papic/_components/add-to-library';
import type { UploadPot } from '@/app/dashboard/[eventId]/studio/papic/_lib/upload-credits';
import { PapicBuySheet } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-buy-sheet';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { MagazineCard, readMagazineCard } from '@/app/dashboard/[eventId]/studio/papic/_components/magazine-card';
import { RecapCard } from '@/app/dashboard/[eventId]/studio/papic/_components/recap-card';
import { LifeFlashCard, readLifeFlashCard } from '@/app/dashboard/[eventId]/studio/papic/_components/life-flash-card';
import { ServiceParts, readServicePart } from '@/app/dashboard/[eventId]/studio/_components/service-parts';
import { loadRecapCoupleSummary } from '@/lib/auto-recap';
import { SCOPE_MIN_MOMENTS } from '@/lib/life-story-moment-graph';
import { keepsakeDoors, type KeepsakeKey } from '@/lib/memories-keepsakes';
import { MemoriesKeepsakeRow } from '@/app/_components/memories/memories-keepsake-row';
import { addCellWords } from '@/lib/memories-add-cell';
import { UploadsOpenChoice } from '@/app/dashboard/[eventId]/studio/papic/_components/uploads-open-choice';
import { memoriesCameraWords, memoriesUnreadable } from '@/lib/event-memories-words';
import type { MemoriesAlbumKey } from '@/lib/event-memories';
import { MemoriesSettings } from './_components/memories-settings';
import { memoriesNotice } from '@/lib/memories-notice';
import { memoriesManagerRole } from '@/lib/memories-rules.server';
import { Suspense } from 'react';
import { SERVICE_NAMES } from '@/lib/service-names';
import { resolvePapicHomeTile } from '@/lib/papic-home-tile';
import { papicGlance } from '@/lib/papic-glance';
import { papicCardPhase } from '@/lib/papic-home-card';
import { papicIsOn } from '@/lib/event-answers';
import { PapicCard, type PapicCardInput } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { PapicChapterRead } from '@/app/dashboard/[eventId]/_components/papic-chapter-read';
import { PapicCameraSettings, PapicHeadControl, PapicHeadLine } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings';
import { PAPIC_OUTCOME_KEYS, PapicOutcomeBanners, hasPapicOutcome, type PapicOutcomes } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-outcome-banners';
import { PapicSelfHeal } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-self-heal';
import { PapicCameraHelp } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-camera-help';
/* 🛑 KEEP. The Papic card moved here from Home (THE ONE BUILD, v113), and its settings open Event Settings with the
   server action `openEventSettings`, which RETURNS RENDERED ROWS (the Maker's editors). Next can only send those when
   THIS ROUTE's server files reach them — the same crash Home fixed on 2026-10-29 (see the matching import in
   `../page.tsx`). This side-effect import puts the action, and so the editors it draws, in Memories' server graph.
   🔒 `../_components/the-settings-sheet-is-in-homes-graph.test.ts`. */
import '../_components/open-event-settings';

/**
 * The outcome keys this page's OWN notice line already says (`memoriesNotice`: Google Drive, adding photos, a
 * supplier's photos) — never said twice, so the Papic card is handed every OTHER Papic outcome only.
 */
const SAID_BY_THE_NOTICE: ReadonlySet<string> = new Set([
  'drive_connected',
  'drive_disconnected',
  'drive_error',
  'uploads_ready',
  'uploads_error',
  'uploads_open_set',
  'vendorMedia',
]);
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
 * hand is off, the sheet offers that switch), with its second door, the grid's ＋ Add cell (owner 2026-10-31) — and
 * the KEEPSAKE ROW under the top row: Magazine · Recap · Flash · Thank You, each its shipped card in the house sheet.
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
      .select('event_id, event_date, papic_on, papic_window_start, papic_window_end, papic_uploads_open, venue_latitude, venue_longitude')
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
        papic_on?: unknown;
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
  // 📸 The measured count less what a chapter holds back from this viewer (Memories by chapter) — never a frame the grid
  // will not draw.
  const papicTotal = seesAll ? (count === null ? null : Math.max(0, count - read.withheldCount) + vendorShown) : papicItems.length;
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
  let addCell: { line: string; tip: string } | null = null;
  let keepsakes: React.ReactNode = null;
  let papicCard: React.ReactNode = null;
  if (host) {
    /* 📖 THE KEEPSAKE ROW'S READS (owner 2026-10-31, "Build both") — each card's OWN read, started now so they run beside
       the camera work below, and read ONCE: the answer sizes the row's button AND is handed to the card in its sheet.
       (Marked handled at once; the `await` below still throws a refusal into the page, as the cards' own reads did.) */
    const keepsakeReads = Promise.all([
      readMagazineCard(eventId),
      loadRecapCoupleSummary(eventId),
      readLifeFlashCard(eventId),
      readServicePart(eventId, 'papic'),
    ]);
    keepsakeReads.catch(() => undefined);
    /* 📷 THE PAPIC CARD'S ONE READ (2026-11-08, Papic moved here from Today) — the SAME reader Today uses
       (`resolvePapicHomeTile`), started now beside the keepsakes. A refusal is 'failed' → the card's counts say "—",
       never 0. Drawn where Today drew it: the couple's, on the web, and in the app only where Apple sells. */
    const papicCardShown = !iap.storeShell || iap.iap;
    const papicTileRead = papicCardShown
      ? resolvePapicHomeTile(createAdminClient(), eventId, true).catch((): 'failed' => 'failed')
      : null;
    // ⚠ ABSENT MEANS OPEN — the switch's own rule (`the-uploads-switch-is-real.test.ts`), read off the one event select.
    const uploadsRow = ev;
    const uploadsOpen = uploadsRow?.papic_uploads_open ?? true;
    const admin = createAdminClient();
    /* 🪪 THE CAMERA IS MINTED HERE TOO — this render already ran the couple check (`host`, the viewer's OWN membership
       read on their own session), and the event id is the route's, never a form field: the same two facts that make
       the studio render safe (`the-uploads-camera-has-no-back-door.test.ts`). Until 2026-10-26 only the studio page
       minted it, and since 2026-10-24 that page sends the couple to Home before it gets there — so on 7 of 13 live
       events the sheet's press found no camera and could only ever answer "please try again". Idempotent (the
       UNIQUE upsert), best-effort, never throws; the same capture window as every camera.
       👥 ONE PER HOST (owner 2026-10-31, "yes. papic credits still"): it mints THIS host's own camera (the 4th argument
       is the viewer's own id, never a form field) when they have none and no spare is waiting, so each couple member and
       each co-host adds photos on their own camera — all from the one shared pool. */
    if (uploadsOpen && win) {
      await provisionUploadsCameraAdmin(admin, eventId, { validFrom: win.startIso, validUntil: win.endIso }, user.id);
    }
    const hostCam = await readHostCamera(admin, eventId, user.id);
    if (hostCam.readFailed) logQueryError('EventMemoriesPage.uploadsSeat', { message: 'host camera read refused' }, { event_id: eventId }, 'graceful_degrade');
    const seat = hostCameraSeat(hostCam.pick);
    // The token reaches the browser only once the camera is THIS person's; a spare is claimed by the picker on the pick.
    const mineSeat = hostCam.pick?.kind === 'mine' ? hostCam.pick.seat : null;
    const token = mineSeat && mineSeat.claimer_user_id === user.id ? (mineSeat.claim_qr_token ?? null) : null;
    /* 🪙 WHAT THIS CAMERA CAN STILL SPEND (owner 2026-10-25: "adding photos will use up papic credits") — the presign
       gate's OWN question (`papic_capture_points_available`: the seat's own credits + the event's one pot), so the
       number on the sheet is the number the server refuses at. (The Unlock pass that once shot unmetered is retired, 2026-11-05.)
       A read that failed is null — "Couldn't check", never 0. Asked whenever the uploader is drawn — claimed or not. */
    let pot: UploadPot = null;
    if (uploadsOpen && seat?.seat_id) {
      const { data: left, error: potErr } = await admin.rpc('papic_capture_points_available', {
        p_seat_id: seat.seat_id,
        p_event_id: eventId,
      });
      if (potErr) logQueryError('EventMemoriesPage.uploadsPot', potErr, { event_id: eventId }, 'graceful_degrade');
      pot = typeof left === 'number' ? Math.max(0, left) : null;
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
    ) : (
      <AddToLibrary token={token} eventId={eventId} pot={pot} buy={buy} />
    );
    // ＋ The grid's Add cell — the SAME door's words, from the same three faces (`lib/memories-add-cell.ts`).
    addCell = addCellWords(!uploadsOpen ? 'off' : 'open', pot);

    const [magazine, recap, flash, thankYou] = await keepsakeReads;
    // Each door opens its SHIPPED card, unchanged, handed the read above — the stack that sat at the page's foot.
    const cards: Record<KeepsakeKey, React.ReactNode> = {
      magazine: <MagazineCard eventId={eventId} state={magazine} />,
      recap: <RecapCard eventId={eventId} state={recap} />,
      flash: <LifeFlashCard eventId={eventId} state={flash} />,
      // 🎬 The Thank-You Video door — out of the ⚙, ONE home: this row (owner 2026-10-31).
      'thank-you': <ServiceParts eventId={eventId} service="papic" door={thankYou} />,
    };
    const doors = keepsakeDoors({
      magazine,
      recap,
      flash,
      flashMin: SCOPE_MIN_MOMENTS.event,
      thankYou: thankYou !== null,
    });
    /* 🔑 Keyed: its props carry ASYNC server cards, so the element reaches the client still resolving, and React (dev)
       then asks it for a list key where the gallery draws it among its siblings (measured in the lab, 2026-10-31). */
    keepsakes = <MemoriesKeepsakeRow key="keepsakes" doors={doors} cards={cards} />;

    /*
      📷 PAPIC — ONE CARD, IN MEMORIES (THE ONE BUILD, owner 8 Nov 2026: *"Papic + Thank You into Memories"*; supersedes
      2026-10-26 "THE PAPIC CARD LIVES ON HOME › TODAY"). The card Today drew, moved whole: the head switch, Total ·
      Taken · Remaining, Add more, the chapter row, and every Papic setting in place under its › (`seat="memories"`,
      so each save lands back HERE). Thank You is already this page's keepsake door — never two doors (`thankYouHref:
      null`). Old links (`/studio/papic…`, `/dashboard/<id>?papic=open…`) forward here (`lib/legacy-redirects.ts`).
    */
    if (papicCardShown) {
      const tile = papicTileRead ? await papicTileRead : 'failed';
      const papicSwitch = ev?.papic_on;
      const papicOn = papicSwitch === undefined ? null : papicIsOn(papicSwitch);
      const now = papicGlance({
        permitted: true,
        tile,
        window: { startDate: win?.startDate ?? null, endIso: win?.endIso ?? null },
        eventDate: ev?.event_date ?? null,
        papicOn,
      });
      const outcomes: PapicOutcomes = {};
      for (const k of PAPIC_OUTCOME_KEYS) {
        const v = search[k];
        if (!SAID_BY_THE_NOTICE.has(k) && typeof v === 'string') outcomes[k] = v;
      }
      const poolError = typeof search.papic_pool_error === 'string' ? search.papic_pool_error : null;
      // The Add more is this page's own, exactly: Apple's sheet in the app · the web's sheet on the web — opened on
      // arrival when a purchase answered with an error or `?buy=1`.
      const cardBuy = iap.iap ? (
        <IapPapicSheet eventId={eventId} left={now.count} label="Add more" />
      ) : (
        <PapicBuySheet
          eventId={eventId}
          left={now.count}
          tone="brand"
          main
          label="Add more"
          defaultOpen={Boolean(poolError) || search.buy === '1'}
          error={poolError}
        />
      );
      const card: PapicCardInput = {
        phase: win ? papicCardPhase(win.startIso, win.endIso, Date.now()) : null,
        thankYouHref: null,
        headControl: (
          <Suspense fallback={null}>
            <PapicHeadControl eventId={eventId} papicOn={papicOn} />
          </Suspense>
        ),
        headLine: (
          <Suspense fallback={SERVICE_NAMES.papic.brand}>
            <PapicHeadLine eventId={eventId} papicOn={papicOn} />
          </Suspense>
        ),
        counts: { total: now.total, left: now.count },
        buy: cardBuy,
        chapter: (
          <Suspense fallback={null}>
            <PapicChapterRead eventId={eventId} />
          </Suspense>
        ),
        defaultOpen: hasPapicOutcome(outcomes) || Boolean(poolError),
        settings: (
          <>
            {hasPapicOutcome(outcomes) ? (
              <div className="pb-4" data-papic-card-outcome="">
                <PapicOutcomeBanners eventId={eventId} search={outcomes} appleIap={iap.iap} />
              </div>
            ) : null}
            <Suspense fallback={null}>
              <PapicCameraSettings eventId={eventId} seat="memories" />
            </Suspense>
            <PapicCameraHelp appleIap={iap.iap} />
            <Suspense fallback={null}>
              <PapicSelfHeal eventId={eventId} />
            </Suspense>
          </>
        ),
      };
      papicCard = <PapicCard key="papic" card={card} />;
    }
  }

  return (
    /* 🖥 From 701 the library sits on the 64-rem wide stage (owner D1, tablet/desktop lane 1); below 701 this div is
       an unstyled block, so the phone is unchanged. */
    <div className="tab:mx-auto tab:w-full tab:max-w-5xl" data-memories-stage="">
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
      chapterList={read.chapterList}
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
      addCell={addCell}
      keepsakes={keepsakes}
      papic={papicCard}
      blockedGuests={read.blockedGuests}
      suppliers={read.suppliers}
      // 🏷 Tag in the viewer — the hosts and the coordinator (the 2026-10-30 Memories ruling); the action re-checks.
      canTag={managerRole !== null}
    />
    {/* 🔦 First visit only — a new feature gets its spotlight (house rule), after the host journey. */}
    <Spotlight tourKey={HOST_PAGE_TOURS.memories} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </div>
  );
}
