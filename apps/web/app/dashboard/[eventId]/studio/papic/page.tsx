import Link from 'next/link';
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
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { PapicGalleryGrid } from './_components/papic-gallery-grid';
import { getKwentoDensity } from '@/lib/kwento-density';
import { setPapicStorageDrive, setPapicStorageR2 } from './actions';
import { resolveStoredWindow, formatWindowSummary } from '@/lib/papic-window';
import PapicWindowPicker from './papic-window-picker';
import StylePicker from './style-picker';
import QualityPicker from './quality-picker';
import {
  fetchCameraRates,
  isPapicUncapped,
  provisionFreeCamerasAdmin,
  PAPIC_MIN_PAID_CAMERAS,
  PAPIC_FREE_CAMERA_COUNT,
  PAPIC_MINI_CAP_FALLBACK_PHP,
  PAPIC_UNLI_CAP_FALLBACK_PHP,
} from '@/lib/papic-cameras';
// Per-tier capture-POINT budgets → the picker's capacity copy. Derived from the
// admin-editable papic_tier_config, never spelled here (owner 2026-07-20).
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
import { MagazineCard } from './_components/magazine-card';
import { RecapCard } from './_components/recap-card';
import {
  DriveSafetyPanel,
  DriveReconnectBanner,
} from '@/app/_components/drive-connect-card';
import { SubmitButton } from '@/app/_components/submit-button';

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

export const metadata = { title: 'Papic · Setnayan' };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    drive_connected?: string;
    drive_disconnected?: string;
    drive_error?: string;
    storage_set?: string;
    storage_error?: string;
    papic_purchased?: string;
    papic_ref?: string;
    papic_amount?: string;
    papic_error?: string;
    papic_unlock_provisioned?: string;
    limited_synced?: string;
    limited_error?: string;
    papic_window_saved?: string;
    papic_window_error?: string;
  }>;
};

type StorageTarget = 'setnayan_r2' | 'google_drive_only';

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
  const {
    drive_connected: driveConnected,
    drive_disconnected: driveDisconnected,
    drive_error: driveError,
    storage_set: storageSet,
    storage_error: storageError,
    papic_purchased: papicPurchased,
    papic_ref: papicRef,
    papic_amount: papicAmount,
    papic_error: papicError,
    papic_unlock_provisioned: papicUnlockProvisioned,
    limited_synced: limitedSynced,
    limited_error: limitedError,
    papic_window_saved: papicWindowSaved,
    papic_window_error: papicWindowError,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, event_type, event_date, papic_storage_target, papic_mini_cap_php, papic_ltd_cap_php, papic_unli_cap_php, papic_window_start, papic_window_end',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const storageTarget: StorageTarget =
    (event.papic_storage_target as StorageTarget | null) === 'google_drive_only'
      ? 'google_drive_only'
      : 'setnayan_r2';

  // Event-wide Papic look (the couple's locked capture template). Read
  // defensively: the papic_style column lands in migration 20270307004141, so
  // on a pre-migration DB this select returns an error (not a throw) and we keep
  // the ORIG default — the page never breaks on the new column.
  const { data: styleRow } = await supabase
    .from('events')
    .select('papic_style')
    .eq('event_id', eventId)
    .maybeSingle();
  const papicStyle =
    (styleRow as { papic_style?: string } | null)?.papic_style ?? 'ORIG';

  // Per-event photo fidelity tier (brief PR-4) — the WRITE seam's current
  // state. Read defensively like papic_style: the column lands in migration
  // 20270825539466, so a pre-migration DB errors this select and we keep the
  // full_res default (today's behavior) — the page never breaks on the column.
  const { data: qualityRow } = await supabase
    .from('events')
    .select('papic_quality_tier')
    .eq('event_id', eventId)
    .maybeSingle();
  const papicQualityTier =
    (qualityRow as { papic_quality_tier?: string } | null)
      ?.papic_quality_tier ?? 'full_res';

  const [grantRaw, ownsPapicSeats] = await Promise.all([
    supabase
      .from('oauth_grants')
      .select('grant_id, external_account_display, granted_at, connection_health, metadata')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle()
      .then((r) => r.data ?? null),
    eventOwnsPapicSeats(supabase, eventId),
  ]);
  const driveGrant = (grantRaw ?? null) as DriveGrant | null;

  const driveConfig = await getDriveOAuthConfig();
  const driveOAuthReady = driveConfig.ready;

  // Live admin-managed rates + per-tier caps.
  const cameraRates = await fetchCameraRates(supabase);
  const papicTierConfig = await fetchPapicTierConfig(supabase);
  // Per-tier cost caps apply to WEDDINGS ONLY (owner 2026-07-17); every other
  // event type is uncapped. Mirror the charge path (studio/papic/actions.ts →
  // isPapicUncapped), which passes MAX_SAFE_INTEGER, so the picker quote never
  // diverges from the bill. The guest-list Limited tier IS the roll/Mini tier,
  // so it reads the MINI cap — not the (dormant) Ltd cap.
  const uncappedEvent = isPapicUncapped(
    (event as Record<string, unknown>).event_type as string | null,
  );
  const papicMiniCapPhp = uncappedEvent
    ? Number.MAX_SAFE_INTEGER
    : Number((event as Record<string, unknown>).papic_mini_cap_php ?? 0) ||
      PAPIC_MINI_CAP_FALLBACK_PHP;
  const papicUnliCapPhp = uncappedEvent
    ? Number.MAX_SAFE_INTEGER
    : Number((event as Record<string, unknown>).papic_unli_cap_php ?? 0) || 15000;

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

  // Unlock-all umbrella (admin-managed price; owning it frees Unli).
  const unlockAdmin = createAdminClient();
  const [
    { data: unlockPkg },
    ownsPapicUnlock,
    papicPlatformSettings,
    { data: keepFullResRow },
    ownsKeepFullRes,
  ] = await Promise.all([
    unlockAdmin
      .from('platform_package_catalog')
      .select('retail_price_php, is_active')
      .eq('package_code', 'PAPIC_UNLOCK')
      .maybeSingle(),
    eventSkuActive(unlockAdmin, eventId, 'PAPIC_UNLOCK'),
    fetchPlatformSettings(supabase),
    // Keep Full-Res archive (owner 2026-07-11) — sold on the existing apply-then-pay.
    unlockAdmin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, is_active')
      .eq('service_code', 'HIGH_RES_ARCHIVE')
      .maybeSingle(),
    eventSkuActive(unlockAdmin, eventId, 'HIGH_RES_ARCHIVE'),
  ]);
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

  // ── LIMITED (guest-list) state ──────────────────────────────────────────
  // Auto-count = guests who haven't declined. One reversible snapshot freezes
  // the bill; render-time sync keeps cameras in line with late RSVPs (free,
  // within the cap).
  const limitedGuestCount = await countLimitedGuests(supabase, eventId);
  const limitedSnapshot = await fetchActiveLimitedSnapshot(supabase, eventId);
  let limitedStatus: LimitedSnapshotStatus | null = limitedSnapshot?.status ?? null;
  let guestCameraCount = 0;
  {
    const { count } = await supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('guest_id', 'is', null)
      .is('revoked_at', null);
    guestCameraCount = count ?? 0;
  }
  if (limitedSnapshot) {
    // Lazy reconcile pending→active, then self-heal cameras if the list moved.
    limitedStatus = await reconcileLimitedSnapshot(unlockAdmin, limitedSnapshot);
    const expected = Math.min(limitedGuestCount, limitedSnapshot.camera_cap);
    if (guestCameraCount !== expected) {
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
  let extraCameraCount = 0;
  {
    const { count } = await supabase
      .from('paparazzi_seats')
      .select('seat_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('tier', 'unlimited')
      .is('revoked_at', null);
    extraCameraCount = count ?? 0;
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
      <header className="sn-reveal space-y-2">
        <p className="sn-eye">Capture</p>
        <h1 className="sn-h1 flex items-center gap-3">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Wedding photo capture
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your guests become the camera crew — every photo and 5-second clip lands
          in your gallery, tagged, in real time.
        </p>
      </header>

      <StatusBanners
        driveConnected={!!driveConnected}
        driveDisconnected={!!driveDisconnected}
        driveError={driveError}
        storageSet={storageSet}
        storageError={storageError}
        connectedAccount={driveGrant?.external_account_display ?? null}
        papicPurchased={papicPurchased}
        papicRef={papicRef}
        papicAmount={papicAmount}
        papicUnlockProvisioned={papicUnlockProvisioned}
        papicError={papicError}
        limitedSynced={limitedSynced}
        limitedError={limitedError}
        papicWindowSaved={papicWindowSaved}
        papicWindowError={papicWindowError}
      />

      {/* Unlock-all — the one-price headline (only when not yet owned). */}
      {papicUnlockPricePhp && !ownsPapicUnlock ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Everything Papic, one price
            </h2>
            <p className="max-w-prose text-sm text-ink/70">
              Unlimited cameras for the whole wedding + every add-on (Kwento,
              Photo Wall, Thank You, Stories, Pabati, Camera Bridge).
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
              <h2 className="text-sm font-semibold text-ink">Keep your full-res forever</h2>
            </div>
            <p className="text-xs text-ink/60">
              Your online gallery stays free forever. After 3 months we keep a
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

      {/* ── Your cameras — the core. ──────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Camera aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h2 className="text-xl font-semibold tracking-tight">Your cameras</h2>
        </div>

        {/* Capture window — sets the price (days) AND how long cameras shoot. */}
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
                A videographer friend, a hired second shooter — Unlimited only.
                {extraCameraCount > 0 ? ` ${extraCameraCount} active.` : ''}
              </p>
            </div>
            <Link
              href={`/dashboard/${eventId}/studio/papic/crew`}
              className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:text-terracotta-700"
            >
              Crew &amp; claim links
              <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="max-w-sm">
            <ExtraCamerasPicker
              eventId={eventId}
              unlimitedRate={cameraRates.unlimited}
              unliCapPhp={papicUnliCapPhp}
              unliFree={ownsPapicUnlock}
              days={papicDays}
              windowSummary={papicWindowSummary}
            />
          </div>
        </div>

      </section>

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

      {/* Photo quality — the per-event fidelity tier (brief PR-4). Writes the
          SAME events.papic_quality_tier column the capture ingest reads, so
          what the couple picks here is exactly what ingest applies. Weddings
          get the Optimal (~12 MP) recommendation. */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <Camera aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
            Photo quality
          </p>
          <p className="max-w-prose text-sm text-ink/65">
            Choose how your event&rsquo;s photos are stored. Optimal keeps
            phone-native sharpness in lighter files; Full resolution keeps
            every pixel exactly as uploaded.
          </p>
        </div>
        <QualityPicker
          eventId={eventId}
          current={papicQualityTier}
          recommendOptimal={
            ((event as Record<string, unknown>).event_type as string | null) ===
            'wedding'
          }
        />
      </section>

      {/* Storage. */}
      <StorageChoiceCard
        eventId={eventId}
        storageTarget={storageTarget}
        driveOAuthReady={driveOAuthReady}
        driveGrant={driveGrant}
        loginEmail={user.email ?? null}
      />

      {/* Gallery. */}
      <GalleryPreviewCard eventId={eventId} />

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

      {/* Add-on services (shipped surfaces). */}
      <LiveWallCard eventId={eventId} />
      <MagazineCard eventId={eventId} />
      <RecapCard eventId={eventId} />

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
  guestCameraCount: number;
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
          {guestCameraCount} camera{guestCameraCount === 1 ? '' : 's'} ready. New
          &ldquo;yes&rdquo; RSVPs are added automatically — no extra charge.
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
            perDayPhp: limitedQuote.ratePhp,
            cameraCap: limitedQuote.cameraCap,
            pointsPerDay: limitedPointsPerDay,
          }}
          unlimited={{
            billPhp: unlimitedQuote.frozenBillPhp,
            perDayPhp: unlimitedQuote.ratePhp,
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
  driveConnected,
  driveDisconnected,
  driveError,
  storageSet,
  storageError,
  connectedAccount,
  papicPurchased,
  papicRef,
  papicAmount,
  papicUnlockProvisioned,
  papicError,
  limitedSynced,
  limitedError,
  papicWindowSaved,
  papicWindowError,
}: {
  driveConnected: boolean;
  driveDisconnected: boolean;
  driveError: string | undefined;
  storageSet: string | undefined;
  storageError: string | undefined;
  connectedAccount: string | null;
  papicPurchased: string | undefined;
  papicRef: string | undefined;
  papicAmount: string | undefined;
  papicUnlockProvisioned: string | undefined;
  papicError: string | undefined;
  limitedSynced: string | undefined;
  limitedError: string | undefined;
  papicWindowSaved: string | undefined;
  papicWindowError: string | undefined;
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
    storageSet ||
    storageError ||
    papicPurchased ||
    papicUnlockProvisioned ||
    papicError ||
    limitedSynced !== undefined ||
    limitedError ||
    papicWindowSaved !== undefined ||
    papicWindowError;
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {papicPurchased ? (
        <div className={neutral}>
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            Order received{papicAmount ? ` — ${formatPhp(Number(papicAmount))} due` : ''}.
            Reference <span className="font-mono">{papicRef}</span>. Payment
            instructions are on the way; your cameras activate once the Setnayan
            team confirms your transfer.
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
                : 'Could not save the window — please try again.'}
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

      {storageSet === 'r2' ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Storage set to Setnayan — we keep a secure copy of every photo.
        </p>
      ) : null}
      {storageSet === 'drive' ? (
        <p className={ok}>
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Storage set to your Google Drive only.
        </p>
      ) : null}

      {storageError ? (
        <p className={bad}>
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            Could not update storage (
            <span className="font-mono text-xs">{storageError}</span>).{' '}
            {storageError === 'connect_drive_first'
              ? 'Connect Google Drive before switching to Drive-only.'
              : 'Try again, or contact support.'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Storage choice (radio cards) + Drive connect
// -----------------------------------------------------------------------------

function StorageChoiceCard({
  eventId,
  storageTarget,
  driveOAuthReady,
  driveGrant,
  loginEmail,
}: {
  eventId: string;
  storageTarget: StorageTarget;
  driveOAuthReady: boolean;
  driveGrant: DriveGrant | null;
  loginEmail: string | null;
}) {
  const r2Selected = storageTarget === 'setnayan_r2';
  const driveSelected = storageTarget === 'google_drive_only';

  return (
    <article
      id="papic-storage"
      className="scroll-mt-20 space-y-4 sn-tile p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Cloud aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Where your photos go
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Setnayan storage is the default. You can point Papic at your own Google
          Drive instead.
        </p>
      </div>

      <ul role="radiogroup" aria-label="Papic storage target" className="space-y-3">
        <li>
          <StorageOptionR2 eventId={eventId} selected={r2Selected} />
        </li>
        <li>
          <StorageOptionDrive
            eventId={eventId}
            selected={driveSelected}
            driveOAuthReady={driveOAuthReady}
            driveGrant={driveGrant}
            loginEmail={loginEmail}
          />
        </li>
      </ul>

      <p className="text-xs text-ink/55">Switch any time — it only affects new photos.</p>
    </article>
  );
}

function StorageOptionR2({
  eventId,
  selected,
}: {
  eventId: string;
  selected: boolean;
}) {
  return (
    <form
      action={setPapicStorageR2}
      className={
        selected
          ? 'block rounded-xl border-2 border-terracotta bg-terracotta/5 p-4'
          : 'block rounded-xl border border-ink/10 bg-cream/60 p-4 hover:border-ink/20'
      }
    >
      <input type="hidden" name="event_id" value={eventId} />
      <button type="submit" aria-pressed={selected} className="flex w-full items-start gap-3 text-left">
        <RadioDot selected={selected} />
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">Setnayan storage</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Recommended
            </span>
          </div>
          <p className="text-xs text-ink/65">
            Fast and reliable. We keep a secure copy of every photo. No setup.
          </p>
        </div>
      </button>
    </form>
  );
}

function StorageOptionDrive({
  eventId,
  selected,
  driveOAuthReady,
  driveGrant,
  loginEmail,
}: {
  eventId: string;
  selected: boolean;
  driveOAuthReady: boolean;
  driveGrant: DriveGrant | null;
  loginEmail: string | null;
}) {
  const connected = !!driveGrant;
  const disabled = !driveOAuthReady;
  const containerClass = selected
    ? 'rounded-xl border-2 border-terracotta bg-terracotta/5 p-4'
    : disabled
      ? 'rounded-xl border border-dashed border-ink/15 bg-cream/40 p-4 opacity-90'
      : 'rounded-xl border border-ink/10 bg-cream/60 p-4 hover:border-ink/20';

  return (
    <div className={containerClass}>
      <form action={setPapicStorageDrive}>
        <input type="hidden" name="event_id" value={eventId} />
        <button
          type="submit"
          aria-pressed={selected}
          disabled={disabled || !connected}
          className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
        >
          <RadioDot selected={selected} disabled={disabled || !connected} />
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">
                Use my Google Drive only
              </span>
              {disabled ? (
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
            </div>
            <p className="text-xs text-ink/65">
              Weddings can run 30–60 GB — make sure your Drive has space. If it
              runs out or disconnects, Setnayan won&rsquo;t have a backup copy.
            </p>
          </div>
        </button>
      </form>

      <div className="mt-3 pl-7">
        {disabled ? (
          <p className="text-xs italic text-ink/55">
            Coming soon — Setnayan&rsquo;s Drive verified-app review is in progress.
            Setnayan storage works today; we&rsquo;ll email you when Drive is ready.
          </p>
        ) : connected ? (
          <DriveConnectedPanel eventId={eventId} grant={driveGrant!} loginEmail={loginEmail} />
        ) : (
          <DriveConnectCTA eventId={eventId} />
        )}
      </div>
    </div>
  );
}

function RadioDot({
  selected,
  disabled = false,
}: {
  selected: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-cream"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={
        selected
          ? 'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-terracotta bg-cream'
          : 'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/30 bg-cream'
      }
    >
      {selected ? <span className="inline-block h-2 w-2 rounded-full bg-terracotta" /> : null}
    </span>
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
  const [photos, densityRows] = await Promise.all([
    fetchPapicGallery(supabase, eventId),
    getKwentoDensity(eventId, 60),
  ]);
  const hasPhotos = photos.length > 0;
  const kwentoDensity = new Map(densityRows.map((r) => [r.photoId, r.density]));

  return (
    <article className="space-y-4 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {hasPhotos ? 'Your gallery' : 'What your gallery looks like'}
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Guests who scan a personal or table QR are tagged on the spot. Untagged
          photos still land here — Papic never drops a photo.
        </p>
      </div>

      {hasPhotos ? (
        <PapicGalleryGrid photos={photos} eventId={eventId} kwentoDensity={kwentoDensity} />
      ) : (
        <div className="sn-row p-6 text-center">
          <p className="text-sm text-ink/65">
            Your gallery fills up as your crew shoots — the first photos land here
            in real time.
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
        toggle — tap for a photo, flip to Clip for a 5-second clip. No app to
        install; front camera is off by design (rear-only, for quality). Every
        clip runs the full 5 seconds and uploads in the background. Drag-to-shoot
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
      body: 'Rear-only, 5-second clip cap, no settings for your crew to fiddle with.',
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
