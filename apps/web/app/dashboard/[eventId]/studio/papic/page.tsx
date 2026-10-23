import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { notFound, redirect } from 'next/navigation';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Hand,
  Info,
  ChevronRight,
  HardDrive,
  Smartphone,
  CircleHelp,
  CheckCircle2,
  Unlink2,
  BatteryWarning,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { startRead } from '@/lib/start-read';
import { formatPhp } from '@/lib/orders';
import { createAdminClient } from '@/lib/supabase/admin';
import { readPapicStandings } from '@/lib/papic-standings';
import {
  resolveStoredWindow,
  PAPIC_CAPTURE_MONTHS_BEFORE,
} from '@/lib/papic-window';
import { PAPIC_STYLES } from '@/lib/papic-photo-styles';
import {
  provisionFreeCamerasAdmin,
  provisionUploadsCameraAdmin,
} from '@/lib/papic-cameras';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { papicIsOn } from '@/lib/event-answers';
import {
  countLimitedGuests,
  fetchActiveLimitedSnapshot,
  reconcileLimitedSnapshot,
  syncGuestCameras,
  type LimitedSnapshotStatus,
} from '@/lib/papic-limited';
import { PAPIC_CAMERA_SALE_REFUSED, PAPIC_CAMERA_SALE_REFUSED_WORDS } from '@/lib/papic-sells-only-credits';
import { MagazineCard } from './_components/magazine-card';
import { RecapCard } from './_components/recap-card';
import { GuestContributionsCard } from './_components/guest-contributions-card';
import { PapicTopBand } from './_components/papic-top-band';
import { getIapGate } from '@/lib/request-platform';
import { papicGlance, glanceTileFromStandings } from '@/lib/papic-glance';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { LifeFlashCard } from './_components/life-flash-card';
import { type DriveGrant } from './_components/drive-copy-card';
import { PapicCameraSettings } from './_components/papic-camera-settings';

// Iteration 0012 — Papic studio (couple setup surface).
//
// Redesigned 2026-06-26 (owner: "modern minimalist · not much words, more of
// what's needed to run the app") around the owner-locked camera model:
//   • LIMITED cameras come FROM the guest list — every guest who hasn't declined
//     gets one camera (their personal QR is the credential) + their own gallery.
//     The count auto-derives; "Ready for Papic" freezes the count + bill once,
//     and late "yes" RSVPs are covered for free within the cap (syncGuestCameras
//     runs on render). See lib/papic-limited.ts.
//   • UNLIMITED cameras are the ONLY way to add a shooter NOT on the guest list
//     (videographer friend / hired second shooter). One stepper, min 1.
//   • DSLR Camera Bridge is a native-app (V1.5) pairing — the web card is
//     informational, folded into "Setup & help" at the bottom.
//
// SPEC: ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md
//
// Storage choice (Setnayan R2 vs Google Drive) stays wired end-to-end against
// /api/oauth/drive/* + public.oauth_grants. The capture pipeline / native app /
// DSLR pairing are still TODO(0012) — see the seam notes at the bottom.

export const metadata = { title: 'Papic' };

/* Name + promise from the one record every Studio row already reads, so a buy
   page can never give a couple a second account of one product. It throws on an
   unknown key rather than rendering a hero with no product name on it. */
const PAPIC_HERO = addOnHeroCopy('papic');
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    drive_connected?: string;
    drive_disconnected?: string;
    drive_error?: string;
    /** The shared couple-check refusal — every action in this tree, not
     *  storage. Renamed from `storage_error` 2026-08-26 when the storage
     *  question was deleted and its old name started lying. */
    papic_access_error?: string;
    /** Turning on the Uploads camera — see claimUploadsCamera. */
    uploads_ready?: string;
    uploads_error?: string;
    uploads_open_set?: string;
    /* 🗑 papic_purchased / papic_order / papic_ref / papic_amount ARE GONE.
     *  They carried a banner that stood in for a payment page: it named the
     *  amount and the reference, then spent two more taps getting the buyer to
     *  the QR. All four Papic mints now redirect to /pay/<reference> like every
     *  other buy button in the product (lib/pay-path.ts), so nothing sets these
     *  and a banner reading them could only ever render for a stale link. */
    /** Credits the Home decision row recommended topping up by, so this page
     *  can open on the right rung instead of making the couple work it out
     *  again. Advisory only — nothing is priced or purchased from it. */
    topup?: string;
    papic_error?: string;
    papic_one_error?: string;
    papic_pool_error?: string;
    shots_error?: string;
    shots_set?: string;
    /** The couple's per-guest numbers. ⚠ NOT `shots_*` — those are taken by
     *  setCameraShots, and sharing them would show one control's
     *  confirmation after another control's save. */
    allotment_set?: string;
    allotment_error?: string;
    /** ⛔ Both confirmed camera sales retired 2026-10-23 — accepted and ignored, never drawn. */
    papic_unlock_provisioned?: string;
    limited_synced?: string;
    limited_error?: string;
    papic_window_saved?: string;
    papic_window_error?: string;
    /** ⚠ ACCEPTED AND IGNORED. Papic was three tabs until 2026-08-27; links,
     *  bookmarks and the couple's own browser history still carry `?tab=`. It
     *  is typed so the value cannot become an unhandled key, and read by
     *  nothing — there is one page now, and every control is on it. */
    tab?: string;
    // ⚠ THESE NINE WERE EMITTED AND READ BY NOTHING. Every one is redirected
    // back by an action on this route, and not one appeared in this type — so
    // changing the Papic look, the photo quality, face matching, showcase state,
    // vendor visibility or guest cameras all saved AND FAILED in silence.
    style_set?: string;
    style_error?: string;
    showcase_set?: string;
    showcase_error?: string;
    faceTagging?: string;
    vendorMedia?: string;
    guestCameras?: string;
    preserve_set?: string;
    preserve_error?: string;
    /** 📍 "Buy more" from Home's Next card — the band opens on the stepper. */
    buy?: string;
    /** 🎨 "See N photos" from Home — the gallery opens on arrival (owner call 2). */
    gallery?: string;
  }>;
};




// Supported DSLR bodies (informational — pairing is native-app V1.5). Canon is
// the only brand with a true mobile Wi-Fi capture API today; the rest land as
// their SDKs open up.
const SDK_MATRIX = [
  { brand: 'Canon', note: 'EOS R-series (Wi-Fi capture) — supported at launch' },
  { brand: 'Nikon', note: 'Z / D-series — as the SDK opens' },
  { brand: 'Sony', note: 'α / ZV / FX — as the SDK opens' },
  { brand: 'Fujifilm', note: 'X / GFX — as the SDK opens' },
];

export default async function PapicAddonPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const {
    drive_connected: driveConnected,
    drive_disconnected: driveDisconnected,
    drive_error: driveError,
    papic_access_error: papicAccessError,
    uploads_ready: uploadsReady,
    uploads_error: uploadsError,
    uploads_open_set: uploadsOpenSet,
    papic_error: papicError,
    papic_one_error: papicOneError,
    papic_pool_error: papicPoolError,
    shots_error: shotsError,
    shots_set: shotsSet,
    allotment_set: allotmentSet,
    allotment_error: allotmentError,
    limited_error: limitedError,
    papic_window_saved: papicWindowSaved,
    papic_window_error: papicWindowError,
    style_set: styleSet,
    style_error: styleError,
    showcase_set: showcaseSet,
    showcase_error: showcaseError,
    faceTagging,
    vendorMedia,
    guestCameras,
    preserve_set: preserveSet,
    preserve_error: preserveError,
  } = search;
  // 🖼 OLD LINKS STILL WORK (contract 2026-10-24): "?gallery=open" opened the library that lived here — it lives in
  // the event's Memories tab now, so the link goes there. (Every other old Papic link lands on this camera page.)
  if (search.gallery === 'open') redirect(`/dashboard/${eventId}/memories`);

  const supabase = await createClient();
  // ⏱ The SAME ask the dashboard layout makes (`getCurrentUser` is cache()d per render), so the
  // page no longer pays a second auth round trip of its own before its first read.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  /*
    ⏱ THE PAGE'S INDEPENDENT READS START TOGETHER, RIGHT AFTER THE GATE (2026-10-22, "the
    couple's Studio › Papic page is slow"). Measured in the lab before this change: the loader
    asked ~17 questions ONE AFTER ANOTHER — the event row, the Drive grant, the Drive config,
    the camera rates, the tier config, the One tiers, the entitlement client, then the catalogue
    batch, the guest counts — though none of them needs another's answer.

    Each is STARTED here (`startRead`) and awaited at the SAME place it always was, so every
    `if (error)`, every graceful-degrade branch and every fallback below reads exactly as before.
    What did not move:
      · the event row's `notFound()` still comes before anything is USED — a rejected
        entitlement ask (a visitor who is not a host) is held by `startRead`, not thrown, until
        the place that awaits it, which is after `notFound()`;
      · every self-heal WRITE (free cameras, free pool, uploads camera) still runs only after
        the event row is confirmed AND the host-only entitlement client has answered (the
        catalogue batch is where it is first awaited — a non-host is refused there, before any
        service-role write), and every read that must SEE those writes (the uploads seat,
        the claim-link seats, the extra cameras, the standings) is still asked after them.
    🔒 `the-papic-page-opens-fast.test.ts` holds both halves.
  */
  const unlockAdmin = createAdminClient();
  const eventRead = startRead(
    supabase
      .from('events')
      .select(
        'event_id, event_type, event_date, papic_storage_target, papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, papic_window_start, papic_window_end, papic_style, papic_uploads_open, papic_on, venue_latitude, venue_longitude',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
  );
  const driveGrantRead = startRead(
    supabase
      .from('oauth_grants')
      .select('grant_id, external_account_display, granted_at, connection_health, metadata')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle()
      .then((r) => r.data ?? null),
  );
  /* ⛔ THE CAMERA RATES, THE TIER CONFIG AND THE ONE TIERS ARE NOT ASKED ANY MORE (owner 2026-10-23,
     "why do i have these?"): they priced the guest-camera tiers and the crew-camera ladder, and Papic
     sells credits only (`lib/papic-sells-only-credits.ts`). */
  // The entitlement client is asked ONCE (it is cache()d per event); each SKU waits on it alone.
  const entitlementClientRead = startRead(eventEntitlementClient(eventId));
  /* 🗂 Drive's config, Keep full-res's price and ownership and the checkout settings left with the files (Memories ⚙,
     2026-10-23) — this page asks none of them. */
  const cameraBridgeRowRead = startRead(
    unlockAdmin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, is_active')
      .eq('service_code', 'CAMERA_BRIDGE')
      .maybeSingle(),
  );
  // The guest list and its snapshot read guests + snapshots, which no self-heal below writes.
  const limitedGuestCountRead = startRead(countLimitedGuests(supabase, eventId));
  const limitedSnapshotRead = startRead(fetchActiveLimitedSnapshot(supabase, eventId));
  // Guest-bound seats only (`guest_id` set). The free and uploads cameras provisioned below are
  // never guest-bound, so asking before them reads the same number as asking after.
  const guestCameraCountRead = startRead(
    supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('guest_id', 'is', null)
      .is('revoked_at', null),
  );

  /* 🍎 THE iPHONE APP, WHERE APPLE SELLS (version 1.1 — `IAP_OPENED_ROUTE` in lib/store-shell.ts; middleware opens
     this page there ONLY then). `appleIap` true ⇒ the page draws no web price, no GCash / BDO, no web link: Buy more
     is Apple's sheet, and every offer sold only on the web (the guest-camera tiers, extra crew cameras, Unlock all,
     Keep Full-Res, DSLR pairing, the keep-at-full-size ₱ line) is not drawn. False everywhere else — the web, the
     desktop app, and every app build without the StoreKit plugin or the owner's switch — and then nothing here
     changes. Held by `lib/the-app-opens-what-apple-sells.test.ts`. */
  const appleIap = (await getIapGate()).iap;

  const { data: event, error: eventError } = await eventRead;
  // ⚠ the event this page reads against. Refused, it degrades rather than claiming.
  if (eventError) {
    logQueryError('PapicStudioPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) notFound();

  // Event-wide Papic look (the couple's locked capture template).
  // 🔌 ONE READ OF THE EVENT ROW (2026-10-13, owner: least requests per screen).
  // The look, the uploads switch and the "Photos from your guests?" answer each
  // had their OWN round trip of `events`, so a column that had not landed yet
  // could not take the main select down with it. All three columns have been
  // in every database for months (20270307004141 · 20271170068924 · Your info),
  // so they ride the one select above: four reads of one row became one.
  const styleRow = event as { papic_style?: string | null };
  const papicStyle =
    styleRow.papic_style ?? 'ORIG';
  // The look's human name for the row. DERIVED from the style table — the row
  // must never carry a second copy of these five words.
  const papicStyleLabel =
    PAPIC_STYLES.find((st) => st.id === papicStyle)?.label ?? 'Orig';

  // (Who may add photos by hand is read where the door is now — Memories' + Add photos.)

  // ⚠ A SECOND DEAD ROUND TRIP, REMOVED 2026-08-26. The per-event photo
  // fidelity tier was read here for one reason: to feed the "Photo quality"
  // picker. Owner: *"the photo quality is already set for us by default. we do
  // not need to ask them."* The picker is gone, so the read is gone with it —
  // the column keeps its database default ('optimal'), capture ingest still
  // reads it, and nothing on this page asks a person about megapixels.

  // ⚠ A DEAD ROUND TRIP, REMOVED. `eventOwnsPapicSeats(...)` ran alongside this
  // read and its answer was destructured into `ownsPapicSeats` and then
  // referenced NOWHERE in 1,785 lines. Splitting the page into three rooms would
  // only have made it easier to keep paying for an answer nobody asks for.
  // (asked above, with the page's other independent reads)
  // The Drive grant only names the connected account in the banner a Drive connect lands on.
  const driveGrant = ((await driveGrantRead) ?? null) as DriveGrant | null;

  // Capture window → DAYS multiplier (price) + the picker's current state.
  const ev = event as Record<string, unknown>;
  const papicWindow = resolveStoredWindow({
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
    eventDate: (ev.event_date as string | null) ?? null,
  });
  // (The window in words lives in the camera settings now — `PapicCameraSettings`, the one line.)


  /* ⛔ THE PHASE-ORDERED BLOCKS ARE GONE (2026-10-23): the Papic page is the camera only — one order, the owner's
     (the one line · the credits · his five · challenges). What re-ordered by phase was the files, now Memories. */



  // ⚠ THERE ARE NO ROOMS ANY MORE — see the "four ways in" section below.
  // `resolvePapicRoom` and its outcome→room map are deleted, not disabled: with
  // one page every confirmation banner is always on screen, so the whole reason
  // that map existed (a "saved" message landing in a room nobody was looking at)
  // is gone rather than guarded.

  // Unlock-all umbrella (admin-managed price; owning it frees Unli).
  // (each started above, with the page's other independent reads)
  // The DSLR bridge's price comes from the catalogue, never from copy — and only while the row is ACTIVE.
  // CAMERA_BRIDGE was retired (migration 20270828170000), so today this resolves to "no price, nothing to buy".
  // 🔒 THE HOST-ONLY CHECK, before any service-role write below — a visitor who is not a host is refused here. (It used
  // to be awaited inside the catalogue batch that left with the files; it is awaited on its own now.)
  await entitlementClientRead;
  const { data: cameraBridgeRow, error: cameraBridgeRowError } = await cameraBridgeRowRead;
  if (cameraBridgeRowError) {
    logQueryError('PapicPage.cameraBridgeRow', cameraBridgeRowError, { event_id: eventId }, 'graceful_degrade');
  }
  const cameraBridgePricePhp = cameraBridgeRow?.is_active
    ? Number(cameraBridgeRow.retail_price_php)
    : null;

  // FREE cameras — "always 3 seats / event" (owner 2026-07-17 · brief PR-3).
  // Idempotent render-time top-up (the same lazy pattern syncGuestCameras uses
  // below): materializes the 3 tier='free' seats at indexes 100..102 so the
  // capture-points gate has real seats to meter — the advertised free allowance
  // is ENFORCED at the seams, never display-only. Best-effort (returns 0 on any
  // hiccup; the next render retries). Their claim links live on /crew.
  const freeCamerasHeal = provisionFreeCamerasAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // 🗂 The host's "Photos from your guests?" answer (`events.papic_on`, Your info).
  const papicAnsweredNo = !papicIsOn((event as { papic_on?: unknown }).papic_on);

  // FREE POOL — the other half of the free tier, and the SELF-HEAL for it.
  // The 3 seats above are useless without points: with no grant at all,
  // papic_event_pool_status() returns applies=FALSE and papic_reserve_event_points()
  // takes its "fence absent -> allow, ledger untouched" branch, so capture runs
  // UNMETERED. Every event-creation path now arms this at commit; this call is the
  // backstop that catches (a) every event created before 20271017100000 that the
  // backfill somehow missed and (b) any creation-time write that failed its
  // best-effort attempt. Idempotent — the partial unique index collapses repeats.
  //
  // 🗂 …EXCEPT WHERE THE HOST SAID NO (owner 2026-10-02, "EVERY ANSWER … LIVES
  // IN EVENT DETAILS"): "Photos from your guests? — No" (`papic_on = false`,
  // changed in Your info) is a DATA condition, not a branch of the render — an
  // off event takes no capture at all (`eventAcceptsNewCaptures`), so it has
  // nothing to meter, and arming it here would undo the couple's answer. An
  // unread switch arms, the self-heal's own direction.
  const freePoolHeal = (async () => {
    if (!papicAnsweredNo) {
      await ensureFreePapicPoolGrantAdmin(unlockAdmin, eventId);
      // 🔌 THE FREE "ONE" CAMERA IS NO LONGER ARMED ON EVERY VIEW (owner 2026-10-13,
      // "Add all" — the tester's "drop the retired free-camera call"). Papic One
      // was retired as a product on 2026-08-11; asking for its camera on every
      // view of this page was a request per view for a camera nobody is sold.
      // Event creation still arms it (its promise on /pricing stands until the
      // owner retires it there); existing ones keep working.
    }
  })();

  // …and the couple's own UPLOADS camera — the shutter that is a file picker.
  // Owner 2026-08-26: "papic is the source where they collect media files for
  // that event" and "they can upload their work via papic credits as well per
  // event." An upload is a camera taking a shot, so it inherits the metering,
  // the safety screen, the derivatives and the Drive copy verbatim.
  //
  // ⛔ IT IS PROVISIONED HERE AND ONLY HERE, and that is a security decision,
  // not tidiness. This is a SERVICE-ROLE write; a standalone server action
  // taking a client-supplied event id would let a signed-in stranger mint a
  // live seat on somebody else's wedding and claim it, after which every gate
  // downstream waves them through — the upload presign and the record path both
  // check CLAIMER IDENTITY and nothing else. This render already ran the couple
  // check, so the event id is not client-supplied by the time we are here.
  //
  // Same window as every other camera: `captureWindowState` returns 'open' on
  // null bounds, so a null-window seat would be the only one in the product
  // exempt from the dates the couple picked.
  const uploadsCameraHeal = provisionUploadsCameraAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // ⏱ THE THREE SELF-HEALS RUN TOGETHER. Three different rows (seats 100..102, the event's pool
  // grant, seat 150), none reads another's, and each is best-effort and never throws — so one
  // trip for all three instead of one each. Every read below that must SEE them waits for all.
  await Promise.all([freeCamerasHeal, freePoolHeal, uploadsCameraHeal]);
  /* 📍 The uploads seat is no longer read here: + Add photos lives in Memories (`memories/page.tsx` reads the seat
     and checks it is THIS person's). The seat is still provisioned above — here and only here (security note). */

  // ── LIMITED (guest-list) state ──────────────────────────────────────────
  // Auto-count = guests who haven't declined. One reversible snapshot freezes
  // the bill; render-time sync keeps cameras in line with late RSVPs (free,
  // within the cap).
  const limitedGuestCount = await limitedGuestCountRead;
  const limitedSnapshot = await limitedSnapshotRead;
  let limitedStatus: LimitedSnapshotStatus | null = limitedSnapshot?.status ?? null;
  // ⚠ A COUNT IS THE SAME DEFECT WEARING A DIFFERENT DESTRUCTURE. Supabase
  // ⚠ RESOLVES with { error } rather than throwing, so a refused count arrives
  // ⚠ as `count: null`, `?? 0` makes it a zero, and the tile below tells a
  // ⚠ couple whose guests all hold a camera that "0 cameras" are ready.
  let guestCameraCount: number | null = 0;
  {
    const { count, error: guestCameraCountError } = await guestCameraCountRead;
    if (guestCameraCountError) {
      logQueryError(
        'PapicPage.guestCameraCount',
        guestCameraCountError,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    guestCameraCount = guestCameraCountError ? null : count ?? 0;
  }
  if (limitedSnapshot) {
    // Lazy reconcile pending→active, then self-heal cameras if the list moved.
    limitedStatus = await reconcileLimitedSnapshot(unlockAdmin, limitedSnapshot);
    const expected = Math.min(limitedGuestCount, limitedSnapshot.camera_cap);
    // An unread count is not a count of zero, and "0 !== expected" would send
    // this into a self-heal it has no reason to run. (syncGuestCameras re-reads
    // the seats itself, so nothing was duplicated — but a write triggered by a
    // read that failed is a write nobody asked for.)
    if (guestCameraCount !== null && guestCameraCount !== expected) {
      try {
        const r = await syncGuestCameras(unlockAdmin, eventId, {
          ...limitedSnapshot,
          status: limitedStatus,
        });
        guestCameraCount = Math.max(0, guestCameraCount + r.added - r.revoked);
      } catch {
        // best-effort; the snapshot is already recorded.
      }
    }
  }
  /* ⛔ NO QUOTE IS WORKED OUT HERE ANY MORE. The Limited / Unlimited per-guest quotes fed the guest-camera
     tier sheet, retired 2026-10-23. The snapshot sync above STAYS: it keeps the cameras of a couple who
     already paid for that tier in step with their RSVPs — historical money keeps working. */

  /* ⏱ THE LAST WAVE — every read that must see the self-heals AND the guest sync above, started
     together: the uploads seat (started above), the extra cameras, the claim-link seats and the
     standings. Each is still awaited where it always was. */
  const standingsRead = startRead(readPapicStandings(createAdminClient(), eventId));


  /* ⛔ NO SEAT IS COUNTED FOR THE COUPLE ANY MORE (owner 2026-10-23). The off-list extras count and the
     claim-link roster fed "N camera QRs are still in your pocket" and the crew-camera row — a camera per
     seat, which the one shared pot retired. The seats themselves stay: a seat is the camera CLAIM. */

  // 📍 Read AFTER every self-heal above (the free pool grant, the cameras, the
  // guest sync): the pool status is asked once per render now (`askedOnce`), so
  // the first ask must see what this render just armed.
  // ⚠ READ ONCE, USED TWICE. The stage needs to know whether the library is
  // empty (roll or photographs) and the facts strip on its edge reports the same
  // three numbers. Two components counting the same thing is a definition twice,
  // and this page has already paid for that shape once.
  const standings = await standingsRead;

  /* 📍 THE TOP BAND (owner "Yes", 2026-10-13): credits left · Buy more · See N
     photos, and when the cameras are on — worked out from the standings just
     read and the window above, nothing more (lib/papic-glance.ts). */
  const papicBand = papicGlance({
    permitted: true,
    tile: glanceTileFromStandings(standings),
    window: { startDate: papicWindow.startDate, endIso: papicWindow.endIso },
    papicOn: true,
  });


  return (
    /*
      ⚠ FLEX COLUMN, NOT `space-y-7`. CSS `order` applies only to flex and grid
      items, so on a block container every order class below would be inert and
      the page would look exactly as it does today. `gap-7` reproduces
      `space-y-7` exactly.
    */
    /* 📖 THE READING COLUMN — 48 rem, centred (owner 2026-10-19, couple dashboard desktop + tablet: a Studio
       product is a reading column). A wrapper, so the flex column below keeps its own shape. */
    /*
      📷 PAPIC IS THE CAMERA — ONE PAGE (owner 2026-10-23, approved `prototypes/papic_controller_one_page_2026-10-23.html`):
      *"Papic is the camera service. Gallery is the collection of the files for that event. Papic holds: Filter,
      Credits per guest, face tagging, face blocking, challenge."* So this page is the switch and the dates on one
      line, the credits and Add more, then his five — and nothing about the files. The gallery, the photo wall, the
      thank-you video, "guests see all", Google Drive and Keep full resolution live in Memories (the event bar's
      fifth tab, ⚙ Gallery settings); moderation is on each photo there; "How guests get in" is Home › Settings
      (Event Details); a supplier's whole delivery is hidden from the supplier's own row in Event access.
      `papic-is-the-camera.test.ts` holds the split.
    */
    <div className="mx-auto w-full max-w-3xl">
    <section className="flex flex-col gap-7 pb-12">
      <span hidden data-papic-page="camera" />
      {/* The house way back — Home, where Papic's row lives (owner 2026-10-23: "← Home"). */}
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        data-papic-back=""
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Home
      </Link>

      <StudioBuyHero productName={PAPIC_HERO.label} promise={PAPIC_HERO.blurb} />

      {/* ⚠ EVERY CONFIRMATION, ON THE ONE PAGE. */}
      <StatusBanners
        driveConnected={!!driveConnected}
        driveDisconnected={!!driveDisconnected}
        driveError={driveError}
        papicAccessError={papicAccessError}
        uploadsReady={uploadsReady}
        uploadsError={uploadsError}
        uploadsOpenSet={uploadsOpenSet}
        connectedAccount={driveGrant?.external_account_display ?? null}
        eventId={eventId}
        papicError={papicError}
        limitedError={limitedError}
        papicWindowSaved={papicWindowSaved}
        papicWindowError={papicWindowError}
        styleSet={styleSet}
        styleError={styleError}
        showcaseSet={showcaseSet}
        showcaseError={showcaseError}
        faceTagging={faceTagging}
        vendorMedia={vendorMedia}
        guestCameras={guestCameras}
        preserveSet={preserveSet}
        allotmentSet={allotmentSet}
        allotmentError={allotmentError}
        preserveError={preserveError}
        appleIap={appleIap}
      />

      {/* (2) THE CREDITS — the one band: what is left · the meter · Add more (owner "Yes", 2026-10-13). */}
      <PapicTopBand
        eventId={eventId}
        glance={papicBand}
        canBuy
        buyOpen={Boolean(papicPoolError) || search.buy === '1'}
        error={papicPoolError ?? null}
        apple={appleIap}
      />
      {/* NOTIFICATION ONLY — the host is told what guests chipped in, not asked. */}
      <GuestContributionsCard eventId={eventId} />

      {/* (3) THE CAMERA — the one line (switch + dates), his five, the challenges: the SAME component Home's Papic
          card opens under itself (`papic-camera-settings.tsx`). */}
      <PapicCameraSettings eventId={eventId} />

      {/* MADE FROM YOUR MEMORIES — the keepsakes Papic's frames become (not in the owner's five; kept, unmoved). */}
      <MagazineCard eventId={eventId} />
      <RecapCard eventId={eventId} />
      <LifeFlashCard eventId={eventId} />

      <p className="px-1 text-xs text-ink/55" data-papic-memories-line="">
        Your photos, the photo wall and the thank-you video live in Memories.
      </p>

      {/* Setup & help — folded away, as today. */}
      <details className="group sn-tile">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-medium text-ink/80 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <CircleHelp aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
            {appleIap ? 'Setup & help — the shutter, capture defaults' : 'Setup & help — DSLR pairing, the shutter, capture defaults'}
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-ink/50 transition-transform group-open:rotate-90" strokeWidth={2} />
        </summary>
        <div className="space-y-6 border-t border-ink/10 p-5">
          {appleIap ? null : <DslrBridgeSection pricePhp={cameraBridgePricePhp} />}
          <ShutterSection />
          <CaptureDefaultsSection />
        </div>
      </details>

      {/* 🔦 First visit only — the spotlight (owner 2026-10-22, journey_fixes_later Host 4). No price in any step. */}
      <Spotlight tourKey={HOST_PAGE_TOURS.papic} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ⛔ `LimitedCard` (the guest-camera tier sheet: "A camera for every guest", Limited / Unlimited per guest,
// "activate N guest cameras · ₱…") WAS HERE — retired 2026-10-23 with the per-guest tier it sold. A guest's
// invite QR is their camera and costs nothing on its own; every shot draws from the shared pot.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Status banners
// -----------------------------------------------------------------------------

function StatusBanners({
  eventId,
  driveConnected,
  driveDisconnected,
  driveError,
  papicAccessError,
  uploadsReady,
  uploadsError,
  uploadsOpenSet,
  allotmentSet,
  allotmentError,
  connectedAccount,
  papicError,
  limitedError,
  papicWindowSaved,
  papicWindowError,
  styleSet,
  styleError,
  showcaseSet,
  showcaseError,
  faceTagging,
  vendorMedia,
  guestCameras,
  preserveSet,
  preserveError,
  appleIap = false,
}: {
  eventId: string;
  driveConnected: boolean;
  driveDisconnected: boolean;
  driveError: string | undefined;
  papicAccessError: string | undefined;
  uploadsReady: string | undefined;
  uploadsError: string | undefined;
  uploadsOpenSet: string | undefined;
  allotmentSet: string | undefined;
  allotmentError: string | undefined;
  connectedAccount: string | null;
  papicError: string | undefined;
  limitedError: string | undefined;
  papicWindowSaved: string | undefined;
  papicWindowError: string | undefined;
  styleSet: string | undefined;
  styleError: string | undefined;
  showcaseSet: string | undefined;
  showcaseError: string | undefined;
  faceTagging: string | undefined;
  vendorMedia: string | undefined;
  guestCameras: string | undefined;
  preserveSet: string | undefined;
  preserveError: string | undefined;
  /** 🍎 The iPhone app where Apple sells — no line that speaks of a web price. */
  appleIap?: boolean;
}) {
  const ok =
    'inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900';
  const neutral =
    'inline-flex items-start gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75';
  const bad =
    'inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900';

  const hasAny =
    driveConnected ||
    driveDisconnected ||
    driveError ||
    papicAccessError ||
    uploadsReady ||
    uploadsError ||
    uploadsOpenSet ||
    papicError ||
    limitedError ||
    papicWindowSaved !== undefined ||
    papicWindowError ||
    // ⚠ THE BAIL-OUT IS HALF THE BUG. Adding a banner below without adding its
    // param here returns null before anything renders — the confirmation would
    // be written, passed in, and still never shown. That is exactly how these
    // nine got lost the first time.
    styleSet ||
    styleError ||
    showcaseSet ||
    showcaseError ||
    faceTagging ||
    vendorMedia ||
    guestCameras ||
    preserveSet ||
    preserveError ||
    allotmentSet ||
    allotmentError;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {/* 💳 THE "ORDER RECEIVED" BANNER LIVED HERE, AND IT WAS THE DETOUR.
          It printed the amount and the reference and then offered "See how to
          pay" → the order page → "Pay now" → /pay. The owner asked why a Papic
          purchase did not land where the others land; it now does, at the mint
          (app/.../studio/papic/actions.ts), so there is no state left for this
          banner to describe. Deleted rather than left unreachable: a
          confirmation nothing can trigger reads to the next person as a live
          screen with a broken trigger. */}
      {/* ⛔ "N Unlimited cameras added — free with Unlock all" and "N new guest cameras added from your
          list" were the two confirmations of camera sales that no longer exist (2026-10-23). Nothing sets
          their params any more; an old link carrying one shows nothing rather than a camera count. */}

      {papicWindowSaved !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Capture window saved — {papicWindowSaved} day
          {papicWindowSaved === '1' ? '' : 's'}.
        </p>
      ) : null}

      {papicWindowError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {papicWindowError === 'end_after_event_date'
            ? 'Capture has to cover your event day — start on or before it.'
            : papicWindowError === 'start_after_end'
              ? 'The end date is before the start date.'
              : papicWindowError === 'missing_event_date'
                ? 'Set your event date first, then choose a window.'
                : papicWindowError === 'start_too_early'
                  ? `You can start up to ${PAPIC_CAPTURE_MONTHS_BEFORE} months before your event — pick a later start date.`
                  : 'Could not save the window — please try again.'}
        </p>
      ) : null}

      {/* ⚠ NINE CONFIRMATIONS THAT WENT NOWHERE. Each of these was already being
          written into the URL by an action and read by nothing at all — so a
          couple changing their Papic look, their photo quality, face matching,
          showcase state, vendor visibility or guest cameras got no answer
          whether it worked or failed. Wording is plain English: what a PERSON
          did, never the name of the thing that stores it. */}

      {styleSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Look saved — every camera at your event shoots it from now on.
        </p>
      ) : null}
      {styleError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Could not save that look — please try again.
        </p>
      ) : null}

      {showcaseSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {showcaseSet === 'removed'
            ? 'Taken out of your public memory orb.'
            : 'Added to your public memory orb — it goes live once the guest in it has agreed to public sharing too.'}
        </p>
      ) : null}
      {showcaseError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {showcaseError === 'missing_photo'
            ? 'That snippet is no longer in your Memories.'
            : 'Could not change that — please try again.'}
        </p>
      ) : null}

      {faceTagging ? (
        faceTagging === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change face matching — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {faceTagging === 'off'
              ? 'Face matching is off for your event. Guests can still be tagged by scanning a QR.'
              : 'Face matching is on. Guests who add a selfie get their photos found for them.'}
          </p>
        )
      ) : null}

      {vendorMedia ? (
        vendorMedia === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change that — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {vendorMedia === 'hidden'
              ? 'Your suppliers’ photos are hidden from your Memories.'
              : 'Your suppliers’ photos are showing in your Memories.'}
          </p>
        )
      ) : null}

      {guestCameras ? (
        guestCameras === 'error' ? (
          <p className={bad}>
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
            Could not change when guests can shoot — please try again.
          </p>
        ) : (
          <p className={ok}>
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {guestCameras === 'early'
              ? 'Guests can shoot before your event day as well.'
              : 'Guests can shoot on your event day.'}
          </p>
        )
      ) : null}

      {preserveSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {preserveSet === 'released'
            ? 'Released — this one becomes a smaller copy after your event. It stays in your Memories.'
            : 'Saved — this one stays at full size.'}
        </p>
      ) : null}
      {preserveError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {preserveError === 'already_compressed'
            ? 'That one is already a smaller copy — its full-size original has been replaced, and that cannot be undone.'
            : preserveError === 'not_found'
              ? 'That photo is no longer in your Memories.'
              : 'Could not save that choice — please try again.'}
        </p>
      ) : null}

      {/* ⛔ A RETIRED CAMERA SALE, REFUSED (2026-10-23) — an old page posting the guest-camera tier or a crew
          camera lands here, told in one sentence what Papic sells now, and is told nothing was charged. */}
      {papicError === PAPIC_CAMERA_SALE_REFUSED || limitedError === PAPIC_CAMERA_SALE_REFUSED ? (
        <p className={neutral}>
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {PAPIC_CAMERA_SALE_REFUSED_WORDS}
        </p>
      ) : papicError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Something went wrong — please try again.
        </p>
      ) : limitedError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Something went wrong — please try again.
        </p>
      ) : null}

      {driveConnected ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Google Drive connected{connectedAccount ? ` — ${connectedAccount}` : ''}.
          Your Setnayan folder is ready in your Drive.
        </p>
      ) : null}

      {driveDisconnected ? (
        <p className={neutral}>
          <Unlink2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          Google Drive disconnected. Storage is back on Setnayan.
        </p>
      ) : null}

      {driveError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            Google Drive connection failed (
            <span className="font-mono text-xs">{driveError}</span>). Try again, or
            contact support.
          </span>
        </p>
      ) : null}

      {allotmentSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {allotmentSet === 'released'
            ? 'Every limit is lifted — the whole pot is open to everyone now.'
            : allotmentSet === 'cleared'
              ? 'That guest is no longer named — they share what is left with everyone else.'
              : allotmentSet === '0'
                ? 'Every guest draws from the same pot again, until it runs out.'
                : 'Saved. Your guests can see their own limit on their camera.'}
        </p>
      ) : null}

      {allotmentError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {allotmentError === 'bad_everyone'
            ? 'A limit of nothing is not a limit, so that number starts at 1. Leave it empty to cap them at an equal share of what is left, or name a guest to stop her taking anything.'
            : allotmentError === 'bad_minimum'
            ? 'A minimum of nothing is not a promise, so that number starts at 1. Leave it empty for no minimum.'
            : allotmentError === 'minimum_above_limit'
            ? 'The least anybody gets cannot be more than the limit you set for everyone — that would promise your guests more than you allow them to take.'
            : allotmentError === 'bad_number'
            ? 'That needs to be a whole number of credits, or empty to let it work itself out.'
            : allotmentError === 'unknown_guest'
              ? 'We could not find that guest on your list.'
              : 'We could not save that. Nothing changed — please try again.'}
        </p>
      ) : null}

      {uploadsOpenSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {uploadsOpenSet === '1'
            ? 'Photos can now be added by hand. Each one uses a credit, the same as a camera shot.'
            : 'Adding photos by hand is off. Only what your cameras capture goes into your Memories.'}
        </p>
      ) : null}

      {uploadsReady ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Uploads are on. Add photos and clips from your phone or laptop — each
          one uses a credit, the same as a camera shot.
        </p>
      ) : null}
      {uploadsError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {uploadsError === 'taken'
            ? 'Someone else is already holding this event’s uploads camera.'
            : uploadsError === 'no_camera'
              ? 'Your uploads camera isn’t ready yet — refresh in a moment.'
              : 'We couldn’t turn uploads on just now. Try again in a moment.'}
        </p>
      ) : null}

      {papicAccessError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            {papicAccessError === 'not_a_couple'
              ? 'Only the couple can change this event’s Papic settings.'
              : 'That didn’t go through — try again, or contact support.'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Setup & help sections (folded under the disclosure)
// -----------------------------------------------------------------------------

/**
 * `pricePhp` is the ACTIVE catalogue price of CAMERA_BRIDGE, or `null` when the
 * row is inactive or unreadable. It used to be typed ("₱100 / seat / day") — a
 * figure that matched neither the catalogue nor a purchasable product. With no
 * price this section offers nothing for sale and says so.
 */
function DslrBridgeSection({ pricePhp }: { pricePhp: number | null }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Smartphone aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        {pricePhp !== null && Number.isFinite(pricePhp)
          ? `Pair a DSLR — ${formatPhp(pricePhp)}`
          : 'Pair a DSLR'}
      </h3>
      <p className="max-w-prose text-sm text-ink/65">
        Turn one camera into a phone + DSLR pair. The phone still does everything
        — shutter, QR tagging, upload — and the DSLR provides the glass. Pairing
        happens in the Papic mobile app over Wi-Fi (arrives with the app, V1.5);
        there&rsquo;s nothing to set up here.
        {pricePhp === null ? ' DSLR pairing is not on sale yet.' : ''}
      </p>
      <details className="rounded-lg border border-ink/10 bg-cream/60">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink/70 [&::-webkit-details-marker]:hidden">
          Supported camera bodies
        </summary>
        <ul className="space-y-1.5 border-t border-ink/10 px-3 py-2.5">
          {SDK_MATRIX.map((row) => (
            <li key={row.brand} className="text-xs text-ink/65">
              <span className="font-semibold text-ink">{row.brand}</span> — {row.note}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ShutterSection() {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Camera aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        The shutter — it&rsquo;s just a tap
      </h3>
      <p className="max-w-prose text-sm text-ink/65">
        In the phone browser, Papic is one shutter button with a Photo / Clip
        toggle — tap for a photo, flip to Clip for a 10-second clip. No app to
        install; front camera is off by design (rear-only, for quality). Every
        clip runs up to 10 seconds and uploads in the background. Drag-to-shoot
        and a synced flash arrive with the native app (V1.5).
      </p>
    </div>
  );
}

function CaptureDefaultsSection() {
  const rows = [
    {
      Icon: BatteryWarning,
      title: 'Battery handoff when it runs low',
      body: 'A handoff QR lets the next person take over without losing queued uploads.',
    },
    {
      Icon: HardDrive,
      title: 'App-sandbox storage',
      body: 'Captures live in the app and purge 24h after upload — never in the camera roll (opt-in to save copies).',
    },
    {
      Icon: Hand,
      title: 'Locked-down by design',
      body: 'Rear-only, 10-second snippet cap, no settings for your crew to fiddle with.',
    },
  ];
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Info aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        Capture defaults
      </h3>
      <ul className="divide-y divide-ink/5 rounded-lg border border-ink/10 bg-cream/60">
        {rows.map((r) => (
          <li key={r.title} className="flex items-start gap-3 p-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
              <r.Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{r.title}</p>
              <p className="mt-0.5 text-xs text-ink/65">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Integration seams (unchanged from the V1.5 scaffold):
// TODO(0012): native iOS + Android capture app — phone-as-camera; gesture
//   shutter; QR scan; face detection; EXIF; adaptive compression; background
//   upload. DSLR pairing per the SDK matrix above.
// TODO(0012): capture pipeline branches on events.papic_storage_target —
//   'setnayan_r2' → R2 (lib/r2.ts) · 'google_drive_only' → the Drive folder in
//   oauth_grants.metadata.drive_folder_id.
// TODO(0012): guest personal-QR → "open my camera" capture entry (resolves the
//   guest's roll seat). Wire after #2280 lands to avoid touching its capture
//   route (app/papic/seat/[token]).
// =============================================================================
