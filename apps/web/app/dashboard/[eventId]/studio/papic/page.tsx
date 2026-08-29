import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { notFound, redirect } from 'next/navigation';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
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
  Upload,
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
import { AddToLibrary } from './_components/add-to-library';
import { UploadsOpenChoice } from './_components/uploads-open-choice';
import { claimUploadsCamera } from './actions';
import { PapicStage } from './_components/papic-stage';
import { readPapicStandings } from '@/lib/papic-standings';
import { getKwentoDensity } from '@/lib/kwento-density';
import {
  resolveStoredWindow,
  formatWindowSummary,
  PAPIC_CAPTURE_MONTHS_BEFORE,
} from '@/lib/papic-window';
import PapicWindowPicker from './papic-window-picker';
import StylePicker from './style-picker';
import { SettingRow } from './_components/setting-row';
import { SourceRow } from './_components/source-row';
import { PAPIC_STYLES } from '@/lib/papic-photo-styles';
import { VendorChallengesApproval } from './vendor-challenges-approval';
import { CoupleChallengesManager } from './couple-challenges-manager';
import {
  fetchCameraRates,
  papicRungRate,
  papicRungSku,
  isPapicUncapped,
  provisionFreeCamerasAdmin,
  provisionUploadsCameraAdmin,
  PAPIC_MIN_PAID_CAMERAS,
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_MINI_CAP_FALLBACK_PHP,
  PAPIC_LTD_CAP_FALLBACK_PHP,
  PAPIC_UNLI_CAP_FALLBACK_PHP,
  PAPIC_RUNGS,
  PAPIC_UPLOADS_CAMERA_INDEX,
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
import { GuestAllotmentsChoice } from './_components/guest-allotments-choice';
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
    /** Turning on the Uploads camera — see claimUploadsCamera. */
    uploads_ready?: string;
    uploads_error?: string;
    uploads_open_set?: string;
    papic_purchased?: string;
    papic_order?: string;
    papic_ref?: string;
    papic_amount?: string;
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
  const search = await searchParams;
  const {
    drive_connected: driveConnected,
    drive_disconnected: driveDisconnected,
    drive_error: driveError,
    papic_access_error: papicAccessError,
    uploads_ready: uploadsReady,
    uploads_error: uploadsError,
    uploads_open_set: uploadsOpenSet,
    papic_purchased: papicPurchased,
    papic_order: papicOrder,
    papic_ref: papicRef,
    papic_amount: papicAmount,
    papic_error: papicError,
    papic_one_error: papicOneError,
    papic_pool_error: papicPoolError,
    shots_error: shotsError,
    shots_set: shotsSet,
    allotment_set: allotmentSet,
    allotment_error: allotmentError,
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
  // The look's human name for the row. DERIVED from the style table — the row
  // must never carry a second copy of these five words.
  const papicStyleLabel =
    PAPIC_STYLES.find((st) => st.id === papicStyle)?.label ?? 'Orig';

  // Who may add photos by hand (owner 2026-08-26). Read on its OWN round trip,
  // exactly like papic_style above and for the same reason: the column lands in
  // migration 20271170068924, and naming an unknown column in the main event
  // select would make PostgREST refuse that WHOLE query — the page would call
  // notFound() on a celebration that exists.
  //
  // 🪤 THIS READ WAS MISSING ON THE FIRST CUT AND THE SWITCH GOVERNED NOTHING.
  // `ev.papic_uploads_open` was read off the main select, which never named the
  // column, so it was always `undefined` and `?? true` reported OPEN no matter
  // what the couple had chosen. It saved, it showed the right state on its own
  // control, and the picker ignored it. A stored value with no reader, in a
  // feature whose entire point is the reader.
  const { data: uploadsRow, error: uploadsRowError } = await supabase
    .from('events')
    .select('papic_uploads_open')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the couple's choice about hand-added photos. Refused, it falls OPEN —
  // ⚠ see the note at `uploadsOpen` for why that is the right direction here.
  if (uploadsRowError) {
    logQueryError('PapicStudioPage.uploadsRow', uploadsRowError, { eventId }, 'graceful_degrade');
  }

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

  // ⚠ READ ONCE, USED TWICE. The stage needs to know whether the library is
  // empty (roll or photographs) and the facts strip on its edge reports the same
  // three numbers. Two components counting the same thing is a definition twice,
  // and this page has already paid for that shape once.
  const standings = await readPapicStandings(createAdminClient(), eventId);

  // Whole days until the cameras open. null when the dates are unset, or when
  // the window has already started — the stage says something different in each
  // case, and "0 days" is not the same sentence as "open now".
  const papicOpensInDays = (() => {
    if (!windowIsSet || !papicWindow.startIso) return null;
    const startMs = Date.parse(papicWindow.startIso);
    if (!Number.isFinite(startMs)) return null;
    const diff = startMs - Date.now();
    return diff > 0 ? Math.ceil(diff / 86_400_000) : null;
  })();

  // ⚠ THERE ARE NO ROOMS ANY MORE — see the "four ways in" section below.
  // `resolvePapicRoom` and its outcome→room map are deleted, not disabled: with
  // one page every confirmation banner is always on screen, so the whole reason
  // that map existed (a "saved" message landing in a room nobody was looking at)
  // is gone rather than guarded.

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
  await provisionUploadsCameraAdmin(unlockAdmin, eventId, {
    validFrom: papicWindow.startIso,
    validUntil: papicWindow.endIso,
  });

  // …then read it back, so the studio can either offer the picker or offer to
  // turn it on. Admin client on purpose: `paparazzi_seats_claimer_read` only
  // returns a seat once you ARE its claimer, so a couple cannot see their own
  // UNCLAIMED Uploads camera under RLS. Pinned to this event and the reserved
  // index, so it can only ever return the one seat.
  //
  // ⚠ A REFUSED READ IS NOT "THERE IS NO CAMERA". Both stay null and the block
  // renders nothing, rather than offering a picker that cannot work or a
  // turn-on button for a camera we could not look for.
  // ⚠ THE SWITCH IS READ DEFENSIVELY, AND ABSENT MEANS OPEN. The column lands
  // in migration 20271170068924; on a pre-migration database the select would
  // error and `?? true` keeps the library's most obvious door working rather
  // than closing it on everybody because a column is not there yet. Same shape
  // as papic_style above.
  const uploadsOpen =
    (((uploadsRow as { papic_uploads_open?: boolean | null } | null)?.papic_uploads_open) ?? true) !==
    false;

  let uploadsToken: string | null = null;
  let uploadsClaimed = false;
  {
    const { data: up, error: upErr } = await unlockAdmin
      .from('paparazzi_seats')
      .select('claim_qr_token, claimer_user_id')
      .eq('event_id', eventId)
      .eq('seat_index', PAPIC_UPLOADS_CAMERA_INDEX)
      .is('revoked_at', null)
      .maybeSingle();
    if (upErr) {
      logQueryError('PapicStudioPage.uploadsCamera', upErr, { eventId }, 'graceful_degrade');
    } else if (up) {
      uploadsClaimed = !!up.claimer_user_id && up.claimer_user_id === user.id;
      uploadsToken = uploadsClaimed ? ((up.claim_qr_token as string) ?? null) : null;
    }
  }

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

      {/*
        ⚖ NAME AND PROMISE, BUT NO PRICE — AND THE ABSENCE IS THE DECISION.
        The brief asked every buy page to open with "product name, one-line
        promise, price". Measured, this page does not have *a* price: it sells a
        credit ladder, a Keep Full-Res subscription and an unlock-everything
        bundle, side by side. Hoisting one of them above the fold would say the
        page costs that, which is the opposite of honest. So the figures stay
        beside the exact thing each one buys, and the hero does the half it can
        do truthfully.
      */}
      <StudioBuyHero productName={PAPIC_HERO.label} promise={PAPIC_HERO.blurb} />

      {/* ⚠ EVERY CONFIRMATION, ON THE ONE PAGE. When this screen had three
          rooms, an action's outcome had to be mapped to a room or its "saved"
          message landed somewhere nobody was looking. There is one page now, so
          every banner is always visible and that whole class of bug is gone
          rather than guarded. */}
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
        allotmentSet={allotmentSet}
        allotmentError={allotmentError}
        preserveError={preserveError}
      />

      {/* ⚠ THE STAGE — the page opens on the library, in every state.
          Owner 2026-08-28: *"it doesn't look like a photo app control center. it
          still feels like it is a business page."* Every product in this market
          opens on its content; the four facts still come before anything asks
          for a decision, they simply sit on the thing they describe now.
          See _components/papic-stage.tsx for the reasoning and the measured
          contrast ratios on the dark ground. */}
      <PapicStage
        standings={standings}
        windowIsSet={windowIsSet}
        windowSummary={papicWindowSummary}
        opensInDays={papicOpensInDays}
        uploadsOpen={uploadsOpen}
        firstMemorySlot={
          /* ⚠ A DOOR, NOT A SECOND PICKER. The upload sheet lives behind the
             "Your uploads" way-in below; putting the picker here too would be a
             second copy of a control, which is the failure this codebase pays
             for most. This scrolls to it. */
          <a
            href="#ways-into-your-library"
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-cream"
            style={{ backgroundColor: '#C24E25' }}
          >
            Add the first memory
          </a>
        }
      >
        <GalleryPreviewCard eventId={eventId} />
      </PapicStage>

      {/* ⚠ EXACTLY ONE NEXT STEP, AND IT KNOWS THE MOMENT.
          Owner, opening his own wedding's Papic page: *"entering papic inside an
          event needs to me simpler and better to manage. if I am a customer and
          I see this, I will be confused."*

          Before the dates are picked there is only one thing that matters, and
          nothing can be captured without it. Once they are picked, the next real
          thing is handing the cameras out — which used to be a small tile two
          sections inside a tab the couple had to guess. Two states, never both:
          a page with two "do this first" cards has no first. */}
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
      ) : claimLinkUnclaimed > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-mulberry/25 bg-surface">
          <div className="h-[3px] w-full bg-mulberry" aria-hidden />
          <div className="space-y-3 p-5 sm:p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-mulberry-600">
              Right now
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {claimLinkUnclaimed} camera QR{claimLinkUnclaimed === 1 ? '' : 's'}{' '}
              {claimLinkUnclaimed === 1 ? 'is' : 'are'} still in your pocket
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Show them at the door — each one is a camera. They scan, they shoot,
              and it all lands in your library.
            </p>
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
        </section>
      ) : null}

      {/* ══ FOUR WAYS INTO YOUR LIBRARY ═══════════════════════════════════════
          🔑 THIS SECTION IS WHAT REPLACED THE THREE TABS.

          The page used to open by asking a person to choose between Photos ·
          Cameras & shots · Set up — a question about our filing, asked before
          anything had been said about their celebration. The approved drawing
          (prototypes/papic_control_center_2026-08-25.html) replaces that choice
          with the thing itself: the four ways media gets into the library, each
          reporting what it has contributed and what it is waiting on.

          ⚠ EVERY CONTROL FROM ALL THREE ROOMS STILL EXISTS — the drawing's own
          port contract itemises where each one went, and nothing was dropped
          beyond the two questions the owner deleted (photo quality, "where your
          photos go"). The crew QRs, the off-list camera, the guest-camera tier
          and the uploads picker are behind these four rows, unredrawn. */}
      <section className="space-y-3" id="ways-into-your-library">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Four ways into your library
        </h2>
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          <SourceRow
            icon={<QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Crew cameras"
            blurb="Friends with a QR — free, add any number"
            state={
              !windowIsSet
                ? 'Waiting for dates'
                : claimLinkUnclaimed > 0
                  ? `${claimLinkUnclaimed} to hand out`
                  : claimLinkTotal > 0
                    ? `${claimLinkTotal} claimed`
                    : 'None yet'
            }
            attention={!windowIsSet || claimLinkUnclaimed > 0}
            sheetTitle="Crew cameras"
          >
            <p className="mb-4 text-sm text-ink/65">
              Each camera has its own QR and link — show it, they scan, they
              shoot. Every shot draws from your shared credits.
            </p>
            <div className="mb-5 flex flex-wrap items-center gap-2">
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

            {/* The ONLY off-list path — a videographer friend, a hired second
                shooter. Unchanged; it simply lives behind this row now. */}
            <div className="border-t border-ink/10 pt-4">
              <p className="text-sm font-semibold text-ink">
                Add a camera that isn&rsquo;t on the guest list
              </p>
              <p className="mb-3 text-xs text-ink/60">
                A videographer friend, a hired second shooter — pick their tier.
                {extraCameraCount !== null && extraCameraCount > 0
                  ? ` ${extraCameraCount} active.`
                  : ''}
              </p>
              <div className="max-w-sm">
                <ExtraCamerasPicker
                  eventId={eventId}
                  // ⚠ FILTER BEFORE MAP. PAPIC_RUNGS is a static vocabulary of every
                  // rung the code can SPEAK, not a list of what is on SALE — the
                  // sale list is `papic_tier_config.is_active`, which an admin
                  // edits without a deploy. Mapping the constant straight to the
                  // picker put both RETIRED rungs on a live buy button.
                  rungs={PAPIC_RUNGS.filter((rung) => papicTierConfig[rung].isActive).map(
                    (rung) => ({
                      rung,
                      title: papicTierConfig[rung].displayTitle,
                      ratePhp: papicRungRate(cameraRates, rung),
                      // ⚠ THE BUCKET, FROM THE TABLE THE GRANT READS —
                      // papic_one_tiers, which papic_grant_camera_points() reads
                      // on approval. The old per-camera-per-DAY meter is NULL for
                      // 'mini' on prod, and NULL reads as "unlimited" to every
                      // copy helper, so the picker advertised no limit on a
                      // camera the reserve stops at 50.
                      points:
                        papicOneTiers.find((t) => t.serviceCode === papicRungSku(rung))
                          ?.points ?? null,
                      capPhp: papicRungCapPhp[rung],
                      // PAPIC_UNLOCK frees Unli · PAPIC_UNLOCK_LTD frees the Mini
                      // rung. Nothing frees the Ltd rung today.
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
          </SourceRow>

          <SourceRow
            icon={<Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Guest cameras"
            blurb="Every invited guest — their invitation QR is the camera"
            state={
              limitedStatus === 'active'
                ? guestCameraCount === null
                  ? '—'
                  : `${guestCameraCount} ready`
                : limitedStatus === 'pending_payment'
                  ? 'Payment under review'
                  : 'Your event day'
            }
            sheetTitle="Guest cameras"
          >
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
          </SourceRow>

          {/* ⚠ THE UPLOAD ROW IS GOVERNED BY THE COUPLE'S OWN SWITCH, and the
              switch is read on its own round trip (see `uploadsRow` above) —
              the first cut read it off the main event select, which never named
              the column, so it reported OPEN whatever the couple had chosen. */}
          <SourceRow
            icon={<Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Your uploads"
            blurb="Older memories from your phone or laptop"
            state={uploadsOpen ? 'Open now' : 'Off'}
            sheetTitle="Add to your library"
          >
            {!uploadsOpen ? (
              <p className="max-w-prose text-sm text-ink/65">
                Adding photos by hand is switched off for this celebration — only
                what your cameras capture goes into the gallery. You can turn it
                back on under &ldquo;Set once, change any time&rdquo;.
              </p>
            ) : uploadsToken ? (
              <AddToLibrary token={uploadsToken} />
            ) : (
              <form action={claimUploadsCamera} className="space-y-3">
                <input type="hidden" name="event_id" value={eventId} />
                <p className="max-w-prose text-sm text-ink/65">
                  Add photos and clips from your phone or laptop — older memories
                  too. They land in the same gallery as everything your cameras
                  take, and cost the same: one credit a photo.
                </p>
                <SubmitButton className="sn-btn-primary">Turn this on</SubmitButton>
              </form>
            )}
          </SourceRow>

          {/* ⚠ INERT ON PURPOSE — NO SHEET, NO PRESS. The supplier capture lane
              is built and switched off behind the outstanding privacy ruling
              about a supplier collecting guests' photographs, so today a booked
              photographer can only hand over a link to their own gallery.
              Giving this row a door would be a control that cannot do the thing
              it names. It stays visible because the gap is real and the couple
              should be able to see where it closes. */}
          <SourceRow
            icon={<Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Suppliers"
            blurb="Your photographer's finished work, straight into your library"
            state="Not open yet"
          />
        </div>
        <p className="px-1 text-xs text-ink/55">
          Everything lands in the same library and is screened before anyone sees it.
        </p>
      </section>

      {/* ══ CREDITS — one shared pot, and the ways to add to it ═══════════════
          Bought where the number is watched, per the drawing. The meter, the
          ladder, handing credits to one camera, and what guests chipped in are
          four faces of one thing and now sit together. */}
      <HostPoolMeterCard eventId={eventId} />
      <PapicPoolCard eventId={eventId} error={papicPoolError ?? null} />
      {/* Hand credits to one camera's QR, or take unspent ones back (owner
          2026-08-11). 🔑 Dedicated credits are a FLOOR, not a ceiling — a
          capture spends the camera's own first and the pot pays the remainder. */}
      <PapicCamerasCard
        eventId={eventId}
        error={shotsError ?? papicOneError ?? null}
        justSet={shotsSet ?? null}
      />
      {/* NOTIFICATION ONLY — the host is told what guests chipped in, not asked. */}
      <GuestContributionsCard eventId={eventId} />

      {/* ══ MADE FROM YOUR LIBRARY ═══════════════════════════════════════════ */}
      <RecapCard eventId={eventId} />
      <MagazineCard eventId={eventId} />
      <LifeFlashCard eventId={eventId} />

      {/* ══ YOUR PHOTOS, YOUR SAY ════════════════════════════════════════════ */}
      <VendorMediaControls eventId={eventId} />
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
      <PoolGalleryCard eventId={eventId} />

      {/* ══ SET ONCE, CHANGE ANY TIME ════════════════════════════════════════
          🔑 THE RULE IS HOW OFTEN YOU TOUCH IT. Made once → a row showing its
          current answer. Come back to it → stays on the page as a card. We can
          answer it ourselves → deleted outright (photo quality, and where the
          photos go, both on the owner's 2026-08-26 ruling).

          ⚠ NO PICKER IS REDRAWN. Each row's sheet holds the shipped control
          exactly as it ships, lock notes and all. A row is a different DOOR to
          the same control, never a second copy of it — and the components that
          render nothing when there is nothing to decide still do, so no row
          exists for a choice that cannot be made. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Set once, change any time
        </h2>
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
          {/* The capture window, once it exists. While it is UNSET it is the
              do-this-first card at the top instead — never both, or a couple
              sees two identical date pickers on one page. */}
          {windowIsSet ? (
            <SettingRow
              icon={<Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              label="When your cameras can shoot"
              value={papicWindowSummary}
              sheetTitle="When your cameras can shoot"
            >
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
            </SettingRow>
          ) : null}

          <SettingRow
            icon={<Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
            label="Your Papic look"
            value={papicStyleLabel}
            sheetTitle="Your Papic look"
          >
            <p className="mb-4 text-sm text-ink/65">
              Choose one look for your whole event. Every photo your crew and
              guests capture gets it automatically, so your gallery feels like
              one beautiful set.
            </p>
            <StylePicker eventId={eventId} current={papicStyle} />
          </SettingRow>

          <FaceTaggingChoice eventId={eventId} variant="row" />
          <GuestCamerasChoice eventId={eventId} variant="row" />
          <UploadsOpenChoice eventId={eventId} open={uploadsOpen} variant="row" />
          <GuestAllotmentsChoice eventId={eventId} variant="row" />
        </div>
      </section>

      {/* ══ YOURS TO KEEP ════════════════════════════════════════════════════
          Google Drive as an OFFER, not a destination choice. Owner 2026-08-26:
          "i was thinking of not asking for setnayan storage? what we want is to
          offer them to sync this to a google drive." The either/or it replaced
          never worked — no capture or storage path has ever read the storage
          column, so "Use my Google Drive only" was never Drive-only and every
          photo has always landed in Setnayan storage. We hold the photos; Drive
          is a copy on top. */}
      <DriveCopyCard
        eventId={eventId}
        driveOAuthReady={driveOAuthReady}
        driveGrant={driveGrant}
        loginEmail={user.email ?? null}
      />

      {/* ══ EXTRAS FOR THE DAY ═══════════════════════════════════════════════ */}
      <CoupleChallengesManager eventId={eventId} />
      <VendorChallengesApproval eventId={eventId} />
      <LiveWallCard eventId={eventId} />

      {/* Setup & help — folded away, as today. */}
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

      {/* ══ OUTSIDE THE LIBRARY, ON PURPOSE ══════════════════════════════════
          The owner's purpose lock, said out loud on the screen it governs:
          *"papic is the source where they collect media files for that event.
          that will be our purpose. so the only exceptions will be the save the
          date video, or event video."* */}
      <section className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4 text-xs text-ink/60 sm:p-5">
        <span className="font-medium text-ink/75">Outside the library, on purpose:</span>{' '}
        your save-the-date film and your event film live with your event&rsquo;s
        pages, not here. They are made <em>for</em> your day; this library
        collects what was captured <em>of</em> it.
      </section>

      {/* ══ THE OFFERS, LAST ═════════════════════════════════════════════════
          ⚖ AN OFFER NEVER OUTRANKS THE DAY, OR THE KEEPSAKE. Both of these used
          to open a room — the unlock bundle was the first thing in Cameras &
          shots. They are true and they are for sale; they are not what a person
          came here to do. */}
      {papicUnlockPricePhp && !ownsPapicUnlock ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
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
  uploadsReady,
  uploadsError,
  uploadsOpenSet,
  allotmentSet,
  allotmentError,
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
  uploadsReady: string | undefined;
  uploadsError: string | undefined;
  uploadsOpenSet: string | undefined;
  allotmentSet: string | undefined;
  allotmentError: string | undefined;
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
    uploadsReady ||
    uploadsError ||
    uploadsOpenSet ||
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
    preserveError ||
    allotmentSet ||
    allotmentError;
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

      {allotmentSet ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {allotmentSet === 'released'
            ? 'The spare credits are open to everyone now. Credits you gave a named guest stay hers.'
            : allotmentSet === 'cleared'
              ? 'That guest is no longer named — they share what is left with everyone else.'
              : allotmentSet === '0'
                ? 'Every guest draws from the same pot again, until it runs out.'
                : 'Saved. Your guests can see their own number on their camera.'}
        </p>
      ) : null}

      {allotmentError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          {allotmentError === 'bad_everyone'
            ? 'Everyone who comes gets at least one photograph, so that number starts at 1. Leave it empty to share what is left, or name a guest to give her nothing.'
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
            ? 'Someone else is already holding this celebration’s uploads camera.'
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

  // THE VENUE'S CLOCK, for the gallery's per-tile credit ("Ninang Cora · 4:12 PM").
  //
  // ⚠ ITS OWN SELECT, DELIBERATELY, AND THIS IS NOT TIDINESS. Naming a column
  // PostgREST will not serve makes it refuse the WHOLE query, and this page's
  // main event read answers a refusal with `notFound()` — so folding two
  // coordinates into it would turn a grant problem into a live celebration
  // rendering as missing. Both columns are granted to `authenticated` in
  // production (verified 2026-08-27); this shape means that stops being
  // load-bearing.
  //
  // 🔑 NO ZONE ⇒ NO TIME. A refusal here drops the time half of every credit and
  // keeps the name. It never prints the reader's own clock as the venue's.
  const { data: venueForClock, error: venueForClockError } = await supabase
    .from('events')
    .select('venue_latitude, venue_longitude')
    .eq('event_id', eventId)
    .maybeSingle();
  // A REFUSED QUERY IS NOT A THROWN ERROR — bound, logged, and it changes
  // nothing the screen STATES: the credits keep the name and drop the time.
  if (venueForClockError) {
    logQueryError('PapicStudioPage.venueForClock', venueForClockError, { eventId }, 'graceful_degrade');
  }
  const galleryTimeZone = venueForClock
    ? eventTimezoneFromCoords(
        (venueForClock.venue_latitude as number | null) ?? null,
        (venueForClock.venue_longitude as number | null) ?? null,
      )
    : null;

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
          timeZone={galleryTimeZone}
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
