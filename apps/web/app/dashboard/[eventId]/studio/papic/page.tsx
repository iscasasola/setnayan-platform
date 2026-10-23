import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  ChevronRight,
  CheckCircle2,
  CircleHelp,
  Info,
  Smartphone,
  Unlink2,
  BatteryWarning,
  HardDrive,
  Hand,
} from 'lucide-react';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { studioHubHref } from '@/lib/studio-hub';
import { logQueryError } from '@/lib/supabase/error-detect';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER } from '@/lib/host-page-tours';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { startRead } from '@/lib/start-read';
import { formatPhp } from '@/lib/orders';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStoredWindow, PAPIC_CAPTURE_MONTHS_BEFORE } from '@/lib/papic-window';
import { PAPIC_FREE_CAMERA_COUNT, PAPIC_MIN_PAID_CAMERAS, provisionFreeCamerasAdmin, provisionUploadsCameraAdmin } from '@/lib/papic-cameras';
import { formatCount } from '@/lib/format-number';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import {
  countLimitedGuests,
  fetchActiveLimitedSnapshot,
  reconcileLimitedSnapshot,
  syncGuestCameras,
  type LimitedSnapshotStatus,
} from '@/lib/papic-limited';
import { papicIsOn } from '@/lib/event-answers';
import { getIapGate } from '@/lib/request-platform';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { PapicCameraSettings } from './_components/papic-camera-settings';
import { GuestContributionsCard } from './_components/guest-contributions-card';
import { VendorChallengesApproval } from './vendor-challenges-approval';

// Iteration 0012 — Papic studio (couple setup surface).
//
// 📷 THE CAMERA ONLY (owner 2026-10-23, PR-B): *"Papic is the camera service. Gallery is the collection of the files
// for that event."* This page is the event-wide camera settings — the SAME component Home's Papic widget opens in
// place (`PapicCameraSettings`): Papic on/off + dates · credits · Add more · Filter · Challenges · Face tagging.
// Everything about FILES moved to the event's Memories tab: the photos and their moderation, the Live wall, the
// Thank-You Video, Guests see all, Google Drive, Keep full-res, and what is made from the photos. Old links keep
// working — `?buy=1` opens Add more, `?gallery=open` lands on Memories, every outcome banner still reads here.
//
// SPEC: ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md

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
  // 🗂 An old "See N photos" link: the photos live on the event's Memories tab now (owner 2026-10-23).
  if (search.gallery === 'open') redirect(`/dashboard/${eventId}/memories`);

  const supabase = await createClient();
  // ⏱ The SAME ask the dashboard layout makes (`getCurrentUser` is cache()d per render).
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  /*
    ⏱ THE PAGE'S INDEPENDENT READS START TOGETHER, RIGHT AFTER THE GATE. Each is STARTED here (`startRead`) and
    awaited where it is used; the event row's `notFound()` still comes first, and every self-heal WRITE below runs
    only after the host-only entitlement client has answered (a non-host is refused there, before any service-role
    write). 🔒 `the-papic-page-opens-fast.test.ts` holds both halves.
  */
  const unlockAdmin = createAdminClient();
  const eventRead = startRead(
    supabase
      .from('events')
      .select('event_id, event_date, papic_window_start, papic_window_end, papic_on')
      .eq('event_id', eventId)
      .maybeSingle(),
  );
  // The entitlement client is asked ONCE (it is cache()d per event) — the host check the heals wait for.
  const entitlementClientRead = startRead(eventEntitlementClient(eventId));
  // The guest list and its snapshot read guests + snapshots, which no self-heal below writes.
  const limitedGuestCountRead = startRead(countLimitedGuests(supabase, eventId));
  const limitedSnapshotRead = startRead(fetchActiveLimitedSnapshot(supabase, eventId));
  // Guest-bound seats only (`guest_id` set). The free and uploads cameras provisioned below are never guest-bound.
  const guestCameraCountRead = startRead(
    supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('guest_id', 'is', null)
      .is('revoked_at', null),
  );
  const cameraBridgeRowRead = startRead(
    unlockAdmin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, is_active')
      .eq('service_code', 'CAMERA_BRIDGE')
      .maybeSingle(),
  );

  /* 🍎 THE iPHONE APP, WHERE APPLE SELLS (version 1.1 — `IAP_OPENED_ROUTE` in lib/store-shell.ts; middleware opens
     this page there ONLY then). `appleIap` true ⇒ the page draws no web price, no GCash / BDO, no web link: Add more
     is Apple's sheet, and every offer sold only on the web is not drawn. Held by
     `lib/the-app-opens-what-apple-sells.test.ts`. */
  const appleIap = (await getIapGate()).iap;

  const { data: event, error: eventError } = await eventRead;
  // ⚠ the event this page reads against. Refused, it degrades rather than claiming.
  if (eventError) {
    logQueryError('PapicStudioPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) notFound();
  // The host-only check, before any service-role write (a non-host is refused here).
  await entitlementClientRead;

  const ev = event as Record<string, unknown>;
  const papicWindow = resolveStoredWindow({
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
    eventDate: (ev.event_date as string | null) ?? null,
  });

  // FREE cameras — "always 3 seats / event" (owner 2026-07-17 · brief PR-3). Idempotent render-time top-up:
  // materializes the 3 tier='free' seats so the capture-points gate has real seats to meter. Best-effort.
  const freeCamerasHeal = provisionFreeCamerasAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // 🗂 The host's "Photos from your guests?" answer (`events.papic_on`, Event Details).
  const papicAnsweredNo = !papicIsOn((event as { papic_on?: unknown }).papic_on);

  // FREE POOL — the SELF-HEAL for the free grant (with no grant at all the pool is unmetered). Idempotent. …EXCEPT
  // WHERE THE HOST SAID NO (owner 2026-10-02): an off event takes no capture, and arming it would undo the answer.
  const freePoolHeal = (async () => {
    if (!papicAnsweredNo) {
      await ensureFreePapicPoolGrantAdmin(unlockAdmin, eventId);
    }
  })();

  // …and the couple's own UPLOADS camera — the shutter that is a file picker (Memories' + Add photos claims it).
  // ⛔ IT IS PROVISIONED HERE AND ONLY HERE, and that is a security decision: a SERVICE-ROLE write. A standalone
  // server action taking a client-supplied event id would let a signed-in stranger mint a live seat on somebody
  // else's wedding. This render already ran the couple check, so the event id is not client-supplied by now.
  const uploadsCameraHeal = provisionUploadsCameraAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // ⏱ THE THREE SELF-HEALS RUN TOGETHER — three different rows, each best-effort and never throwing.
  await Promise.all([freeCamerasHeal, freePoolHeal, uploadsCameraHeal]);

  // ── LIMITED (guest-list) SNAPSHOTS ALREADY BOUGHT — the render-time sync stays a backstop ─────────────────
  // Nothing on this page sells a guest-camera tier any more (credits only), but an event that bought one keeps its
  // snapshot: pending→active is reconciled, and cameras follow late RSVPs for free within the cap.
  const limitedGuestCount = await limitedGuestCountRead;
  const limitedSnapshot = await limitedSnapshotRead;
  // ⚠ A COUNT IS THE SAME DEFECT WEARING A DIFFERENT DESTRUCTURE. A refused count arrives as `count: null`, and
  // `?? 0` alone would make it a zero — "0 cameras ready" to a couple whose guests all hold one.
  let guestCameraCount: number | null = 0;
  {
    const { count, error: guestCameraCountError } = await guestCameraCountRead;
    if (guestCameraCountError) {
      logQueryError('PapicPage.guestCameraCount', guestCameraCountError, { event_id: eventId }, 'graceful_degrade');
    }
    guestCameraCount = guestCameraCountError ? null : count ?? 0;
  }
  if (limitedSnapshot) {
    const limitedStatus: LimitedSnapshotStatus = await reconcileLimitedSnapshot(unlockAdmin, limitedSnapshot);
    const expected = Math.min(limitedGuestCount, limitedSnapshot.camera_cap);
    // An unread count is not a count of zero — no self-heal runs on a read that failed.
    if (guestCameraCount !== null && guestCameraCount !== expected) {
      try {
        await syncGuestCameras(unlockAdmin, eventId, { ...limitedSnapshot, status: limitedStatus });
      } catch {
        // best-effort; the snapshot is already recorded.
      }
    }
  }

  // The DSLR bridge's price comes from the catalogue, never from copy — and only while the row is ACTIVE.
  const { data: cameraBridgeRow, error: cameraBridgeRowError } = await cameraBridgeRowRead;
  if (cameraBridgeRowError) {
    logQueryError('PapicPage.cameraBridgeRow', cameraBridgeRowError, { event_id: eventId }, 'graceful_degrade');
  }
  const cameraBridgePricePhp = cameraBridgeRow?.is_active ? Number(cameraBridgeRow.retail_price_php) : null;

  return (
    /* 📖 THE READING COLUMN — 48 rem, centred (owner 2026-10-19). */
    <div className="mx-auto w-full max-w-3xl">
    <section className="flex flex-col gap-7 pb-12">
      {/* 🍎 In the app the More menu is not built (#6725): back is Home, where Papic's row lives. */}
      <Link
        href={appleIap ? `/dashboard/${eventId}` : studioHubHref(eventId)}
        className="inline-flex items-center gap-1.5 self-start rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {appleIap ? 'Back to Home' : 'Back to add-ons'}
      </Link>

      <StudioBuyHero productName={PAPIC_HERO.label} promise={PAPIC_HERO.blurb} />

      {/* ⚠ EVERY CONFIRMATION, ON THE ONE PAGE — every action that lands here still says how it went. */}
      <StatusBanners
        driveConnected={!!search.drive_connected}
        driveDisconnected={!!search.drive_disconnected}
        driveError={search.drive_error}
        papicAccessError={search.papic_access_error}
        uploadsReady={search.uploads_ready}
        uploadsError={search.uploads_error}
        uploadsOpenSet={search.uploads_open_set}
        connectedAccount={null}
        eventId={eventId}
        papicUnlockProvisioned={search.papic_unlock_provisioned}
        papicError={search.papic_error}
        limitedSynced={search.limited_synced}
        limitedError={search.limited_error}
        papicWindowSaved={search.papic_window_saved}
        papicWindowError={search.papic_window_error}
        styleSet={search.style_set}
        styleError={search.style_error}
        showcaseSet={search.showcase_set}
        showcaseError={search.showcase_error}
        faceTagging={search.faceTagging}
        vendorMedia={search.vendorMedia}
        guestCameras={search.guestCameras}
        preserveSet={search.preserve_set}
        allotmentSet={search.allotment_set}
        allotmentError={search.allotment_error}
        preserveError={search.preserve_error}
        appleIap={appleIap}
      />

      {/* 📷 THE CAMERA SETTINGS — the same component Home's widget opens in place. */}
      <div data-tour="papic-coverage">
        <PapicCameraSettings
          eventId={eventId}
          apple={appleIap}
          buyOpen={Boolean(search.papic_pool_error) || search.buy === '1'}
          buyError={search.papic_pool_error ?? null}
        />
      </div>

      {/* Suppliers' challenges waiting for the couple's yes — beside the challenges they join. */}
      <VendorChallengesApproval eventId={eventId} />

      {/* NOTIFICATION ONLY — the host is told what guests chipped in, not asked. */}
      <GuestContributionsCard eventId={eventId} />

      {/* 🗂 The files moved to Memories — one quiet door, so nobody hunts for them here. */}
      <p className="text-[13px] text-ink/60" data-papic-files-moved="">
        <Link href={`/dashboard/${eventId}/memories`} className="inline-flex items-center gap-0.5 hover:text-ink">
          Your photos, the photo wall, Google Drive and Keep full-res are on Memories
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </p>

      {/* Setup & help — folded away, as today. */}
      <details className="group sn-tile">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-medium text-ink/80 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <CircleHelp aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
            {appleIap ? 'Setup & help — the shutter, capture defaults' : 'Setup & help — DSLR pairing, the shutter, capture defaults'}
          </span>
          <ChevronRight
            aria-hidden
            className="h-4 w-4 text-ink/50 transition-transform group-open:rotate-90"
            strokeWidth={2}
          />
        </summary>
        <div className="space-y-6 border-t border-ink/10 p-5">
          {/* 🍎 DSLR pairing is a web extra ("not on sale yet", or its ₱) — not in the app. */}
          {appleIap ? null : <DslrBridgeSection pricePhp={cameraBridgePricePhp} />}
          <ShutterSection />
          <CaptureDefaultsSection />
        </div>
      </details>

      {/* 🔦 First visit only — the spotlight (owner 2026-10-22, journey_fixes_later Host 4), after the journey. No price in any step. */}
      <Spotlight tourKey={HOST_PAGE_TOURS.papic} after={HOST_PAGE_TOURS_AFTER} replay="page" />
    </section>
    </div>
  );
}

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
  papicUnlockProvisioned,
  papicError,
  limitedSynced,
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
  papicUnlockProvisioned: string | undefined;
  papicError: string | undefined;
  limitedSynced: string | undefined;
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
    papicUnlockProvisioned ||
    papicError ||
    limitedSynced !== undefined ||
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
      {papicUnlockProvisioned ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {papicUnlockProvisioned} Unlimited camera
          {papicUnlockProvisioned === '1' ? '' : 's'} added{appleIap ? '.' : ' — free with Unlock all.'}
        </p>
      ) : null}

      {limitedSynced !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {Number(limitedSynced) > 0
            ? `${formatCount(Number(limitedSynced))} new guest camera${limitedSynced === '1' ? '' : 's'} added from your list.`
            : 'Your guest cameras are up to date.'}
        </p>
      ) : null}

      {papicWindowSaved !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Capture window saved — {papicWindowSaved} day
          {papicWindowSaved === '1' ? '' : 's'}.{appleIap ? null : ' Your camera prices reflect it.'}
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
            ? 'That snippet is no longer in your gallery.'
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
              ? 'Your suppliers’ photos are hidden from your gallery.'
              : 'Your suppliers’ photos are showing in your gallery.'}
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
            ? 'Released — this one becomes a smaller copy after your event. It stays in your gallery.'
            : 'Saved — this one stays at full size.'}
        </p>
      ) : null}
      {preserveError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {preserveError === 'already_compressed'
            ? 'That one is already a smaller copy — its full-size original has been replaced, and that cannot be undone.'
            : preserveError === 'not_found'
              ? 'That photo is no longer in your gallery.'
              : 'Could not save that choice — please try again.'}
        </p>
      ) : null}

      {papicError === 'min_extras' ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Add at least one extra camera.
        </p>
      ) : papicError === 'min_cameras' ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Please pick at least {PAPIC_MIN_PAID_CAMERAS} camera
          {PAPIC_MIN_PAID_CAMERAS === 1 ? '' : 's'}.
        </p>
      ) : papicError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Something went wrong — please try again.
        </p>
      ) : null}

      {limitedError === 'no_guests' ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Add your guests first — Limited cameras come from the guest list.
        </p>
      ) : limitedError === 'below_min' ? (
        <p className={neutral}>
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          Your first {formatCount(PAPIC_FREE_CAMERA_COUNT)} cameras are free — you&rsquo;re
          covered. Paid Limited starts at a {PAPIC_MIN_PAID_CAMERAS}-guest list.
        </p>
      ) : limitedError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          Could not activate Limited — please try again.
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
            : 'Adding photos by hand is off. Only what your cameras capture goes into the gallery.'}
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
