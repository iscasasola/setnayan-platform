import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { notFound, redirect } from 'next/navigation';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Hand,
  Sparkles,
  Info,
  ChevronRight,
  HardDrive,
  Smartphone,
  CircleHelp,
  CheckCircle2,
  Clock,
  Cloud,
  ExternalLink,
  FolderTree,
  Lock,
  Unlink2,
  Users,
  BatteryWarning,
  QrCode,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { eventSkuActive } from '@/lib/entitlements';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import {
  getDriveOAuthConfig,
  PAPIC_DRIVE_SUBFOLDERS,
} from '@/lib/papic-drive';
import { fetchPapicGallery, fetchPreservationTotals } from '@/lib/papic-gallery';
import { viewerSeesCoupleScopedPapic } from '@/lib/papic-gallery-scope';
import { PapicGalleryGrid } from './_components/papic-gallery-grid';
import { WhereYouStand } from './_components/where-you-stand';
import { getKwentoDensity } from '@/lib/kwento-density';
import {
  resolveStoredWindow,
  formatWindowSummary,
  PAPIC_CAPTURE_MONTHS_BEFORE,
} from '@/lib/papic-window';
import PapicWindowPicker from './papic-window-picker';
import StylePicker from './style-picker';
import { VendorChallengesApproval } from './vendor-challenges-approval';
import { CoupleChallengesManager } from './couple-challenges-manager';
import {
  fetchCameraRates,
  papicRungRate,
  papicRungSku,
  isPapicUncapped,
  provisionFreeCamerasAdmin,
  PAPIC_MIN_PAID_CAMERAS,
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_MINI_CAP_FALLBACK_PHP,
  PAPIC_LTD_CAP_FALLBACK_PHP,
  PAPIC_UNLI_CAP_FALLBACK_PHP,
  PAPIC_RUNGS,
} from '@/lib/papic-cameras';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { ensureFreePapicOneCameraAdmin, fetchPapicOneTiers } from '@/lib/papic-one';
// Per-rung display titles + capture-POINT budgets. ONE reader for the whole app
// (`lib/papic-tier-copy.ts`, #3421) — derived from the admin-editable
// papic_tier_config, never spelled here (owner 2026-07-20). It serves BOTH the
// guest-camera picker's capacity copy and the extra-cameras rung ladder.
import { fetchPapicTierConfig } from '@/lib/papic-tier-copy';
import {
  countLimitedGuests,
  computeLimitedQuote,
  fetchActiveLimitedSnapshot,
  reconcileLimitedSnapshot,
  syncGuestCameras,
  type LimitedSnapshotStatus,
} from '@/lib/papic-limited';
import ExtraCamerasPicker from './extra-cameras-picker';
import GuestCameraTierPicker from './guest-camera-tier-picker';
import { LiveWallCard } from './_components/live-wall-card';
import { PoolGalleryCard } from './_components/pool-gallery-card';
import { MagazineCard } from './_components/magazine-card';
import { RecapCard } from './_components/recap-card';
import {
  DriveSafetyPanel,
  DriveReconnectBanner,
} from '@/app/_components/drive-connect-card';
import { SubmitButton } from '@/app/_components/submit-button';
import { HostPoolMeterCard } from './_components/host-pool-meter-card';
import { GuestContributionsCard } from './_components/guest-contributions-card';
import { PapicCamerasCard } from './_components/papic-cameras-card';
import { PapicPoolCard } from './_components/papic-pool-card';
import { VendorMediaControls } from './_components/vendor-media-controls';
import { FaceTaggingChoice } from './_components/face-tagging-choice';
import { GuestCamerasChoice } from './_components/guest-cameras-choice';
import { resolvePapicRoom, PAPIC_ROOM_TABS } from './_lib/rooms';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { groupIntoChapters } from '@/lib/alaala-chapters';
import { fetchScheduleBlocks, DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { LifeFlashCard } from './_components/life-flash-card';

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
    papic_purchased?: string;
    papic_order?: string;
    papic_ref?: string;
    papic_amount?: string;
    papic_error?: string;
    papic_one_error?: string;
    papic_pool_error?: string;
    shots_error?: string;
    shots_set?: string;
    papic_unlock_provisioned?: string;
    limited_synced?: string;
    limited_error?: string;
    papic_window_saved?: string;
    papic_window_error?: string;
    /** Which room to open — see _lib/rooms.ts. Anything unrecognised is ignored. */
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
  }>;
};


type DriveGrant = {
  grant_id: string;
  external_account_display: string | null;
  granted_at: string;
  connection_health: 'ok' | 'needs_reauth' | null;
  metadata: {
    drive_folder_name?: string;
    drive_subfolders?: Array<{ name: string; id: string }>;
    account_name?: string;
  } | null;
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
  // ⚠ THE WHOLE OBJECT IS KEPT, not just the destructured names. `resolvePapicRoom`
  // reads the outcome params to decide which room a redirect lands in, and it
  // must see every key — a second hand-maintained copy of that list is how one
  // gets forgotten.
  const search = await searchParams;
  const {
    drive_connected: driveConnected,
    drive_disconnected: driveDisconnected,
    drive_error: driveError,
    papic_access_error: papicAccessError,
    papic_purchased: papicPurchased,
    papic_order: papicOrder,
    papic_ref: papicRef,
    papic_amount: papicAmount,
    papic_error: papicError,
    papic_one_error: papicOneError,
    papic_pool_error: papicPoolError,
    shots_error: shotsError,
    shots_set: shotsSet,
    papic_unlock_provisioned: papicUnlockProvisioned,
    limited_synced: limitedSynced,
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, event_type, event_date, papic_storage_target, papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, papic_window_start, papic_window_end',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event this page reads against. Refused, it degrades rather than claiming.
  if (eventError) {
    logQueryError('PapicStudioPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) notFound();

  // Event-wide Papic look (the couple's locked capture template). Read
  // defensively: the papic_style column lands in migration 20270307004141, so
  // on a pre-migration DB this select returns an error (not a throw) and we keep
  // the ORIG default — the page never breaks on the new column.
  const { data: styleRow, error: styleRowError } = await supabase
    .from('events')
    .select('papic_style')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the couple's chosen Papic style. Refused, it silently reverts to the default,
  // ⚠ so a choice they made is replaced by one they did not.
  if (styleRowError) {
    logQueryError('PapicStudioPage.styleRow', styleRowError, { eventId }, 'graceful_degrade');
  }
  const papicStyle =
    (styleRow as { papic_style?: string } | null)?.papic_style ?? 'ORIG';

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
  const grantRaw = await supabase
    .from('oauth_grants')
    .select('grant_id, external_account_display, granted_at, connection_health, metadata')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle()
    .then((r) => r.data ?? null);
  const driveGrant = (grantRaw ?? null) as DriveGrant | null;

  const driveConfig = await getDriveOAuthConfig();
  const driveOAuthReady = driveConfig.ready;

  // Live admin-managed rates + per-tier caps.
  const cameraRates = await fetchCameraRates(supabase);
  const papicTierConfig = await fetchPapicTierConfig(supabase);
  // The LIFETIME bucket each per-camera rung actually grants. Read from
  // papic_one_tiers because that is the table papic_grant_camera_points()
  // reads on approval — see the comment on `rungPoints` below.
  const papicOneTiers = await fetchPapicOneTiers(supabase);
  // Per-tier cost caps apply to WEDDINGS ONLY (owner 2026-07-17); every other
  // event type is uncapped. Mirror the charge path (studio/papic/actions.ts →
  // isPapicUncapped), which passes MAX_SAFE_INTEGER, so the picker quote never
  // diverges from the bill. The guest-list Limited tier IS the roll/Mini tier,
  // so it reads the MINI cap — not the (dormant) Ltd cap.
  const uncappedEvent = isPapicUncapped(
    (event as Record<string, unknown>).event_type as string | null,
  );

  // The couple's word for their own event. Papic ships on all 16 event types
  // (owner-locked 2026-07-27), but this page still greeted every one of them
  // with "Wedding photo capture" and offered "unlimited cameras for the whole
  // wedding" — read by a birthday host, a reunion organiser, or the host of a
  // Simple Event, whose type exists precisely BECAUSE it is not a wedding.
  // `terminology.event_word` is the shipped per-type noun; nothing new.
  const papicEventWord =
    ((event as Record<string, unknown>).event_type as string | null) === 'wedding'
      ? 'wedding'
      : 'event';
  const papicMiniCapPhp = uncappedEvent
    ? Number.MAX_SAFE_INTEGER
    : Number((event as Record<string, unknown>).papic_mini_cap_php ?? 0) ||
      PAPIC_MINI_CAP_FALLBACK_PHP;
  const papicLtdCapPhp = uncappedEvent
    ? Number.MAX_SAFE_INTEGER
    : Number((event as Record<string, unknown>).papic_ltd_cap_php ?? 0) ||
      PAPIC_LTD_CAP_FALLBACK_PHP;
  const papicUnliCapPhp = uncappedEvent
    ? Number.MAX_SAFE_INTEGER
    : Number((event as Record<string, unknown>).papic_unli_cap_php ?? 0) ||
      PAPIC_UNLI_CAP_FALLBACK_PHP;
  // Per-rung cap the extra-cameras ladder quotes against (titles + point
  // budgets come from the single papicTierConfig read above).
  const papicRungCapPhp: Record<(typeof PAPIC_RUNGS)[number], number> = {
    mini: papicMiniCapPhp,
    ltd: papicLtdCapPhp,
    unlimited: papicUnliCapPhp,
  };

  // Capture window → DAYS multiplier (price) + the picker's current state.
  const ev = event as Record<string, unknown>;
  const papicWindow = resolveStoredWindow({
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
    eventDate: (ev.event_date as string | null) ?? null,
  });
  const papicDays = papicWindow.days;
  const papicWindowSummary = formatWindowSummary(
    papicWindow.startIso,
    papicWindow.endIso,
  );
  const windowIsSet = !!(ev.papic_window_start && ev.papic_window_end);

  // ⚠ WHICH ROOM THIS REQUEST OPENS ON. Pure, and unit-tested in _lib/rooms.ts:
  // an explicit tab wins, then the outcome the action just redirected with, then
  // where the couple is in the event.
  const room = resolvePapicRoom({
    requested: search.tab,
    outcomes: search,
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
  });

  // Unlock-all umbrella (admin-managed price; owning it frees Unli).
  const unlockAdmin = createAdminClient();
  const [
    { data: unlockPkg, error: unlockPkgError },
    ownsPapicUnlock,
    ownsPapicUnlockLtd,
    papicPlatformSettings,
    { data: keepFullResRow, error: keepFullResRowError },
    ownsKeepFullRes,
  ] = await Promise.all([
    unlockAdmin
      .from('platform_package_catalog')
      .select('retail_price_php, is_active')
      .eq('package_code', 'PAPIC_UNLOCK')
      .maybeSingle(),
    eventSkuActive(unlockAdmin, eventId, 'PAPIC_UNLOCK'),
    // The ₱9,000 twin frees the ₱30 rung it was sold against — today's Mini
    // (legacy 'roll'). It does NOT cover the new ₱50 Ltd rung. See
    // lib/papic-cameras.ts CameraQuoteOpts.
    eventSkuActive(unlockAdmin, eventId, 'PAPIC_UNLOCK_LTD'),
    fetchPlatformSettings(supabase),
    // Keep Full-Res archive (owner 2026-07-11) — sold on the existing apply-then-pay.
    unlockAdmin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, is_active')
      .eq('service_code', 'HIGH_RES_ARCHIVE')
      .maybeSingle(),
    eventSkuActive(unlockAdmin, eventId, 'HIGH_RES_ARCHIVE'),
  ]);
  if (unlockPkgError) {
    logQueryError('PapicPage.unlockPkg', unlockPkgError, { event_id: eventId }, 'graceful_degrade');
  }
  if (keepFullResRowError) {
    logQueryError('PapicPage.keepFullResRow', keepFullResRowError, { event_id: eventId }, 'graceful_degrade');
  }
  const papicUnlockPricePhp = unlockPkg?.is_active
    ? Number(unlockPkg.retail_price_php)
    : null;
  const keepFullResPricePhp = keepFullResRow?.is_active
    ? Number(keepFullResRow.retail_price_php)
    : null;

  // FREE cameras — "always 3 seats / event" (owner 2026-07-17 · brief PR-3).
  // Idempotent render-time top-up (the same lazy pattern syncGuestCameras uses
  // below): materializes the 3 tier='free' seats at indexes 100..102 so the
  // capture-points gate has real seats to meter — the advertised free allowance
  // is ENFORCED at the seams, never display-only. Best-effort (returns 0 on any
  // hiccup; the next render retries). Their claim links live on /crew.
  await provisionFreeCamerasAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // FREE POOL — the other half of the free tier, and the SELF-HEAL for it.
  // The 3 seats above are useless without points: with no grant at all,
  // papic_event_pool_status() returns applies=FALSE and papic_reserve_event_points()
  // takes its "fence absent -> allow, ledger untouched" branch, so capture runs
  // UNMETERED. Every event-creation path now arms this at commit; this call is the
  // backstop that catches (a) every event created before 20271017100000 that the
  // backfill somehow missed and (b) any creation-time write that failed its
  // best-effort attempt. Idempotent — the partial unique index collapses repeats.
  await ensureFreePapicPoolGrantAdmin(unlockAdmin, eventId);
  // …and the ONE free Papic ONE camera: a dedicated camera with its own QR and
  // its own 5 unshared points (owner-locked 2026-07-29). Armed alongside the
  // shared pool because the two are different products — the pool grant does
  // NOT create a camera, and a couple with no camera has nothing to try. SQL-side
  // idempotent (fixed seat index + a partial unique index on the grant), so the
  // creation call and the studio self-heal collapse to one camera.
  await ensureFreePapicOneCameraAdmin(unlockAdmin, eventId);

  // ── LIMITED (guest-list) state ──────────────────────────────────────────
  // Auto-count = guests who haven't declined. One reversible snapshot freezes
  // the bill; render-time sync keeps cameras in line with late RSVPs (free,
  // within the cap).
  const limitedGuestCount = await countLimitedGuests(supabase, eventId);
  const limitedSnapshot = await fetchActiveLimitedSnapshot(supabase, eventId);
  let limitedStatus: LimitedSnapshotStatus | null = limitedSnapshot?.status ?? null;
  // ⚠ A COUNT IS THE SAME DEFECT WEARING A DIFFERENT DESTRUCTURE. Supabase
  // ⚠ RESOLVES with { error } rather than throwing, so a refused count arrives
  // ⚠ as `count: null`, `?? 0` makes it a zero, and the tile below tells a
  // ⚠ couple whose guests all hold a camera that "0 cameras" are ready.
  let guestCameraCount: number | null = 0;
  {
    const { count, error: guestCameraCountError } = await supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('guest_id', 'is', null)
      .is('revoked_at', null);
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
  const limitedQuote = computeLimitedQuote(
    limitedGuestCount,
    cameraRates.roll,
    papicMiniCapPhp,
    papicDays,
  );
  // The Unlimited-tier option for the same guest list (owner 2026-06-26) — same
  // capture-window day multiplier as the Limited quote.
  const unlimitedQuote = computeLimitedQuote(
    limitedGuestCount,
    cameraRates.unlimited,
    papicUnliCapPhp,
    papicDays,
  );
  const limitedTier = (limitedSnapshot?.tier ?? null) as 'roll' | 'unlimited' | null;

  // Anonymous Unlimited extras (off-list shooters → claim links in /crew).
  let extraCameraCount: number | null = 0;
  {
    const { count, error: extraCameraCountError } = await supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('tier', 'unlimited')
      .is('revoked_at', null);
    if (extraCameraCountError) {
      logQueryError(
        'PapicPage.extraCameraCount',
        extraCameraCountError,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    extraCameraCount = extraCameraCountError ? null : count ?? 0;
  }

  // Claim-link cameras — every seat that carries its own QR (the free pool
  // cameras, the free Papic One, and any paid extras). Counted here so the QR
  // tile below can say how many are ready and how many are still unclaimed,
  // rather than sending the couple to a page to find out.
  let claimLinkTotal = 0;
  let claimLinkUnclaimed = 0;
  {
    const { data: seatRows, error: seatRowsError } = await supabase
      .from('paparazzi_seats')
      .select('claimer_user_id')
      .eq('event_id', eventId)
      .is('revoked_at', null);
    // ⚠ THE CAMERAS THE COUPLE HANDED OUT. Refused, the crew list empties and every
    // ⚠ seat they set up reads as never claimed — their own setup, gone.
    if (seatRowsError) {
      logQueryError('PapicStudioPage.seatRows', seatRowsError, { eventId }, 'graceful_degrade');
    }
    const rows = seatRows ?? [];
    claimLinkTotal = rows.length;
    claimLinkUnclaimed = rows.filter((r) => !r.claimer_user_id).length;
  }

  return (
    <section className="space-y-7 pb-12">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      {/* Header — short. */}
      {/*
        ⚖ NAME AND PROMISE, BUT NO PRICE — AND THE ABSENCE IS THE DECISION.
        The brief asked every buy page to open with "product name, one-line
        promise, price". Measured, this page does not have *a* price: it sells a shot ladder, a Keep Full-Res
        subscription and an unlock-everything bundle, side by side.
        Hoisting one of them above the fold would say the page costs that, which
        is the opposite of honest. So the figures stay beside the exact thing
        each one buys, and the hero does the half it can do truthfully.
      */}
      <StudioBuyHero productName={PAPIC_HERO.label} promise={PAPIC_HERO.blurb} />

      {/* ⚠ THE STRIP SITS BELOW StatusBanners ON PURPOSE. A confirmation must be
          visible whichever room resolves — if the outcome→room map ever misses a
          case, the couple still sees that their change saved, in the wrong room
          rather than nowhere. Belt and braces, cheaply. */}
      <nav className="sn-seg" aria-label="Papic sections">
        {PAPIC_ROOM_TABS.map((t) => (
          <Link
            key={t.room}
            href={`/dashboard/${eventId}/studio/papic?tab=${t.room}`}
            className="sn-seg-item"
            aria-current={room === t.room ? 'page' : undefined}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <StatusBanners
        driveConnected={!!driveConnected}
        driveDisconnected={!!driveDisconnected}
        driveError={driveError}
        papicAccessError={papicAccessError}
        connectedAccount={driveGrant?.external_account_display ?? null}
        eventId={eventId}
        papicPurchased={papicPurchased}
        papicOrder={papicOrder}
        papicRef={papicRef}
        papicAmount={papicAmount}
        papicUnlockProvisioned={papicUnlockProvisioned}
        papicError={papicError}
        limitedSynced={limitedSynced}
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
        preserveError={preserveError}
      />

      {/* ⚠ WHERE YOU STAND — four facts, above every room and above the ask.
          The order is deliberate: a person is told the state of their own
          celebration BEFORE anything asks them to decide something. Reversing
          it is how this screen came to open on a look picker. */}
      <WhereYouStand
        eventId={eventId}
        windowIsSet={windowIsSet}
        windowSummary={papicWindowSummary}
      />

      {/* ⚠ THE ONE REQUIRED ACT, IN WHATEVER ROOM THE COUPLE LANDS IN.
          Owner, opening his own wedding's Papic page: *"entering papic inside an
          event needs to me simpler and better to manage. if I am a customer and
          I see this, I will be confused."*

          🔑 THE ROOMS FILE ALREADY CLAIMED THIS EXISTED. `resolvePapicRoom`
          sends a couple with no capture window to Set up, and its comment gave
          the reason: *"Unset means Set up, where the attention row is."* There
          was no attention row. The picker's ONLY mount was inside Cameras &
          shots — a room a new couple never lands in — so the single thing
          standing between them and a working camera was in the one place they
          could not see it. Measured 2026-08-26: all five production events have
          no window set, so EVERY couple who has ever opened Papic landed in a
          room that could not tell them what to do.

          It renders in all three rooms on purpose. Which room a person is in is
          not a reason to hide the only thing they must do. */}
      {!windowIsSet ? (
        <section className="overflow-hidden rounded-2xl border border-mulberry/25 bg-surface">
          <div className="h-[3px] w-full bg-mulberry" aria-hidden />
          <div className="space-y-3 p-5 sm:p-6">
            {/* ⚠ mulberry-600, NOT -700. The 700 slot flips to the LIGHT theme's
                #C24E25 on a dark panel and measures 3.05:1 there — a fail —
                while looking fine at 5.86:1 in light. 600 measures 4.92 light /
                5.78 dark. A light-only contrast check waves the bad one through;
                this repo has paid for that exact swap once already. */}
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-mulberry-600">
              Do this first · then the library fills itself
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              When can your cameras shoot?
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Nothing can be captured until you pick the days. Cameras can start up
              to {PAPIC_CAPTURE_MONTHS_BEFORE} months before your celebration, so
              they catch the preparations too.
            </p>
            <PapicWindowPicker
              eventId={eventId}
              eventType={(ev.event_type as string | null) ?? null}
              eventDate={(ev.event_date as string | null) ?? null}
              windowStart={(ev.papic_window_start as string | null) ?? null}
              windowEnd={(ev.papic_window_end as string | null) ?? null}
              windowIsSet={windowIsSet}
              days={papicDays}
              summary={papicWindowSummary}
            />
          </div>
        </section>
      ) : null}

      {/* Photos — the room they come back to for years. */}
      {room === 'photos' ? (
        <>
        {/* ── Keep Full-Res (owner 2026-07-11 · sold on apply-then-pay) ─────── */}
        {ownsKeepFullRes ? (
          <section className="rounded-2xl border border-success-200/70 bg-success-50/50 p-4 text-xs text-ink/70">
            ✓ <span className="font-medium text-ink">Keep Full-Res is active</span> — we
            keep every full-resolution original for this event, undegraded.
          </section>
        ) : keepFullResPricePhp ? (
          <section className="flex flex-wrap items-center justify-between gap-3 sn-tile p-5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-mulberry" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">Keep your full-res originals</h2>
              </div>
              {/* ⚠ Said "After 3 months" — the clock became SIX months on
                  2026-08-02 and this card was never updated. It is dormant today
                  (it renders only while the Keep Full-Res SKU is active, and that
                  is switched off), so nobody has read the wrong number — but a
                  dormant screen with a stale number is a landmine for whenever
                  the owner flips the SKU back on. */}
              <p className="text-xs text-ink/60">
                Your online gallery stays free, for life. After 6 months we keep a
                beautiful compressed copy, and your full-resolution originals live in
                your own Google Drive. Want us to keep every pristine original too?
              </p>
            </div>
            {papicPlatformSettings ? (
              <InlineCheckoutDrawer
                eventId={eventId}
                serviceKey="HIGH_RES_ARCHIVE"
                displayName="Keep Full-Res"
                originalPriceCentavos={String(Math.round(keepFullResPricePhp * 100))}
                settings={papicPlatformSettings}
                triggerLabel={`Keep Full-Res · ${formatPhp(keepFullResPricePhp)}/yr`}
                triggerClassName="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-mulberry/40 px-4 py-2.5 text-sm font-medium text-mulberry hover:bg-mulberry/5"
              />
            ) : (
              <span className="shrink-0 font-mono text-sm text-ink/60">
                {formatPhp(keepFullResPricePhp)}/yr
              </span>
            )}
          </section>
        ) : null}

        {/* Gallery. */}
        <GalleryPreviewCard eventId={eventId} />

        {/* Two levers the couple holds over their own photos, side by side
            because they answer the same question — what happens to pictures of my
            guests. Each renders nothing when it has nothing to offer. */}
        <VendorMediaControls eventId={eventId} />
        {/* Moderation — a slim, real action. */}
        <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="flex items-center gap-2 text-sm text-ink/75">
            <Lock aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
            Review guest photos — hide, report, or block a camera.
          </p>
          <Link
            href={`/dashboard/${eventId}/studio/papic/moderation`}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-mulberry hover:text-mulberry-600"
          >
            Open moderation
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </section>

        {/* Shared Pool Gallery — couple-only open/close (build ⑥). Self-gates on
            the env flag + Papic-active; renders nothing until both hold. */}
        <PoolGalleryCard eventId={eventId} />

        <MagazineCard eventId={eventId} />
        <RecapCard eventId={eventId} />
        <LifeFlashCard eventId={eventId} />

        </>
      ) : null}

      {/* Cameras & shots — the room they run the day from. */}
      {room === 'cameras' ? (
        <>
        {/* Unlock-all — the one-price headline (only when not yet owned). */}
        {papicUnlockPricePhp && !ownsPapicUnlock ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Everything Papic, one price
              </h2>
              <p className="max-w-prose text-sm text-ink/70">
                Unlimited cameras for the whole {papicEventWord} + every add-on (Kwento,
                Photo Wall, Thank You, Stories, Camera Bridge).
              </p>
            </div>
            {papicPlatformSettings ? (
              <InlineCheckoutDrawer
                eventId={eventId}
                serviceKey="PAPIC_UNLOCK"
                displayName="Unlock all of Papic"
                originalPriceCentavos={String(Math.round(papicUnlockPricePhp * 100))}
                settings={papicPlatformSettings}
                triggerLabel={`Unlock all · ${formatPhp(papicUnlockPricePhp)}`}
                triggerClassName="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70"
              />
            ) : (
              <span className="shrink-0 font-mono text-sm text-ink/60">
                {formatPhp(papicUnlockPricePhp)}
              </span>
            )}
          </section>
        ) : null}

        {/* ── Your cameras — the core. ──────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Camera aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            <h2 className="text-xl font-semibold tracking-tight">Your cameras</h2>
          </div>

          {/* ── HOW PEOPLE ACTUALLY START SHOOTING. ─────────────────────────
              Owner, 2026-08-01: "i cannot find the qr for the papic services."
              They were not missing — they were behind a small text link tucked
              into the header of the off-guest-list tile, two sections down. The
              QR is the whole mechanic of Papic, so it gets its own block, at the
              top of Your cameras, with the counts resolved here rather than
              making the couple open a page to discover them. */}
          {claimLinkTotal > 0 ? (
            <div className="sn-tile flex flex-wrap items-center justify-between gap-3 border border-terracotta/30 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <QrCode aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
                  Camera QR codes
                </p>
                <p className="mt-0.5 max-w-prose text-xs text-ink/60">
                  {claimLinkUnclaimed > 0
                    ? `${claimLinkUnclaimed} of ${claimLinkTotal} still to hand out. `
                    : `All ${claimLinkTotal} claimed. `}
                  Each camera has its own QR and link — show it, they scan, they
                  shoot. Every shot draws from your shared pool.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/${eventId}/studio/papic/crew`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600"
                >
                  <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Show the QR codes
                </Link>
                <Link
                  href={`/dashboard/${eventId}/studio/papic/crew/print`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-2 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
                >
                  Print cards
                </Link>
              </div>
            </div>
          ) : null}

          {/* Capture window — sets the price (days) AND how long cameras shoot.
              ⚠ ONLY ONCE IT IS SET. While it is unset the picker lives in the
              do-this-first card above, which renders in EVERY room; showing it
              here as well would put two of the same picker on one page. */}
          {windowIsSet ? (
          <PapicWindowPicker
            eventId={eventId}
            eventType={(ev.event_type as string | null) ?? null}
            eventDate={(ev.event_date as string | null) ?? null}
            windowStart={(ev.papic_window_start as string | null) ?? null}
            windowEnd={(ev.papic_window_end as string | null) ?? null}
            windowIsSet={windowIsSet}
            days={papicDays}
            summary={papicWindowSummary}
          />
          ) : null}

          <LimitedCard
            eventId={eventId}
            guestCount={limitedGuestCount}
            guestCameraCount={guestCameraCount}
            status={limitedStatus}
            currentTier={limitedTier}
            limitedQuote={limitedQuote}
            unlimitedQuote={unlimitedQuote}
            limitedPointsPerDay={papicTierConfig.roll.pointsPerDay}
            unlimitedPointsPerDay={papicTierConfig.unlimited.pointsPerDay}
            days={papicDays}
            windowSummary={papicWindowSummary}
          />

          {/* Unlimited extras — the only off-list path. */}
          <div className="sn-tile p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Add a camera that isn&rsquo;t on the guest list
                </p>
                <p className="text-xs text-ink/60">
                  A videographer friend, a hired second shooter — pick their tier.
                  {extraCameraCount !== null && extraCameraCount > 0
                    ? ` ${extraCameraCount} active.`
                    : ''}
                </p>
              </div>
              <Link
                href={`/dashboard/${eventId}/studio/papic/crew`}
                className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:text-terracotta-700"
              >
                {/* ⚠ SAY "QR". This read "Crew & claim links", and the QR codes +
                    the printable cards live behind it — so the word never appeared
                    anywhere on the path to them, and the owner could not find the
                    QRs at all. The page they open is titled "Your photo crew" and
                    renders a QR per camera; the label just never said so. */}
                Camera QR codes &amp; claim links
                <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
            <div className="max-w-sm">
              <ExtraCamerasPicker
                eventId={eventId}
                // ⚠ FILTER BEFORE MAP. PAPIC_RUNGS is a static vocabulary of every
                // rung the code can SPEAK, not a list of what is on SALE — the
                // sale list is `papic_tier_config.is_active`, which an admin
                // edits without a deploy. Mapping the constant straight to the
                // picker put both RETIRED rungs on a live buy button: 'ltd'
                // (migration 20270828150000) and 'unlimited' (20270830568357) are
                // both is_active=false, as are their catalog price rows — so they
                // quoted ₱50 / ₱200 off the fail-closed FALLBACK constants in
                // lib/papic-cameras.ts, which exist so a retired rung cannot
                // quote ₱0, not so it can keep selling. It also broke the
                // 2026-07-30 naming lock: "Papic Ltd" and "Papic Max" are not
                // products, and only Pool and One may appear on a display surface.
                rungs={PAPIC_RUNGS.filter((rung) => papicTierConfig[rung].isActive).map(
                  (rung) => ({
                    rung,
                    title: papicTierConfig[rung].displayTitle,
                    ratePhp: papicRungRate(cameraRates, rung),
                    // ⚠ THE BUCKET, FROM THE TABLE THE GRANT READS.
                    //
                    // This used to pass `papic_tier_config.points_per_day` — the
                    // OLD per-camera-per-DAY meter, whose 'mini' row is NULL on
                    // prod. NULL reads as "unlimited" to every copy helper, so the
                    // picker advertised "No limit · archived to your Drive" on a
                    // ₱50 camera. It is not unlimited: the approval path
                    // `papic_grant_camera_points()` grants
                    // `papic_one_tiers[PAPIC_CAMERA_MINI_DAY].points` per seat —
                    // 50 on prod — and the fail-closed reserve stops the shutter
                    // there. So the picker sold unlimited and delivered 50, on the
                    // SAME screen as the Papic One card correctly saying "50
                    // shots". Reading the rung table is what makes the claim true
                    // (lib/papic-tier-config-read.ts says so in its own header).
                    points:
                      papicOneTiers.find((t) => t.serviceCode === papicRungSku(rung))
                        ?.points ?? null,
                    capPhp: papicRungCapPhp[rung],
                    // PAPIC_UNLOCK frees Unli · PAPIC_UNLOCK_LTD frees the ₱30 Mini
                    // rung. Nothing frees the ₱50 Ltd rung today.
                    free:
                      rung === 'unlimited'
                        ? ownsPapicUnlock
                        : rung === 'mini'
                          ? ownsPapicUnlockLtd
                          : false,
                  }),
                )}
                days={papicDays}
                windowSummary={papicWindowSummary}
              />
            </div>
          </div>

        </section>

        {/* Capture-pool meter (build ③ PR-1) — READ-ONLY, flag-dark behind
            NEXT_PUBLIC_PAPIC_POOL_BAR (default off → renders nothing). Self-gates
            flag → viewer-RLS membership → pool-applies. Mounted here, right under
            the cameras it meters — deliberately NOT in the add-on region below,
            which PR #3581 (PoolGalleryCard) is concurrently editing. */}
        <HostPoolMeterCard eventId={eventId} />

        {/* Papic ONE — buy a dedicated camera, or RELOAD one that already exists
            (owner-locked 2026-07-29). Mounted right under the pool meter because
            the two are the two halves of the model: the meter is the SHARED pool,
            this is the camera that does not share. Minimal by design — the
            polished card ships with the onboarding cards; what could not wait is
            the doorway, because the free One camera is armed for every event from
            this PR onward and a camera nobody can reload is a dead end. */}
        {/* Papic POOL — the buy path for the SHARED pool (2026-07-31). Mounted
            ABOVE the One card because Pool is the product a couple meets first:
            the free 50-pt grant is a pool grant, the onboarding services card
            leads with the Pool ladder, and the Suite CTA that lands here reads
            "Open the pool". Until now this page answered that CTA with a One
            camera and nothing else — the Pool ladder was advertised in two live
            places and buyable in none, while all three PAPIC_GUEST* rows sat
            is_active=true and `grantPapicPassPoints` sat wired and unreachable.
            Self-gating to null when no rung has a live catalog price. */}
        <PapicPoolCard eventId={eventId} error={papicPoolError ?? null} />

        {/* YOUR CAMERAS — hand shots to one camera's QR, or take unspent ones
            back (owner 2026-08-11). This replaced the Papic One buy card: a
            dedicated camera is no longer bought, it is made out of shots the
            couple already owns. Mounted directly under the buy card because the
            two are one flow now — buy shots above, share them out below.
            `papicOneError` is still read from the URL above so a redirect from
            an order minted before the change still finds somewhere to land. */}
        <PapicCamerasCard
          eventId={eventId}
          error={shotsError ?? papicOneError ?? null}
          justSet={shotsSet ?? null}
        />

        {/* Guests chipped in (owner-locked 2026-07-29) — flag-dark behind
            NEXT_PUBLIC_PAPIC_GUEST_BUY, self-gating to null when off, when the
            viewer is not a member, or when no guest has bought anything. Sits
            directly under the two cards it reports on, because a guest's purchase
            lands in exactly one of them: a pool top-up in the meter above, a One
            reload on the camera card. NOTIFICATION ONLY — there is no control
            here, deliberately: the host is told, not asked. */}
        <GuestContributionsCard eventId={eventId} />

        <GuestCamerasChoice eventId={eventId} />

        </>
      ) : null}

      {/* Set up — the choices they make once, months before. */}
      {room === 'setup' ? (
        <>
        {/* Your Papic look — the event-wide capture template the couple picks
            once. Baked into every camera's photos (seats, guests) on
            device at capture. Shooters never see a picker. */}
        <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
              <Sparkles aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
              Your Papic look
            </p>
            <p className="max-w-prose text-sm text-ink/65">
              Choose one look for your whole event. Every photo your crew and
              guests capture gets it automatically, so your gallery feels like one
              beautiful set.
            </p>
          </div>
          <StylePicker eventId={eventId} current={papicStyle} />
        </section>

        {/* Yours to keep — Google Drive as an OFFER, not a destination choice.
            Owner 2026-08-26: "i was thinking of not asking for setnayan storage?
            what we want is to offer them to sync this to a google drive." The
            either/or it replaced never worked: no capture or storage path has
            ever read events.papic_storage_target, so "Use my Google Drive only"
            was never Drive-only and every photo has always landed in Setnayan
            storage. We hold the photos; Drive is a copy on top. */}
        <DriveCopyCard
          eventId={eventId}
          driveOAuthReady={driveOAuthReady}
          driveGrant={driveGrant}
          loginEmail={user.email ?? null}
        />

        <FaceTaggingChoice eventId={eventId} />

        {/* Papic Games — the couple's own challenge authoring + curation (§5).
            Self-gates on the flag. */}
        {/* The picker MOVED to /studio/papic/challenges (owner, 2026-08-21:
            "the need to have a real screen"). What is left here is a summary
            and a door — same component, `standalone` off, so the two can never
            disagree about how many are chosen. */}
        <CoupleChallengesManager eventId={eventId} />

        {/* Papic Games — pending vendor challenges awaiting the couple's okay (§3.6).
            Self-gates on the flag + hides when there's nothing to review. */}
        <VendorChallengesApproval eventId={eventId} />

        {/* Add-on services (shipped surfaces). */}
        <LiveWallCard eventId={eventId} />

        {/* Setup & help — folded away. */}
        <details className="group sn-tile">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-medium text-ink/80 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <CircleHelp aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
              Setup &amp; help — DSLR pairing, the shutter, capture defaults
            </span>
            <ChevronRight
              aria-hidden
              className="h-4 w-4 text-ink/50 transition-transform group-open:rotate-90"
              strokeWidth={2}
            />
          </summary>
          <div className="space-y-6 border-t border-ink/10 p-5">
            <DslrBridgeSection />
            <ShutterSection />
            <CaptureDefaultsSection />
          </div>
        </details>

        </>
      ) : null}

      <MiniTour tourKey="customer_papic_v1" />
    </section>
  );
}

// -----------------------------------------------------------------------------
// LIMITED (guest-list) card
// -----------------------------------------------------------------------------

function LimitedCard({
  eventId,
  guestCount,
  guestCameraCount,
  status,
  currentTier,
  limitedQuote,
  unlimitedQuote,
  limitedPointsPerDay,
  unlimitedPointsPerDay,
  days,
  windowSummary,
}: {
  eventId: string;
  guestCount: number;
  guestCameraCount: number | null;
  status: LimitedSnapshotStatus | null;
  currentTier: 'roll' | 'unlimited' | null;
  limitedQuote: ReturnType<typeof computeLimitedQuote>;
  unlimitedQuote: ReturnType<typeof computeLimitedQuote>;
  /** Daily capture-POINT budgets from papic_tier_config (null = unlimited). */
  limitedPointsPerDay: number | null;
  unlimitedPointsPerDay: number | null;
  days: number;
  windowSummary: string;
}) {
  const dayLabel = windowSummary || `${days} day${days === 1 ? '' : 's'}`;
  const active = status === 'active';
  const pending = status === 'pending_payment';
  const live = active || pending;
  const tierLabel = currentTier === 'unlimited' ? 'Unlimited' : 'Limited';

  return (
    <div className="sn-tile border border-terracotta/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            A camera for every guest
          </p>
          <p className="max-w-prose text-xs text-ink/60">
            Everyone who hasn&rsquo;t declined gets their own camera + gallery —
            their invite QR is the camera. Pick Limited or Unlimited for the whole
            list.
          </p>
        </div>
        {live ? (
          <span
            className={
              active
                ? 'inline-flex shrink-0 items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900'
                : 'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-800'
            }
          >
            {active ? (
              <>
                <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                {tierLabel} · active
              </>
            ) : (
              <>
                <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
                Payment under review
              </>
            )}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-ink">
          {guestCount}
        </span>
        <span className="text-sm text-ink/60">
          guest{guestCount === 1 ? '' : 's'} → {guestCount} camera
          {guestCount === 1 ? '' : 's'}
        </span>
      </div>

      {live ? (
        <p className="mt-2 text-sm text-ink/70">
          {guestCameraCount === null ? (
            <>
              We couldn&rsquo;t count your guests&rsquo; cameras just now &mdash;
              this does not mean there are none, and nobody has lost one.
            </>
          ) : (
            <>
              {guestCameraCount} camera{guestCameraCount === 1 ? '' : 's'} ready.
              New &ldquo;yes&rdquo; RSVPs are added automatically &mdash; no
              extra charge.
            </>
          )}
        </p>
      ) : null}

      {!live && guestCount < PAPIC_MIN_PAID_CAMERAS ? (
        <div className="mt-4 sn-row p-4 text-center">
          <p className="text-sm text-ink/65">
            {guestCount < 1
              ? 'Add your guests first — Limited cameras come from your guest list.'
              : `Your first ${PAPIC_FREE_CAMERA_COUNT} cameras are free — you’re covered. Paid cameras start at a ${PAPIC_MIN_PAID_CAMERAS}-guest list.`}
          </p>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-700"
          >
            {guestCount < 1 ? 'Go to guest list' : 'Add more guests'}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <GuestCameraTierPicker
          eventId={eventId}
          guestCount={guestCount}
          live={live}
          currentTier={currentTier}
          dayLabel={dayLabel}
          limited={{
            billPhp: limitedQuote.frozenBillPhp,
            ratePhp: limitedQuote.ratePhp,
            cameraCap: limitedQuote.cameraCap,
            pointsPerDay: limitedPointsPerDay,
          }}
          unlimited={{
            billPhp: unlimitedQuote.frozenBillPhp,
            ratePhp: unlimitedQuote.ratePhp,
            cameraCap: unlimitedQuote.cameraCap,
            pointsPerDay: unlimitedPointsPerDay,
          }}
        />
      )}
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
  connectedAccount,
  papicPurchased,
  papicOrder,
  papicRef,
  papicAmount,
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
}: {
  eventId: string;
  driveConnected: boolean;
  driveDisconnected: boolean;
  driveError: string | undefined;
  papicAccessError: string | undefined;
  connectedAccount: string | null;
  papicPurchased: string | undefined;
  papicOrder: string | undefined;
  papicRef: string | undefined;
  papicAmount: string | undefined;
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
    papicPurchased ||
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
    preserveError;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {papicPurchased ? (
        <div className={neutral}>
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          {/*
            🔴 THIS USED TO PROMISE AN EMAIL THAT DOES NOT EXIST. "Payment
            instructions are on the way" was on every one of these buy paths,
            and there is no `payment_instructions` notification type in the app —
            lib/notification-emit.ts says so in its own comment ("instructions go
            out via the checkout email path"), and none of these actions touches
            an email path. So the sentence sent the buyer away to wait for
            something that was never coming.

            🔑 THE INSTRUCTIONS ARE NOT "ON THE WAY" — THEY ARE ONE TAP AWAY.
            The order's own page already carries the total, the reference with a
            copy button, the BDO/GCash accounts and the form for telling us the
            transfer is made. Link to it rather than describe a message.

            Same defect the owner hit in onboarding on 2026-08-20: "i had a price
            to pay. but i there was no payment. it just created."
          */}
          <span>
            Order received{papicAmount ? ` — ${formatPhp(Number(papicAmount))} due` : ''}.
            Reference <span className="font-mono">{papicRef}</span>.{' '}
            {/*
              ONE link, not a ternary over two identical ones. The label is the
              thing a guard can count, and two copies of it meant deleting one
              left the other standing and the guard green — measured, not
              guessed. The branch belongs in the href, where it is a fallback:
              an older redirect still in someone's history carries no order id,
              and the orders list is the honest landing for it. Never nothing.
            */}
            <Link
              className="font-semibold underline underline-offset-2"
              href={
                papicOrder
                  ? `/dashboard/${eventId}/orders/${papicOrder}`
                  : `/dashboard/${eventId}/orders`
              }
            >
              See how to pay
            </Link>
            {' '}— your cameras activate once the Setnayan team confirms your transfer.
          </span>
        </div>
      ) : null}

      {papicUnlockProvisioned ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {papicUnlockProvisioned} Unlimited camera
          {papicUnlockProvisioned === '1' ? '' : 's'} added — free with Unlock all.
        </p>
      ) : null}

      {limitedSynced !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {Number(limitedSynced) > 0
            ? `${limitedSynced} new guest camera${limitedSynced === '1' ? '' : 's'} added from your list.`
            : 'Your guest cameras are up to date.'}
        </p>
      ) : null}

      {papicWindowSaved !== undefined ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Capture window saved — {papicWindowSaved} day
          {papicWindowSaved === '1' ? '' : 's'}. Your camera prices reflect it.
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
            ? 'That clip is no longer in your gallery.'
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
              ? 'Your vendors’ photos are hidden from your gallery.'
              : 'Your vendors’ photos are showing in your gallery.'}
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
          Your first {PAPIC_FREE_CAMERA_COUNT} cameras are free — you&rsquo;re
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

      {papicAccessError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            {papicAccessError === 'not_a_couple'
              ? 'Only the couple can change this celebration’s Papic settings.'
              : 'That didn’t go through — try again, or contact support.'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Yours to keep — the Google Drive copy offer
// -----------------------------------------------------------------------------

/**
 * ⚠ THIS REPLACED A CHOICE THAT NEVER DID ANYTHING.
 *
 * Until 2026-08-26 this card asked "Where your photos go" and offered a
 * radiogroup: Setnayan storage, or "Use my Google Drive only". Measured on
 * `origin/main` before the change, `events.papic_storage_target` was read by
 * exactly THREE files — the card that drew it, the actions that wrote it, and
 * the Drive disconnect route. **No capture, upload or storage path read it**,
 * and the comment describing that branch was still a `TODO(0012)`. So "only"
 * was never true: every photo has always landed in Setnayan storage, including
 * for the events sitting in `google_drive_only`.
 *
 * Owner ruling, verbatim: *"i was thinking of not asking for setnayan storage?
 * what we want is to offer them to sync this to a google drive."* Which is the
 * system as BUILT — we hold the photos, Drive is a copy on top. It also repairs
 * a promise the either/or broke: we tell couples we keep their gallery for
 * life, which is impossible for photos we never held.
 *
 * 🔑 The COLUMN is deliberately left in place. It is inert for capture, the
 * disconnect route still resets legacy `google_drive_only` rows, and dropping a
 * column to delete a question nobody is asked any more is risk with no payoff.
 */
function DriveCopyCard({
  eventId,
  driveOAuthReady,
  driveGrant,
  loginEmail,
}: {
  eventId: string;
  driveOAuthReady: boolean;
  driveGrant: DriveGrant | null;
  loginEmail: string | null;
}) {
  const connected = !!driveGrant;

  return (
    <article
      id="papic-storage"
      className="scroll-mt-20 space-y-4 sn-tile p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Cloud aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Send a copy to your Google Drive
          {!driveOAuthReady ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
              Coming soon
            </span>
          ) : connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
              <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Connected
            </span>
          ) : null}
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Every photo lands in your own Drive too, as it arrives — so you keep
          the originals at full size, on a drive you control. We keep your
          gallery either way.
        </p>
      </div>

      {!driveOAuthReady ? (
        <p className="text-xs italic text-ink/55">
          Coming soon — Setnayan&rsquo;s Drive verified-app review is in
          progress. Your photos are safe with us today; we&rsquo;ll email you
          when Drive is ready.
        </p>
      ) : connected ? (
        <DriveConnectedPanel eventId={eventId} grant={driveGrant!} loginEmail={loginEmail} />
      ) : (
        <DriveConnectCTA eventId={eventId} />
      )}
    </article>
  );
}

function DriveConnectCTA({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-3">
      <DriveSafetyPanel />
      <Link
        href={`/api/oauth/drive/start?event_id=${eventId}`}
        className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
      >
        <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Connect Google Drive
      </Link>
      <p className="text-xs text-ink/55">
        ~20 seconds. Connect once — it covers your recap and photographer hand-off too.
      </p>
    </div>
  );
}

async function DriveConnectedPanel({
  eventId,
  grant,
  loginEmail,
}: {
  eventId: string;
  grant: DriveGrant;
  loginEmail: string | null;
}) {
  const accountLabel = grant.external_account_display ?? 'Connected Drive';

  // The 2nd Drive (owner 2026-07-11 · up to 2 Drives per event). Queried here so
  // the connected panel can show its state without threading through 3 parents.
  const overflowSupabase = await createClient();
  const overflowGrant = (await overflowSupabase
    .from('oauth_grants')
    .select('external_account_display, connection_health')
    .eq('event_id', eventId)
    .eq('provider', 'drive_overflow')
    .is('revoked_at', null)
    .maybeSingle()
    .then((r) => r.data ?? null)) as {
    external_account_display: string | null;
    connection_health: 'ok' | 'needs_reauth' | null;
  } | null;

  // "Storage is full" detection: originals that exhausted every retry with a
  // Drive-quota error (Drive #1 full and no usable overflow, or BOTH full). The
  // web gallery is always safe on R2 — this only means some full-res didn't reach
  // Drive. Count is capped at 1 (head:true) — we only need "any".
  const strandedFull =
    (
      await overflowSupabase
        .from('drive_copy_artifacts')
        .select('artifact_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('drive_file_id', null)
        .gte('attempt_count', 5)
        .ilike('last_error_text', '%storageQuotaExceeded%')
    ).count ?? 0;
  const grantedDate = new Date(grant.granted_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const subfolders =
    grant.metadata?.drive_subfolders?.map((s) => s.name) ?? [...PAPIC_DRIVE_SUBFOLDERS];
  const folderName = grant.metadata?.drive_folder_name ?? 'Setnayan';
  const accountMismatch =
    !!grant.external_account_display &&
    !!loginEmail &&
    grant.external_account_display !== loginEmail;

  return (
    <div className="space-y-3">
      {grant.connection_health === 'needs_reauth' ? (
        <DriveReconnectBanner reconnectHref={`/api/oauth/drive/start?event_id=${eventId}`} />
      ) : null}

      {strandedFull > 0 ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-3 text-[12px] text-amber-900">
          <p className="font-medium">Your Drive is full.</p>
          <p className="mt-0.5 text-amber-800">
            Some full-resolution originals couldn&rsquo;t be saved to Drive — your
            online gallery is safe, but the full-res copies are waiting. Free up
            space{overflowGrant ? ' on either Drive' : ''}, or{' '}
            <Link
              href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
              className="font-medium underline underline-offset-2"
            >
              {overflowGrant ? 'connect more space' : 'connect a second Drive you own'}
            </Link>{' '}
            — they&rsquo;ll finish uploading automatically.
          </p>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-success-200/80 bg-success-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-ink">
              Connected to Google Drive as {accountLabel}
            </p>
            <p className="font-mono text-[11px] text-ink/55">Connected {grantedDate}</p>
            {accountMismatch ? (
              <p className="text-[11px] text-ink/60">
                Not your sign-in ({loginEmail}). That&rsquo;s fine — photos save to{' '}
                {grant.external_account_display}.{' '}
                <Link
                  href={`/api/oauth/drive/start?event_id=${eventId}&switch=1`}
                  className="font-medium text-mulberry underline-offset-2 hover:underline"
                >
                  Use a different account
                </Link>
              </p>
            ) : null}
            {overflowGrant ? (
              <div className="space-y-1 text-[11px]">
                <p className="text-ink/60">
                  2nd Drive connected as{' '}
                  <span className="font-medium text-ink/75">
                    {overflowGrant.external_account_display ?? 'your second Drive'}
                  </span>{' '}
                  — new photos overflow here once the first fills.
                </p>
                {overflowGrant.connection_health === 'needs_reauth' ? (
                  <p className="text-danger-600">
                    Your 2nd Drive needs to reconnect —{' '}
                    <Link
                      href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
                      className="font-medium underline underline-offset-2"
                    >
                      reconnect it
                    </Link>
                    .
                  </p>
                ) : null}
                <form action="/api/oauth/drive/disconnect" method="post">
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="slot" value="overflow" />
                  <SubmitButton
                    pendingLabel="Disconnecting…"
                    className="text-ink/45 underline underline-offset-2 transition-colors hover:text-ink/70"
                  >
                    Disconnect 2nd Drive
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <p className="text-[11px] text-ink/60">
                Running low on space? Full-resolution photos always live in your own
                Drive — if it fills up, add a second one.{' '}
                <Link
                  href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
                  className="font-medium text-mulberry underline-offset-2 hover:underline"
                >
                  Connect a second Drive you own
                </Link>
                . New photos overflow into it automatically once the first is full.
              </p>
            )}
          </div>
          <form action="/api/oauth/drive/disconnect" method="post">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Disconnecting…"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Disconnect
            </SubmitButton>
          </form>
        </div>

        <div className="rounded-lg border border-ink/10 bg-cream/80 p-3">
          <div className="flex items-center gap-1.5 text-ink/65">
            <FolderTree aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              Folder structure ready in your Drive
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-ink/85">Setnayan / {folderName} /</p>
          <ul className="mt-1 space-y-0.5 pl-4 font-mono text-xs text-ink/65">
            {subfolders.map((name) => (
              <li key={name}>{name}/</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Gallery preview
// -----------------------------------------------------------------------------

async function GalleryPreviewCard({
  eventId,
}: {
  eventId: string;
}) {
  const supabase = await createClient();
  const [photos, densityRows, seesAll, preservationTotals] = await Promise.all([
    fetchPapicGallery(supabase, eventId),
    getKwentoDensity(eventId, 60),
    // Asked SEPARATELY on purpose — an RLS refusal on the two couple-only
    // sources arrives as an empty list with no error, indistinguishable from a
    // wedding where nobody took a picture. Without this, a promoted coordinator
    // was shown the vendor's documentation shots as if they were the whole
    // album.
    viewerSeesCoupleScopedPapic(supabase, eventId),
    // ⚠ COUNTED SEPARATELY FROM THE GALLERY, over the WHOLE event. The gallery
    // is capped at 120 per source, so a meter computed from it is wrong at any
    // real wedding — and wrong in the direction that looks plausible.
    fetchPreservationTotals(supabase, eventId),
  ]);
  const hasPhotos = photos.length > 0;
  const kwentoDensity = new Map(densityRows.map((r) => [r.photoId, r.density]));

  /**
   * THE DAY, SPLIT INTO THE MOMENTS IT HAPPENED IN (owner 2026-08-19).
   *
   * Derived, never stored: the run of show already knows when each part ran and
   * every frame already carries when it was taken. `groupIntoChapters` does the
   * one dangerous part — the schedule keeps the VENUE'S WALL CLOCK while a
   * capture time is a real instant, eight hours apart in Manila.
   *
   * ⚠ FAILS TO NOTHING, ON PURPOSE. A schedule that cannot be read gives an
   * undefined `chapters`, and the gallery then renders exactly as it always
   * has — one flat grid. A gallery is somebody's wedding; it must never be a
   * blank page because a heading could not be computed.
   */
  let galleryChapters:
    | { key: string; label: string; photoIds: string[] }[]
    | undefined;
  try {
    const blocks = await fetchScheduleBlocks(supabase, eventId);
    if (blocks.length > 0 && photos.length > 0) {
      const { days } = groupIntoChapters({
        frames: photos.map((ph) => ({ id: ph.id, capturedAt: ph.capturedAt })),
        blocks: blocks.map((b) => ({
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
      // One chapter over the whole gallery is not a chapter — it is a heading
      // over everything, which tells the couple nothing they cannot already see.
      if (flat.length > 1) {
        galleryChapters = flat.map((c) => ({
          key: c.key,
          label: c.label,
          photoIds: c.frames.map((f) => f.id),
        }));
      }
    }
  } catch {
    galleryChapters = undefined;
  }

  return (
    <article className="space-y-4 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {seesAll
            ? hasPhotos
              ? 'Your gallery'
              : 'What your gallery looks like'
            : 'Photos shared with you'}
        </h2>
        {seesAll ? (
          <p className="max-w-prose text-sm text-ink/60">
            Guests who scan a personal or table QR are tagged on the spot. Untagged
            photos still land here — Papic never drops a photo.
          </p>
        ) : (
          <p className="max-w-prose text-sm text-ink/60">
            You&rsquo;re seeing what the couple&rsquo;s suppliers shot for their records.
            The photos the crew and guests took belong to the couple and aren&rsquo;t
            shared with you.
          </p>
        )}
      </div>

      {hasPhotos ? (
        <PapicGalleryGrid
          photos={photos}
          eventId={eventId}
          kwentoDensity={kwentoDensity}
          preservationTotals={preservationTotals}
          chapters={galleryChapters}
        />
      ) : (
        <div className="sn-row p-6 text-center">
          <p className="text-sm text-ink/65">
            {seesAll
              ? 'Your gallery fills up as your crew shoots — the first photos land here in real time.'
              : 'Nothing has been shared with you yet.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink/65">
        <LegendDot color="bg-success-500" label="Auto-face tag" />
        <LegendDot color="bg-terracotta" label="QR-scanned tag" />
        <LegendDot color="bg-ink/30" label="Untagged" />
      </div>
    </article>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

// -----------------------------------------------------------------------------
// Setup & help sections (folded under the disclosure)
// -----------------------------------------------------------------------------

function DslrBridgeSection() {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Smartphone aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        Pair a DSLR — ₱100 / seat / day
      </h3>
      <p className="max-w-prose text-sm text-ink/65">
        Turn one camera into a phone + DSLR pair. The phone still does everything
        — shutter, QR tagging, upload — and the DSLR provides the glass. Pairing
        happens in the Papic mobile app over Wi-Fi (arrives with the app, V1.5);
        there&rsquo;s nothing to set up here.
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
      title: 'Battery handoff at 20%',
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
      body: 'Rear-only, 10-second clip cap, no settings for your crew to fiddle with.',
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
