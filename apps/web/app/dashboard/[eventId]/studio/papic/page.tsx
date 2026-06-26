import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  BatteryWarning,
  Hand,
  Share2,
  Sparkles,
  Info,
  ChevronUp,
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
import {
  eventOwnsPapicSeats,
  fetchPapicSeats,
  fetchPapicSamplerSeats,
  papicSeatClaimUrl,
  PAPIC_SAMPLER_SEAT_COUNT,
  PAPIC_SAMPLER_PHOTO_CAP,
  PAPIC_SAMPLER_CLIP_CAP,
  PAPIC_SAMPLER_RETENTION_DAYS,
  type PapicSeatRow,
} from '@/lib/papic-seats';
import { CopyButton } from './crew/_components/copy-button';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { PapicGalleryGrid } from './_components/papic-gallery-grid';
import { getKwentoDensity } from '@/lib/kwento-density';
import { setPapicStorageDrive, setPapicStorageR2 } from './actions';
import { fetchCameraRates } from '@/lib/papic-cameras';
import CameraPicker from './camera-picker';
import { LiveWallCard } from './_components/live-wall-card';
import { MagazineCard } from './_components/magazine-card';
import { RecapCard } from './_components/recap-card';
import {
  DriveSafetyPanel,
  DriveReconnectBanner,
} from '@/app/_components/drive-connect-card';
import { SubmitButton } from '@/app/_components/submit-button';

// Iteration 0012 — Papic (V1 setup surface)
//
// Rewritten 2026-05-16 per the V1 scope expansion that wires real OAuth on
// the V1.5+ scaffold setup pages (see CLAUDE.md decision log row 2026-05-16
// "OAuth wiring for V1.5+ scaffold setup pages shipped early"). The
// original scaffold (preserved below as Sections 2-6) framed Papic as
// purely a V1.5+ surface — couples could see the shape but couldn't make
// any decisions. This rewrite adds Section 1: "Where do your photos go?"
// which surfaces the new storage-choice radio cards (Setnayan R2 vs Google
// Drive only) and the Drive OAuth wiring. The Setnayan-R2 option always
// works (the default); the Drive option degrades to a "coming soon"
// placeholder when GOOGLE_DRIVE_OAUTH_CLIENT_ID is unset (graceful-
// fallback rule, decoupling V1 ship from the owner-side Google Cloud
// verified-app review timeline).
//
// SPEC: ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md
//   · ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic_compatible_cameras.md
//   · ~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic_sdk_notes.md
//
// The 2026-05-16 owner directive also deviates from the original
// "T+30d transfer" model (Setnayan stores for 30 days, bulk-pushes to
// Drive). The new model is real-time DURING the event for both options;
// R2 is the primary by default; couples who opt out of R2 get Drive
// throttling + their own quota constraints. See the COWORK_INBOX.md
// entry for the spec corpus catch-up.
//
// Every integration seam (capture pipeline, native app pairing, QR
// tagging) is still marked with TODO(0012): — these stubs are deliberately
// left unwired until the native app + pairing pipeline are built. The
// capture pipeline itself MUST branch on events.papic_storage_target to
// decide where to write each photo — see the TODO(0012) marker in the
// `StorageChoiceCard` doc comment below.

export const metadata = { title: 'Papic · Setnayan' };

// Per-request render: the page reads live event/catalog state and uses an admin
// client (the Unlock-all bundle fetch). force-dynamic guarantees no build-time
// prerender — createAdminClient throws without a service-role key in CI builds.
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
  }>;
};

// Papic is per-camera (Roll ₱30/cam/day · Unlimited ₱100/cam/day · first 5
// free) — the flat ₱2,999 PAPIC_SEATS pass is retired (PR5, 2026-06-26). Live
// per-camera rates are read from the admin catalog via fetchCameraRates, not a
// hardcoded number.
// Camera Bridge is a PAID add-on at ₱100/seat/day, capped at ₱2,000 (owner
// 2026-06-26 · reverses the 2026-06-18 "included with Papic, no separate
// purchase" decision). Price is admin-managed in platform_retail_catalog_v2
// (CAMERA_BRIDGE); the DSLR pairing itself is native-app V1.5, so the web card
// is informational (the per-seat/day + cap billing lands with that feature).

// Seat + claim state is now read live from public.paparazzi_seats (paid pass
// or free sampler) via fetchPapicSeats / fetchPapicSamplerSeats — see the
// data-fetch in PapicAddonPage. The former MOCK_SEAT_PACK / MockSeat /
// MOCK_SEATS fakes (with invented claimer names + invented per-seat DSLR
// bridges) are deleted: paparazzi_seats has no bridge column, so the bridge
// card is now an honest "₱100/seat/day · pairs in the native app" card
// rather than a fake "X of Y bridged" roster.

type Gesture = {
  id: string;
  title: string;
  body: string;
  Icon: typeof Camera;
};

// The shipped web shutter (phone-browser capture) is a simple TAP button with a
// Photo / Clip toggle — no drag gestures, no flash/torch (the browser camera API
// can't reliably drive the torch). The richer gesture + flash/torch shutter is a
// COMING native-app capability (V1.5) and is honest-labeled as such below.
const WEB_CONTROLS: ReadonlyArray<Gesture> = [
  {
    id: 'tap-photo',
    title: 'Tap to shoot',
    body: 'One big shutter button. Tap it for a photo — snappy, fires on touch-up.',
    Icon: Camera,
  },
  {
    id: 'clip-toggle',
    title: 'Flip to Clip',
    body: 'Switch the Photo / Clip toggle, then tap. Every clip runs the full 5 seconds and cannot be cut short.',
    Icon: ChevronRight,
  },
];

// Coming with the native Papic app (V1.5) — the gesture + flash/torch shutter.
const COMING_GESTURES: ReadonlyArray<Gesture> = [
  {
    id: 'drag-up',
    title: 'Drag up',
    body: 'Photo with flash. A single pop synced to the shutter.',
    Icon: ChevronUp,
  },
  {
    id: 'chord',
    title: 'Drag right → drag up',
    body: '5-second clip with the torch on for the full clip.',
    Icon: Sparkles,
  },
];


const SDK_MATRIX = [
  { brand: 'Canon', sdk: 'EOS Camera Connect SDK', bodies: '11 V1 bodies (R-series mirrorless)' },
  { brand: 'Nikon', sdk: 'SnapBridge SDK + MTP-WiFi', bodies: '9 Z-series + 5 D-series' },
  { brand: 'Sony', sdk: 'Camera Remote SDK', bodies: '16 α / ZV / FX bodies' },
  { brand: 'Fujifilm', sdk: 'Camera Remote SDK', bodies: '14 X / GFX bodies' },
];

// Shape of the oauth_grants row we read for the connected-Drive panel.
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

type StorageTarget = 'setnayan_r2' | 'google_drive_only';

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
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read the event row + the current storage target. We need
  // papic_storage_target for the radio selection and papic_cost_cap_php for the
  // per-camera buy total. The storage column has a NOT NULL DEFAULT in the
  // migration, so we always get a value — but defensively narrow to the union
  // type below in case a future migration relaxes it.
  const { data: event } = await supabase
    .from('events')
    .select('event_id, papic_storage_target, papic_ltd_cap_php, papic_unli_cap_php')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const storageTarget: StorageTarget =
    (event.papic_storage_target as StorageTarget | null) === 'google_drive_only'
      ? 'google_drive_only'
      : 'setnayan_r2';

  // Drive-grant lookup, Papic-seat ownership, and the seat rows are mutually
  // independent reads — one parallel batch instead of serial round-trips (owner
  // perf pass 2026-06-03). The seat reads graceful-degrade to [] so a failure in
  // one never rejects the batch or breaks the always-rendered Papic page.
  const [grantRaw, ownsPapicSeats, paidSeats, samplerSeats] = await Promise.all([
    // Drive OAuth grant — RLS scopes oauth_grants by event_id IN
    // current_event_ids(), so the anon client is fine (no service role).
    supabase
      .from('oauth_grants')
      .select('grant_id, external_account_display, granted_at, connection_health, metadata')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle()
      .then((r) => r.data ?? null),
    // Photo-crew ownership — graceful-degrades to false on a missing table.
    eventOwnsPapicSeats(supabase, eventId),
    // Real seat rows — paid pass + free sampler. Both graceful-degrade to []
    // on a missing/legacy paparazzi_seats table (the page then shows the
    // buy / try state rather than crashing).
    fetchPapicSeats(supabase, eventId),
    fetchPapicSamplerSeats(supabase, eventId),
  ]);
  const driveGrant = (grantRaw ?? null) as DriveGrant | null;

  // --- Graceful-fallback flag ---
  // When GOOGLE_DRIVE_OAUTH_CLIENT_ID is unset the Drive radio renders as
  // disabled with a "coming soon" caption underneath. The Setnayan-R2 option
  // still works. Decouples shipping the V1 surface from the owner-side Google
  // Cloud verified-app review (1-4 wk window).
  const driveConfig = await getDriveOAuthConfig();
  const driveOAuthReady = driveConfig.ready;

  // Roster source: paid seats once the pack is owned; otherwise the free
  // sampler seats when the couple has started one; otherwise [] (the buy/try
  // state). A seat counts as claimed only when a claimer is bound AND the
  // claim hasn't been revoked.
  const rosterSeats: PapicSeatRow[] = ownsPapicSeats
    ? paidSeats
    : samplerSeats.length > 0
      ? samplerSeats
      : [];
  const isSamplerRoster = !ownsPapicSeats && samplerSeats.length > 0;
  const totalSeats = rosterSeats.length;
  const claimedSeats = rosterSeats.filter(
    (s) => s.claimer_user_id !== null && s.revoked_at === null,
  ).length;
  const unclaimedSeats = totalSeats - claimedSeats;

  // Per-seat claim links, built from the same host the crew page uses.
  const h = await headers();
  const seatHost = h.get('host') ?? 'www.setnayan.com';
  const seatProto = h.get('x-forwarded-proto') ?? 'https';
  const seatAppUrl = `${seatProto}://${seatHost}`;

  // Free-sampler retention signal — drives the on-page "keep your free photos"
  // card and the gallery nudge. Only the free sampler has expiring photos (paid
  // captures store expires_at IS NULL), so we skip the read once the pack is
  // owned. Mirrors the /crew banner's countdown so both surfaces agree.
  let samplerExpiringCount = 0;
  let samplerDaysLeft: number | null = null;
  if (!ownsPapicSeats) {
    const { data: expiring } = await supabase
      .from('papic_photos')
      .select('expires_at')
      .eq('event_id', eventId)
      .not('expires_at', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    samplerExpiringCount = expiring?.length ?? 0;
    const soonest = expiring?.[0]?.expires_at as string | undefined;
    if (soonest) {
      samplerDaysLeft = Math.max(
        0,
        Math.ceil((new Date(soonest).getTime() - Date.now()) / 86_400_000),
      );
    }
  }

  // Per-camera buy flow (PR2): live admin-managed rates + the event cost cap.
  const cameraRates = await fetchCameraRates(supabase);
  const papicLtdCapPhp =
    Number((event as Record<string, unknown>).papic_ltd_cap_php ?? 0) || 6000;
  const papicUnliCapPhp =
    Number((event as Record<string, unknown>).papic_unli_cap_php ?? 0) || 10000;

  // "Unlock all of Papic" umbrella bundle (owner 2026-06-26 · admin-managed price
  // in platform_package_catalog). Owning it grants every Papic add-on AND makes
  // the Unli camera tier free + uncapped (capture-gate bypass in papic/actions +
  // api/upload; ₱0 provisioning in the picker below via unliFree).
  const unlockAdmin = createAdminClient();
  const [{ data: unlockPkg }, ownsPapicUnlock, papicPlatformSettings] =
    await Promise.all([
      unlockAdmin
        .from('platform_package_catalog')
        .select('retail_price_php, is_active')
        .eq('package_code', 'PAPIC_UNLOCK')
        .maybeSingle(),
      eventSkuActive(unlockAdmin, eventId, 'PAPIC_UNLOCK'),
      fetchPlatformSettings(supabase),
    ]);
  const papicUnlockPricePhp = unlockPkg?.is_active
    ? Number(unlockPkg.retail_price_php)
    : null;

  return (
    <section className="space-y-8 pb-12">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Papic · wedding photo capture
        </p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Camera aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Papic — Wedding Photo Capture
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Papic turns friends and family into your candid-capture crew. Each
          paparazzo claims a seat from their own phone and shoots right in their
          phone browser — no app to install — and every photo or 5-second clip
          lands tagged in your gallery in real time. Below: pick where the photos
          write to, then manage your crew, camera bridges, and gallery settings.
        </p>
      </header>

      {/* ----------------------------------------------------------------
          Unlock all of Papic — the umbrella bundle (owner 2026-06-26). Presents
          every Papic feature as one buy: unlimited Unli cameras + all add-ons.
          ---------------------------------------------------------------- */}
      {papicUnlockPricePhp ? (
        <section className="rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mulberry">
                Unlock all of Papic
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                Everything Papic, one price
              </h2>
              <p className="max-w-prose text-sm text-ink/70">
                Unlimited Unli cameras for the whole wedding, plus every Papic
                add-on. Bought one by one it adds up to more — this is the bundle.
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/55">
                <li>Unlimited Unli cameras</li>
                <li>· Kwento</li>
                <li>· Photo Wall</li>
                <li>· Thank You</li>
                <li>· Stories</li>
                <li>· Pabati</li>
                <li>· Camera Bridge</li>
              </ul>
            </div>
            <div className="shrink-0">
              {ownsPapicUnlock ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-sm font-medium text-success-800">
                  Unlocked ✓
                </span>
              ) : papicPlatformSettings ? (
                <InlineCheckoutDrawer
                  eventId={eventId}
                  serviceKey="PAPIC_UNLOCK"
                  displayName="Unlock all of Papic"
                  originalPriceCentavos={String(Math.round(papicUnlockPricePhp * 100))}
                  settings={papicPlatformSettings}
                  triggerLabel={`Unlock all · ${formatPhp(papicUnlockPricePhp)}`}
                  triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
                />
              ) : (
                <span className="text-sm font-mono text-ink/60">
                  {formatPhp(papicUnlockPricePhp)}
                </span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------------
          Papic · your photo crew — the real entry point. Both owners and
          non-owners go to the /crew management surface (provision + claim
          links + QR + reissue); the per-camera buy picker lives in the
          "Add cameras" section just below. The mock crew illustration
          further down on this page stays as an explainer.
          ---------------------------------------------------------------- */}
      <section className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
              <Smartphone aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Your photo crew
            </p>
            <p className="max-w-prose text-sm text-ink/65">
              {ownsPapicSeats
                ? 'Your cameras are ready. Set them up and share a claim link with each shooter.'
                : 'Turn friends into your candid camera crew — each shoots from their own phone, and every photo lands in your gallery in real time. Add cameras below.'}
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href={`/dashboard/${eventId}/studio/papic/crew`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 sm:w-auto"
            >
              {ownsPapicSeats ? 'Manage my cameras' : 'Set up your crew'}
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
        {!ownsPapicSeats && (
          <div className="mt-4 border-t border-terracotta/15 pt-3">
            <Link
              href={`/dashboard/${eventId}/studio/papic/crew`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta underline-offset-2 hover:underline"
            >
              Try Papic free first — {PAPIC_SAMPLER_SEAT_COUNT} seats,{' '}
              {PAPIC_SAMPLER_PHOTO_CAP} photos + {PAPIC_SAMPLER_CLIP_CAP} clips each
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------
          Papic · per-camera buy flow (PR2 · 2026-06-26)
          Free first 5 cameras; add paid Roll / Unlimited cameras here.
          id="papic-add-cameras" — the sampler-expiry card's "Add a camera"
          CTA anchors here (the flat ₱2,999 pass is retired, PR5).
          ---------------------------------------------------------------- */}
      <section
        id="papic-add-cameras"
        className="scroll-mt-20 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5 sm:p-6"
      >
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <Sparkles aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Add cameras
          </p>
          <p className="max-w-prose text-sm text-ink/65">
            {ownsPapicUnlock
              ? 'Unlock all is active — Unli cameras are free and unlimited. Add as many as you like; you only pay for any Ltd cameras.'
              : `Your first 5 cameras are free. Add more — a Ltd camera for each guest, or Unli for your key shooters. We total it for you, and each tier locks: Ltd at ${formatPhp(
                  papicLtdCapPhp,
                )}, Unli at ${formatPhp(papicUnliCapPhp)}.`}
          </p>
        </div>
        {papicUnlockProvisioned ? (
          <div className="mt-4 rounded-lg border border-success-300/70 bg-success-50 p-4 text-sm text-success-900">
            <p className="font-medium">
              {papicUnlockProvisioned} Unli camera
              {papicUnlockProvisioned === '1' ? '' : 's'} added — free with Unlock
              all.
            </p>
            <p className="mt-1">
              They’re active now. Head to your crew to share each camera’s claim
              link.
            </p>
          </div>
        ) : papicPurchased ? (
          <div className="mt-4 rounded-lg border border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/80">
            <p className="font-medium text-ink">
              Order received{papicAmount ? ` — ${formatPhp(Number(papicAmount))} due` : ''}.
            </p>
            <p className="mt-1">
              Reference <span className="font-mono">{papicRef}</span>. You’ll get
              payment instructions by email; your cameras activate once the
              Setnayan team confirms your transfer.
            </p>
          </div>
        ) : null}
        {papicError === 'min_cameras' ? (
          <p className="mt-3 text-sm text-terracotta">Please pick at least 5 cameras.</p>
        ) : papicError ? (
          <p className="mt-3 text-sm text-terracotta">
            Something went wrong — please try again.
          </p>
        ) : null}
        <div className="mt-5 max-w-md">
          <CameraPicker
            eventId={eventId}
            rollRate={cameraRates.roll}
            unlimitedRate={cameraRates.unlimited}
            ltdCapPhp={papicLtdCapPhp}
            unliCapPhp={papicUnliCapPhp}
            unliFree={ownsPapicUnlock}
          />
        </div>
      </section>

      {/* ----------------------------------------------------------------
          Free-sampler retention — "keep your free photos" (2026-06-16)
          ----------------------------------------------------------------
          Shown only on the free sampler once there are photos that will
          expire. Two co-equal, free-first CTAs that live exactly where the
          real actions are: "keep your own copy" anchors DOWN to the storage
          card (which honors the Drive OAuth coming-soon gate itself — we
          never deep-link /api/oauth/drive/start, which 503s when env is
          unset), and "add a camera" anchors UP to the per-camera buy picker
          (#papic-add-cameras). The flat ₱2,999 PAPIC_SEATS pass is retired
          (PR5, 2026-06-26) — Papic is per-camera, so there is no checkout
          drawer here. */}
      {!ownsPapicSeats && samplerExpiringCount > 0 && (
        <SamplerRetentionCard
          expiringCount={samplerExpiringCount}
          daysLeft={samplerDaysLeft}
        />
      )}

      {/* ----------------------------------------------------------------
          Photo moderation (Apple 1.2 / Google Play UGC)
          ----------------------------------------------------------------
          Entry point to the couple-side moderation surface: review every
          guest photo, hide anything unwanted, report it to the Setnayan team,
          or block a guest's camera for this wedding (event-scoped). The
          underlying report path also reaches the /admin/user-reports queue. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <Lock aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
            Keep your gallery safe
          </p>
          <p className="max-w-prose text-sm text-ink/65">
            Review every photo your guests share. Hide anything you don&rsquo;t
            want, report it to the Setnayan team, or block a guest&rsquo;s
            camera for this wedding.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href={`/dashboard/${eventId}/studio/papic/moderation`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-mulberry/30 bg-mulberry/5 px-4 py-2 text-sm font-medium text-mulberry hover:bg-mulberry/10 sm:w-auto"
          >
            Open photo moderation
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </section>

      <StatusBanners
        driveConnected={!!driveConnected}
        driveDisconnected={!!driveDisconnected}
        driveError={driveError}
        storageSet={storageSet}
        storageError={storageError}
        connectedAccount={driveGrant?.external_account_display ?? null}
      />

      {/* ----------------------------------------------------------------
          Section 1 — Storage choice (NEW, 2026-05-16)
          ----------------------------------------------------------------
          The new V1 surface. Couple picks where Papic writes photos:
            (a) Setnayan storage (R2) — recommended default
            (b) Google Drive only — couple's own Drive folder
          Server-side radio: switching triggers a server action that
          updates events.papic_storage_target. The Connect-Drive button
          only appears when the Drive radio is selected. If
          GOOGLE_DRIVE_OAUTH_CLIENT_ID is unset, the Drive option is
          disabled with a "coming soon — admin setup pending" caption.

          TODO(0012): the Papic capture pipeline (V1.5+ — cameras +
          face detection + transfer) MUST read events.papic_storage_target
          and branch:
            · 'setnayan_r2' → upload to R2 setnayan-media bucket
              (current behavior; existing infra at lib/r2.ts)
            · 'google_drive_only' → upload to the folder id in
              oauth_grants.metadata.drive_folder_id via the Drive API.
              Use refreshDriveAccessToken() before each session and
              handle rate-limit / quota errors with a retry queue
              (Drive's per-user quota is 1B queries/day but with a
              250 req/100s burst limit — wedding bursts will exceed
              that).
       */}
      <StorageChoiceCard
        eventId={eventId}
        storageTarget={storageTarget}
        driveOAuthReady={driveOAuthReady}
        driveGrant={driveGrant}
        loginEmail={user.email ?? null}
      />

      <SeatStatusCard
        eventId={eventId}
        ownsPapicSeats={ownsPapicSeats}
        isSampler={isSamplerRoster}
        seats={rosterSeats}
        appUrl={seatAppUrl}
        claimed={claimedSeats}
        unclaimed={unclaimedSeats}
        total={totalSeats}
      />

      <ProCameraBridgeCard />

      <LiveWallCard eventId={eventId} />

      <MagazineCard eventId={eventId} />

      <RecapCard eventId={eventId} />

      <GestureReferenceCard />

      <GalleryPreviewCard
        eventId={eventId}
        samplerExpiringCount={samplerExpiringCount}
        samplerDaysLeft={samplerDaysLeft}
      />

      <SettingsCard />

      {/* First-visit orientation — fires once per user when they land here. */}
      <MiniTour tourKey="customer_papic_v1" />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Free-sampler retention card — "keep your free photos forever"
// -----------------------------------------------------------------------------
// Rendered only on the free sampler once captures exist that will expire.
// Two co-equal CTAs (equal weight, no visual primary — owner pick 2026-06-16):
//   • "Keep your own copy — Google Drive" anchors to #papic-storage. We do NOT
//     deep-link /api/oauth/drive/start (it 503s when GOOGLE_DRIVE_OAUTH_CLIENT_ID
//     is unset). The storage card owns the connect button + its coming-soon gate.
//   • "Add a camera" anchors UP to #papic-add-cameras (the on-page per-camera
//     buy picker). Papic is per-camera now (Roll ₱30/cam/day · Unlimited
//     ₱100/cam/day · first 5 free) — the flat ₱2,999 PAPIC_SEATS pass is retired
//     (PR5, 2026-06-26), so there is no InlineCheckoutDrawer here any more. Paid
//     cameras archive every shot to your Drive, so new captures never expire.
// Both CTAs are plain anchors — no platform settings / QR refs needed.
function SamplerRetentionCard({
  expiringCount,
  daysLeft,
}: {
  expiringCount: number;
  daysLeft: number | null;
}) {
  const ctaClass =
    'inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-mulberry/30 bg-mulberry/5 px-4 py-2.5 text-sm font-medium text-mulberry transition-colors hover:bg-mulberry/10';
  const noun = expiringCount === 1 ? 'photo' : 'photos';
  const verb = expiringCount === 1 ? 'expires' : 'expire';

  return (
    <section
      id="papic-keep"
      className="scroll-mt-20 rounded-2xl border border-terracotta/30 bg-terracotta/[0.05] p-5 sm:p-6"
    >
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Free sampler
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Keep your free photos forever
        </h2>
        <p className="max-w-prose text-sm text-ink/70">
          <b className="font-medium text-ink">
            Your {expiringCount === 1 ? '' : `${expiringCount} `}free sampler {noun}{' '}
            {daysLeft === null
              ? `${verb} soon`
              : daysLeft === 0
                ? `${verb} today`
                : `${verb} in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
            .
          </b>{' '}
          Save your own copy to Google Drive to keep them — or add a camera to go
          beyond the free sampler, where every shot is archived to your Drive and
          never expires.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link href="#papic-storage" className={ctaClass}>
          <HardDrive aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Keep your own copy — Google Drive
        </Link>
        <Link href="#papic-add-cameras" className={ctaClass}>
          <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Add a camera
        </Link>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Status banners (Drive connect / disconnect / error + storage switch result)
// -----------------------------------------------------------------------------

function StatusBanners({
  driveConnected,
  driveDisconnected,
  driveError,
  storageSet,
  storageError,
  connectedAccount,
}: {
  driveConnected: boolean;
  driveDisconnected: boolean;
  driveError: string | undefined;
  storageSet: string | undefined;
  storageError: string | undefined;
  connectedAccount: string | null;
}) {
  return (
    <div className="space-y-3">
      {driveConnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Google Drive connected
          {connectedAccount ? ` — ${connectedAccount}` : ''}. Your Setnayan
          folder structure is ready in your Drive.
        </p>
      ) : null}

      {driveDisconnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75"
        >
          <Unlink2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Google Drive disconnected. Storage is back on Setnayan R2 — reconnect
          any time to switch back.
        </p>
      ) : null}

      {driveError ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            Google Drive connection failed (
            <span className="font-mono text-xs">{driveError}</span>
            ). Try again, or contact support if this persists.
          </span>
        </p>
      ) : null}

      {storageSet === 'r2' ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Storage set to Setnayan — we&rsquo;ll keep a secure copy of every photo.
        </p>
      ) : null}

      {storageSet === 'drive' ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Storage set to your Google Drive only.
        </p>
      ) : null}

      {storageError ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            Could not update storage target (
            <span className="font-mono text-xs">{storageError}</span>
            ).{' '}
            {storageError === 'connect_drive_first'
              ? 'Connect Google Drive before switching to Drive-only storage.'
              : 'Try again, or contact support if this persists.'}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section 1 — Storage choice (radio cards) + Drive connect
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
      className="scroll-mt-20 space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 1 · where your photos go
        </p>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Cloud aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Pick where Papic writes your photos
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Each photo your crew shoots needs somewhere to land in real time.
          Setnayan storage is the default — fast and reliable. You can also
          point Papic at your own Google Drive if you&rsquo;d rather skip
          the Setnayan copy entirely.
        </p>
      </div>

      <ul
        role="radiogroup"
        aria-label="Papic storage target"
        className="space-y-3"
      >
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

      <p className="text-xs text-ink/55">
        You can switch any time. Photos already uploaded stay where they
        landed — switching the target only affects new captures.
      </p>
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
          ? 'block rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 sm:p-5'
          : 'block rounded-xl border border-ink/10 bg-cream/60 p-4 sm:p-5 hover:border-ink/20'
      }
    >
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        aria-pressed={selected}
        className="flex w-full items-start gap-3 text-left"
      >
        <RadioDot selected={selected} />
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-ink">
              Setnayan storage
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
              <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
              Recommended
            </span>
          </div>
          <p className="text-sm text-ink/70">
            Fast and reliable. We keep a secure copy of every photo. No
            setup, no storage limits to manage.
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
    ? 'rounded-xl border-2 border-terracotta bg-terracotta/5 p-4 sm:p-5'
    : disabled
      ? 'rounded-xl border border-dashed border-ink/15 bg-cream/40 p-4 sm:p-5 opacity-90'
      : 'rounded-xl border border-ink/10 bg-cream/60 p-4 sm:p-5 hover:border-ink/20';

  return (
    <div className={containerClass}>
      {/* Outer form selects the Drive target. Always rendered; the submit
          button is disabled when no grant exists OR when env vars are
          missing. */}
      <form action={setPapicStorageDrive}>
        <input type="hidden" name="event_id" value={eventId} />
        <button
          type="submit"
          aria-pressed={selected}
          disabled={disabled || !connected}
          className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
        >
          <RadioDot selected={selected} disabled={disabled || !connected} />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-ink">
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
            <p className="text-sm text-ink/65">
              <em className="not-italic text-ink/75">Heads up:</em> weddings can
              produce 30–60 GB of photos. Make sure your Google Drive has the
              space — you may need to upgrade to a paid Google One plan. If
              your Drive runs out of space or loses connection during the
              event, Setnayan won&rsquo;t have a backup copy.
            </p>
          </div>
        </button>
      </form>

      {/* Below the radio button: either the "coming soon" caption, the
          Connect Drive CTA, or the connected panel. Kept OUTSIDE the
          enclosing form so clicking Connect doesn't also submit the
          storage-target switch. */}
      <div className="mt-3 pl-7">
        {disabled ? (
          <p className="text-xs italic text-ink/55">
            Coming soon — admin setup pending. Setnayan&rsquo;s Google Drive
            OAuth verified-app review is still in progress (1–4 week window).
            Setnayan storage works today; we&rsquo;ll email you the moment
            Drive is ready.
          </p>
        ) : connected ? (
          <DriveConnectedPanel
            eventId={eventId}
            grant={driveGrant!}
            loginEmail={loginEmail}
          />
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
      {selected ? (
        <span className="inline-block h-2 w-2 rounded-full bg-terracotta" />
      ) : null}
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
        You&rsquo;ll be redirected to Google, then bounced back here — takes
        about 20 seconds. Connect once and it covers your recap and
        photographer hand-off too.
      </p>
    </div>
  );
}

function DriveConnectedPanel({
  eventId,
  grant,
  loginEmail,
}: {
  eventId: string;
  grant: DriveGrant;
  loginEmail: string | null;
}) {
  const accountLabel = grant.external_account_display ?? 'Connected Drive';
  const grantedDate = new Date(grant.granted_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  // Fall back to the canonical hard-coded folder list if metadata is empty
  // for any reason — keeps the UI deterministic even if a future migration
  // changes the JSONB shape.
  const subfolders =
    grant.metadata?.drive_subfolders?.map((s) => s.name) ??
    [...PAPIC_DRIVE_SUBFOLDERS];
  const folderName = grant.metadata?.drive_folder_name ?? 'Setnayan';
  // Surface (never block) a login≠Drive mismatch. Couples often connect a
  // shared "ourwedding@gmail.com" on purpose — so this is a calm switch
  // affordance, not a warning. Only when we actually know the Drive email
  // (it can be null when Google omits userinfo) and it differs from the login.
  const accountMismatch =
    !!grant.external_account_display &&
    !!loginEmail &&
    grant.external_account_display !== loginEmail;

  return (
    <div className="space-y-3">
      {grant.connection_health === 'needs_reauth' ? (
        <DriveReconnectBanner
          reconnectHref={`/api/oauth/drive/start?event_id=${eventId}`}
        />
      ) : null}

      <div className="space-y-3 rounded-xl border border-success-200/80 bg-success-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-ink">
            Connected to Google Drive as {accountLabel}
          </p>
          <p className="font-mono text-[11px] text-ink/55">
            Connected {grantedDate}
          </p>
          {accountMismatch ? (
            <p className="text-[11px] text-ink/60">
              Not your sign-in ({loginEmail}). That&rsquo;s fine — photos save
              to {grant.external_account_display}.{' '}
              <Link
                href={`/api/oauth/drive/start?event_id=${eventId}&switch=1`}
                className="font-medium text-mulberry underline-offset-2 hover:underline"
              >
                Use a different account
              </Link>
            </p>
          ) : null}
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
        <p className="mt-1.5 font-mono text-xs text-ink/85">
          Setnayan / {folderName} /
        </p>
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
// Section 2 — Seat status (PRESERVED from scaffold)
// -----------------------------------------------------------------------------

function SeatStatusCard({
  eventId,
  ownsPapicSeats,
  isSampler,
  seats,
  appUrl,
  claimed,
  unclaimed,
  total,
}: {
  eventId: string;
  ownsPapicSeats: boolean;
  isSampler: boolean;
  seats: ReadonlyArray<PapicSeatRow>;
  appUrl: string;
  claimed: number;
  unclaimed: number;
  total: number;
}) {
  const headingLabel = isSampler
    ? 'Free Papic sampler'
    : 'Papic photo crew';

  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Section 2 · seat status
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{headingLabel}</h2>
        </div>
        {total > 0 ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {claimed}/{total} claimed
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        // No seats provisioned yet — the buy / try entry point. The hero card
        // at the top of the page owns the actual checkout drawer + free-sampler
        // link; here we keep an honest "no seats yet" state with the live price.
        <div className="space-y-3 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-4 sm:p-5 text-center">
          <p className="text-sm text-ink/70">
            {ownsPapicSeats
              ? 'Your cameras are active, but none have been set up yet.'
              : 'No cameras yet — add cameras above, or try Papic free first.'}
          </p>
          <Link
            href={`/dashboard/${eventId}/studio/papic/crew`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-700"
          >
            {ownsPapicSeats ? 'Set up your seats' : 'Set up your crew'}
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Total seats" value={total.toString()} />
            <Stat label="Claimed by crew" value={claimed.toString()} />
            <Stat label="Still open" value={unclaimed.toString()} accent={unclaimed > 0} />
          </div>

          <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-cream/60">
            {seats.map((seat) => {
              const isClaimed =
                seat.claimer_user_id !== null && seat.revoked_at === null;
              const claimUrl = papicSeatClaimUrl(appUrl, seat.claim_qr_token);
              return (
                <li
                  key={seat.seat_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                      <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        Seat {seat.seat_index}
                      </p>
                      <p className="truncate text-xs text-ink/60">
                        {isClaimed
                          ? 'Claimed — bound to a crew member'
                          : 'Unclaimed — share the link below'}
                      </p>
                    </div>
                  </div>
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
                      <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                      Claimed
                    </span>
                  ) : (
                    <CopyButton value={claimUrl} label="Copy claim link" />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-2 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <Share2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-ink">Invite the rest of your crew</p>
                <p className="text-xs text-ink/60">
                  Each unclaimed seat above has a wedding-scoped claim link —
                  copy it and send it to your paparazzo. They open it on their
                  phone and the seat binds to their device. For printable QR
                  codes per seat, open the full crew manager.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/${eventId}/studio/papic/crew`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-700"
            >
              Open the crew manager
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </>
      )}
    </article>
  );
}

function ProCameraBridgeCard() {
  // HONEST card. The paparazzi_seats table has NO per-seat bridge column, so
  // there is no real "X of Y seats bridged" data to show — the former counts
  // and the per-seat "paired with Canon EOS R6" roster were 100% fabricated and
  // are removed. DSLR pairing is a native-app capability (the web build cannot
  // speak the vendor SDKs); the educational SDK matrix stays so couples can
  // confirm their camera body is supported when the Papic app ships (V1.5).
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 3 · DSLR Camera Bridge
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Pair a real camera body —{' '}
          <span className="font-mono text-base text-terracotta">
            ₱100 / seat / day
          </span>
        </h2>
      </div>

      <p className="max-w-prose text-sm text-ink/70">
        Turn one phone seat into a phone + DSLR pair. The phone keeps doing
        all of the work — gesture shutter, QR tagging, EXIF stamping,
        adaptive compression, upload — and the camera body provides the
        optical glass. The DSLR Camera Bridge is ₱100 per seat, per day
        (capped at ₱2,000 · pairs in the native Papic app · V1.5).
      </p>

      <div className="flex items-start gap-2 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <Smartphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        <p className="text-xs text-ink/65">
          DSLR pairing happens inside the Papic mobile app — pairing a camera
          body talks to the vendor SDK over Wi-Fi, which only the native app
          can do (it arrives with the Papic app, V1.5). When it lands, each
          paparazzo pairs their own camera from their seat; there&rsquo;s
          nothing to set up here on the web.
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Supported camera bodies at launch
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SDK_MATRIX.map((row) => (
            <div
              key={row.brand}
              className="rounded-xl border border-ink/10 bg-cream/60 p-3"
            >
              <p className="text-sm font-semibold text-ink">{row.brand}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                {row.sdk}
              </p>
              <p className="mt-1 text-xs text-ink/65">{row.bodies}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function GestureReferenceCard() {
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 4 · the shutter
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Teach your crew the shutter — it&rsquo;s just a tap
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          In the phone browser, Papic is one big shutter button with a Photo / Clip
          toggle — tap for a photo, flip to Clip for a 5-second clip. No app to
          install. Front camera is disabled by design (rear-only, locked 2026-05-09)
          so the optical quality stays high.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {WEB_CONTROLS.map((g) => (
          <li
            key={g.id}
            className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream/60 p-3 sm:p-4"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
              <g.Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{g.title}</p>
              <p className="mt-0.5 text-xs text-ink/65">{g.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
        <p className="text-xs text-ink/65">
          Every clip is exactly 5 seconds — no shorter. Once your paparazzo
          starts a clip, the recording runs the full 5 seconds and uploads in the
          background. They can walk away, tag a guest, or shoot again — nothing
          is lost.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-dashed border-ink/15 bg-cream/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink/85">
            <Sparkles aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Gesture + flash shutter
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
            Coming with the native Papic app (V1.5)
          </span>
        </div>
        <p className="max-w-prose text-xs text-ink/60">
          Drag-to-shoot and a synced flash/torch aren&rsquo;t possible in a phone
          browser — they arrive with the native Papic app:
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COMING_GESTURES.map((g) => (
            <li
              key={g.id}
              className="flex items-start gap-3 rounded-xl border border-ink/10 bg-cream/60 p-3 opacity-80 sm:p-4"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/55">
                <g.Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink/80">{g.title}</p>
                <p className="mt-0.5 text-xs text-ink/55">{g.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

async function GalleryPreviewCard({
  eventId,
  samplerExpiringCount,
  samplerDaysLeft,
}: {
  eventId: string;
  samplerExpiringCount: number;
  samplerDaysLeft: number | null;
}) {
  // Real gallery — the couple's actual crew + guest captures with presigned
  // thumbnails. NSFW-blocked / hidden / expired-sampler photos are filtered out
  // in fetchPapicGallery; untagged photos still show (untagged-still-delivered).
  const supabase = await createClient();
  const [photos, densityRows] = await Promise.all([
    fetchPapicGallery(supabase, eventId),
    getKwentoDensity(eventId, 60), // enough to cover the gallery limit
  ]);
  const hasPhotos = photos.length > 0;
  const kwentoDensity = new Map(densityRows.map((r) => [r.photoId, r.density]));

  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Your gallery
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          {hasPhotos ? 'Every photo your crew shoots' : 'What your gallery looks like'}
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Guests who scan a personal or table QR are tagged on the
          spot. Anything still untagged stays in your gallery — Papic
          never drops a photo because of a missing tag.
        </p>
      </div>

      {samplerExpiringCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          <span>
            <b className="font-medium">
              {samplerExpiringCount === 1
                ? 'Your free sampler photo '
                : `Your ${samplerExpiringCount} free sampler photos `}
              {samplerDaysLeft === null
                ? `are kept for ${PAPIC_SAMPLER_RETENTION_DAYS} days`
                : samplerDaysLeft === 0
                  ? `${samplerExpiringCount === 1 ? 'expires' : 'expire'} today`
                  : `${samplerExpiringCount === 1 ? 'expires' : 'expire'} in ${samplerDaysLeft} ${samplerDaysLeft === 1 ? 'day' : 'days'}`}
              .
            </b>{' '}
            Keep them forever —{' '}
            <Link
              href="#papic-keep"
              className="font-medium text-terracotta underline-offset-2 hover:underline"
            >
              save your own copy or upgrade
            </Link>
            .
          </span>
        </div>
      )}

      {hasPhotos ? (
        <PapicGalleryGrid photos={photos} eventId={eventId} kwentoDensity={kwentoDensity} />
      ) : (
        <div className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-6 text-center">
          <p className="text-sm text-ink/65">
            Your gallery fills up as your crew shoots. Share a seat link and the
            first photos land here in real time.
          </p>
          <Link
            href={`/dashboard/${eventId}/studio/papic/crew`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-700"
          >
            Set up your crew
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
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

function SettingsCard() {
  // TODO(0012): wire these toggles to per-event settings in Supabase
  // once the schema lands. For now they render as disabled previews
  // showing the V1 defaults from the spec.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 6 · settings
        </p>
        <h2 className="text-xl font-semibold tracking-tight">Capture defaults</h2>
        <p className="max-w-prose text-sm text-ink/65">
          V1 settings ship locked-down — your paparazzi never have to
          configure the app. Battery + storage warnings are the only
          surfaces that flip during a real event.
        </p>
      </div>

      <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-cream/60">
        <SettingsRow
          Icon={BatteryWarning}
          title="Battery warning at 20%"
          body="When a seat phone drops below 20%, the Papic app surfaces a manual-handoff QR so the next person on standby can claim the seat without losing any queued uploads."
          status="V1 default"
        />
        <SettingsRow
          Icon={HardDrive}
          title="Storage — app sandbox only"
          body="Captures live in the Papic app's private storage with a 24-hour purge after successful upload. Photos never leak into your paparazzo's camera roll."
          status="V1 default"
        />
        <SettingsRow
          Icon={Camera}
          title="Save copies to camera roll"
          body="Opt-in only. Defaults off — if your paparazzo wants their own copy they can flip this on inside the Papic app."
          status="Off by default"
        />
        <SettingsRow
          Icon={CircleHelp}
          title="Front camera"
          body="Front camera is disabled — Papic is rear-only so the photo quality stays high. Locked 2026-05-09."
          status="Rear only"
        />
        <SettingsRow
          Icon={Hand}
          title="Manual handoff QR"
          body="At 20% battery the upload chip flips to a handoff pill. The backup paparazzo scans the QR, the seat token transfers, and queued uploads keep draining from the old device."
          status="V1 default"
        />
      </ul>
    </article>
  );
}

function SettingsRow({
  Icon,
  title,
  body,
  status,
}: {
  Icon: typeof Camera;
  title: string;
  body: string;
  status: string;
}) {
  return (
    <li className="flex items-start gap-3 p-3 sm:p-4">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-ink/65">{body}</p>
      </div>
      <span className="ml-auto shrink-0 self-start rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
        {status}
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-xl border border-terracotta/30 bg-terracotta/5 p-3'
          : 'rounded-xl border border-ink/10 bg-cream/60 p-3'
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </p>
      <p
        className={
          accent
            ? 'mt-1 text-2xl font-semibold tracking-tight text-terracotta'
            : 'mt-1 text-2xl font-semibold tracking-tight text-ink'
        }
      >
        {value}
      </p>
    </div>
  );
}

// =============================================================================
// Integration seams — every TODO below is a real follow-up engineering ticket.
//
// 2026-05-16 update: the storage-choice radio (Section 1) is wired
// end-to-end against /api/oauth/drive/{start,callback,disconnect} +
// public.oauth_grants. The remaining TODOs are the same native-app /
// pairing / capture pipeline surfaces as before — they now have a
// well-defined branch point: events.papic_storage_target +
// oauth_grants.metadata.drive_folder_id.
//
// TODO(0012): native iOS + Android Papic capture app — phone-as-camera
//             implementation; gesture shutter; QR scan; face detection;
//             EXIF stamping; adaptive compression; background upload.
//             Pairing handshakes per SDK_MATRIX above for DSLR bridges.
// TODO(0012): capture pipeline MUST branch on events.papic_storage_target:
//             · 'setnayan_r2' → upload to R2 setnayan-media bucket via
//               the existing R2 helpers in apps/web/lib/r2.ts.
//             · 'google_drive_only' → upload to the Drive folder id in
//               oauth_grants.metadata.drive_folder_id via Drive API v3
//               (use refreshDriveAccessToken() to mint a fresh access
//               token before each session; handle 403 rateLimitExceeded
//               + 429 with exponential backoff + retry queue. Drive's
//               per-user quota is generous in aggregate but the 250 req
//               /100 s burst limit will be exceeded by a Papic crew of
//               5 paparazzi all firing at the cocktail hour).
// TODO(0012): seat QR generation — wire to 0002's QR system. Each
//             unclaimed seat needs a wedding-scoped setup link.
// TODO(0012): apply-then-pay wiring for the DSLR Pro Camera Bridge
//             purchase via 0034 service_orders flow.
// TODO(0012): integration tests — no test runner exists in apps/web
//             today. Once vitest (or similar) lands, add cases for:
//             (a) storage-choice radio default = setnayan_r2;
//             (b) Drive option disabled when GOOGLE_DRIVE_OAUTH_CLIENT_ID
//                 unset; visible "coming soon" caption;
//             (c) /api/oauth/drive/start returns 503 when env unset +
//                 302 to Google when set;
//             (d) /api/oauth/drive/callback rejects mismatched /
//                 expired state;
//             (e) bootstrap creates 5 sub-folders inside Setnayan/[event];
//             (f) setPapicStorageDrive rejects when no active grant.
// =============================================================================
