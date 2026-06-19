import type { ComponentProps } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Aperture,
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
import {
  getDriveOAuthConfig,
  PAPIC_DRIVE_SUBFOLDERS,
} from '@/lib/papic-drive';
import {
  eventOwnsPapicSeats,
  PAPIC_SEATS_PRICE_PHP,
  PAPIC_SEATS_SERVICE_KEY,
  PAPIC_SAMPLER_SEAT_COUNT,
  PAPIC_SAMPLER_PHOTO_CAP,
  PAPIC_SAMPLER_CLIP_CAP,
  PAPIC_SAMPLER_RETENTION_DAYS,
} from '@/lib/papic-seats';
import { fetchPapicGallery } from '@/lib/papic-gallery';
import { PapicGalleryGrid } from './_components/papic-gallery-grid';
import { getKwentoDensity } from '@/lib/kwento-density';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { setPapicStorageDrive, setPapicStorageR2 } from './actions';
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

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    drive_connected?: string;
    drive_disconnected?: string;
    drive_error?: string;
    storage_set?: string;
    storage_error?: string;
  }>;
};

// Seat-pack price is read live from the admin catalog (PAPIC_SEATS via
// formatV2Sku → papicSeatsPricePhp), not a hardcoded number. The former
// PAPIC_3/5_SEATS_PRICE constants are retired (owner 2026-06-18 · "admin
// pricing controls all the prices").
// Pro Camera Bridge is INCLUDED with Papic (owner 2026-06-18 · no separate
// purchase) — its former ₱1,499 SKU constant is retired.

// Mock data only. Real seat + bridge state moves to Supabase once the
// native pairing pipeline is built (TODO(0012)).
const MOCK_SEAT_PACK: 'paparazzi_5_seats' | 'paparazzi_3_seats' = 'paparazzi_5_seats';

type MockSeat = {
  id: string;
  label: string;
  claimedBy: string | null;
  proBridge: { brand: string; model: string } | null;
};

const MOCK_SEATS: ReadonlyArray<MockSeat> = [
  { id: 'seat-1', label: 'Seat 1', claimedBy: 'Tita Marites', proBridge: { brand: 'Canon', model: 'EOS R6 Mark II' } },
  { id: 'seat-2', label: 'Seat 2', claimedBy: 'Kuya Paolo', proBridge: null },
  { id: 'seat-3', label: 'Seat 3', claimedBy: 'Ate Joy', proBridge: null },
  { id: 'seat-4', label: 'Seat 4', claimedBy: null, proBridge: null },
  { id: 'seat-5', label: 'Seat 5', claimedBy: null, proBridge: null },
];

type Gesture = {
  id: string;
  title: string;
  body: string;
  Icon: typeof Camera;
};

const GESTURES: ReadonlyArray<Gesture> = [
  {
    id: 'tap',
    title: 'Tap',
    body: 'Photo, no flash. Snappy — fires on touch-up.',
    Icon: Camera,
  },
  {
    id: 'drag-up',
    title: 'Drag up',
    body: 'Photo with flash. Single pop synced to the shutter.',
    Icon: ChevronUp,
  },
  {
    id: 'drag-right',
    title: 'Drag right',
    body: '5-second clip on release. Runs the full 5 seconds — cannot be cut short.',
    Icon: ChevronRight,
  },
  {
    id: 'chord',
    title: 'Drag right → drag up',
    body: '5-second clip with flash. Torch stays on for the full clip.',
    Icon: Sparkles,
  },
];


const SDK_MATRIX = [
  { brand: 'Canon', sdk: 'EOS Camera Connect SDK', bodies: '11 V1 bodies (R-series mirrorless)' },
  { brand: 'Nikon', sdk: 'SnapBridge SDK + MTP-WiFi', bodies: '9 Z-series + 5 D-series' },
  { brand: 'Sony', sdk: 'Camera Remote SDK', bodies: '16 α / ZV / FX bodies' },
  { brand: 'Fujifilm', sdk: 'Camera Remote SDK', bodies: '14 X / GFX bodies' },
];

function seatPackLabel(pack: 'paparazzi_5_seats' | 'paparazzi_3_seats'): string {
  return pack === 'paparazzi_5_seats' ? 'Papic 5-seat pack' : 'Papic 3-seat pack';
}

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
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read the event row + the current storage target. We need display_name
  // for the header and papic_storage_target for the radio selection. The
  // column has a NOT NULL DEFAULT in the migration, so we always get a
  // value — but defensively narrow to the union type below in case a
  // future migration relaxes it.
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, papic_storage_target')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  const storageTarget: StorageTarget =
    (event.papic_storage_target as StorageTarget | null) === 'google_drive_only'
      ? 'google_drive_only'
      : 'setnayan_r2';

  // Drive-grant lookup, Papic-seat ownership, the seat SKU price, and platform
  // settings are four mutually independent reads — one parallel batch instead
  // of four serial round-trips (owner perf pass 2026-06-03). The price/settings
  // reads keep their own `.catch` fallbacks, so a failure in one never rejects
  // the batch or breaks the always-rendered Papic page.
  const [grantRaw, ownsPapicSeats, papicSeatsSku, platformSettings] =
    await Promise.all([
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
      // Seat SKU price + platform settings each tolerate failure (.catch).
      formatV2Sku(PAPIC_SEATS_SERVICE_KEY).catch(() => null),
      fetchPlatformSettings(supabase).catch(() => null),
    ]);
  const driveGrant = (grantRaw ?? null) as DriveGrant | null;

  // --- Graceful-fallback flag ---
  // When GOOGLE_DRIVE_OAUTH_CLIENT_ID is unset the Drive radio renders as
  // disabled with a "coming soon" caption underneath. The Setnayan-R2 option
  // still works. Decouples shipping the V1 surface from the owner-side Google
  // Cloud verified-app review (1-4 wk window).
  const driveConfig = getDriveOAuthConfig();
  const driveOAuthReady = driveConfig.ready;

  const papicSeatsPricePhp = papicSeatsSku?.price_php ?? PAPIC_SEATS_PRICE_PHP;

  const totalSeats = MOCK_SEATS.length;
  const claimedSeats = MOCK_SEATS.filter((s) => s.claimedBy !== null).length;
  const unclaimedSeats = totalSeats - claimedSeats;
  const bridgeSeats = MOCK_SEATS.filter((s) => s.proBridge !== null).length;

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
          paparazzo claims a seat from their own phone, shoots through the
          Papic app, and every photo or 5-second clip lands tagged in your
          gallery in real time. Below: pick where the photos write to, then
          manage your crew, camera bridges, and gallery settings.
        </p>
      </header>

      {/* ----------------------------------------------------------------
          Papic · your photo crew (PAPIC_SEATS) — the real entry point.
          Owners → the /crew management surface (provision + claim links +
          QR + reissue). Non-owners → apply-then-pay checkout via the
          InlineCheckoutDrawer. The mock crew illustration further down on
          this page stays as an explainer.
          ---------------------------------------------------------------- */}
      <section className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
              <Smartphone aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Your photo crew · 5 seats
            </p>
            <p className="max-w-prose text-sm text-ink/65">
              {ownsPapicSeats
                ? 'Your photo-crew pack is active. Set up your five seats and share a claim link with each friend.'
                : 'Turn five friends into your candid camera crew — each shoots from their own phone, and every photo lands in your gallery in real time.'}
            </p>
          </div>
          <div className="shrink-0">
            {ownsPapicSeats ? (
              <Link
                href={`/dashboard/${eventId}/studio/papic/crew`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 sm:w-auto"
              >
                Manage my 5 seats
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            ) : platformSettings ? (
              <InlineCheckoutDrawer
                eventId={eventId}
                serviceKey={PAPIC_SEATS_SERVICE_KEY}
                displayName={`Papic · 5 Seats${event.display_name ? ` · ${event.display_name}` : ''}`}
                originalPriceCentavos={String(Math.round(papicSeatsPricePhp * 100))}
                settings={platformSettings}
                triggerLabel={`Get the crew pack · ${formatPhp(papicSeatsPricePhp)}`}
                triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
              />
            ) : (
              <span className="text-sm font-mono text-ink/60">{formatPhp(papicSeatsPricePhp)}</span>
            )}
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
          Free-sampler retention — "keep your free photos" (2026-06-16)
          ----------------------------------------------------------------
          Shown only on the free sampler once there are photos that will
          expire. Two co-equal, free-first CTAs that live exactly where the
          real actions are: "keep your own copy" anchors DOWN to the storage
          card (which honors the Drive OAuth coming-soon gate itself — we
          never deep-link /api/oauth/drive/start, which 503s when env is
          unset), and "upgrade to full Papic" reuses the same InlineCheckout
          drawer the crew pack uses. */}
      {!ownsPapicSeats && samplerExpiringCount > 0 && (
        <SamplerRetentionCard
          expiringCount={samplerExpiringCount}
          daysLeft={samplerDaysLeft}
          eventId={eventId}
          pricePhp={papicSeatsPricePhp}
          eventDisplayName={event.display_name ?? null}
          settings={platformSettings}
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
        pack={MOCK_SEAT_PACK}
        pricePhp={papicSeatsPricePhp}
        seats={MOCK_SEATS}
        claimed={claimedSeats}
        unclaimed={unclaimedSeats}
        total={totalSeats}
      />

      <ProCameraBridgeCard
        seats={MOCK_SEATS}
        bridgeSeats={bridgeSeats}
        totalSeats={totalSeats}
      />

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
//   • "Upgrade to full Papic" reuses the crew pack's InlineCheckoutDrawer.
// Drive (free) renders even when platform settings are unavailable; the upgrade
// CTA only renders when settings are present (the drawer needs the QR refs).
function SamplerRetentionCard({
  eventId,
  expiringCount,
  daysLeft,
  pricePhp,
  eventDisplayName,
  settings,
}: {
  eventId: string;
  expiringCount: number;
  daysLeft: number | null;
  pricePhp: number;
  eventDisplayName: string | null;
  settings: ComponentProps<typeof InlineCheckoutDrawer>['settings'] | null;
}) {
  const ctaClass =
    'inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-mulberry/30 bg-mulberry/5 px-4 py-2.5 text-sm font-medium text-mulberry transition-colors hover:bg-mulberry/10 disabled:opacity-70';
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
          Save your own copy to Google Drive, or upgrade to full Papic to keep
          every shot forever — and unlock all five seats with unlimited photos.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link href="#papic-storage" className={ctaClass}>
          <HardDrive aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Keep your own copy — Google Drive
        </Link>
        {settings ? (
          <InlineCheckoutDrawer
            eventId={eventId}
            serviceKey={PAPIC_SEATS_SERVICE_KEY}
            displayName={`Papic · 5 Seats${eventDisplayName ? ` · ${eventDisplayName}` : ''}`}
            originalPriceCentavos={String(Math.round(pricePhp * 100))}
            settings={settings}
            triggerLabel={`Upgrade to full Papic · ${formatPhp(pricePhp)}`}
            triggerClassName={ctaClass}
          />
        ) : null}
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
  pack,
  pricePhp,
  seats,
  claimed,
  unclaimed,
  total,
}: {
  eventId: string;
  pack: 'paparazzi_5_seats' | 'paparazzi_3_seats';
  pricePhp: number;
  seats: ReadonlyArray<MockSeat>;
  claimed: number;
  unclaimed: number;
  total: number;
}) {
  // TODO(0012): wire the "Send setup QR to crew" CTA to the personal-QR
  // delivery pipeline (0002). For V1.5+ scaffold this is mock copy-link
  // only — no real QR is generated.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Section 2 · seat status
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {seatPackLabel(pack)} ·{' '}
            <span className="font-mono text-base text-terracotta">
              {formatPhp(pricePhp)}
            </span>
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {claimed}/{total} claimed
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total seats" value={total.toString()} />
        <Stat label="Claimed by crew" value={claimed.toString()} />
        <Stat label="Still open" value={unclaimed.toString()} accent={unclaimed > 0} />
      </div>

      <ul className="divide-y divide-ink/5 rounded-xl border border-ink/10 bg-cream/60">
        {seats.map((seat) => (
          <li
            key={seat.id}
            className="flex items-center justify-between gap-3 p-3 sm:p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {seat.label}
                </p>
                <p className="truncate text-xs text-ink/60">
                  {seat.claimedBy ?? 'Unclaimed — waiting for crew member'}
                </p>
              </div>
            </div>
            {seat.proBridge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                <Aperture aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                {seat.proBridge.brand}
              </span>
            ) : seat.claimedBy ? (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Phone only
              </span>
            ) : (
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                Pending
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-ink">Invite the rest of your crew</p>
            <p className="text-xs text-ink/60">
              Each unclaimed seat gets a wedding-scoped setup link — your
              paparazzo opens it on their phone and the seat token claims to
              their device.
            </p>
          </div>
          {/* TODO(0012): replace with a server action that generates a
              wedding-scoped setup QR via 0002's QR system. For now this is
              a preview placeholder — Papic native iOS/Android shells are
              V1.5+ per CLAUDE.md 2026-05-16 Papic architecture lock. */}
          <span
            className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-ink/5 px-4 py-2 text-sm font-medium text-ink/55"
            aria-label="Send setup QR to crew — coming with the Papic native app (V1.5+)"
          >
            <Share2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Send setup QR to crew
          </span>
        </div>
        <p className="rounded-md bg-ink/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          Coming with the Papic native app (V1.5+). Setup link preview:{' '}
          <span className="break-all font-mono text-ink/70">{`setnayan.com/papic/setup/${eventId}`}</span>
        </p>
      </div>
    </article>
  );
}

function ProCameraBridgeCard({
  seats,
  bridgeSeats,
  totalSeats,
}: {
  seats: ReadonlyArray<MockSeat>;
  bridgeSeats: number;
  totalSeats: number;
}) {
  // TODO(0012): wire DSLR bridge purchase into apply-then-pay (0034)
  // service_orders flow. Each bridge purchase is per device-pair,
  // multi-purchase, shared SKU between 0011 Panood and 0012 Papic.
  // TODO(0012): wire vendor SDK pairing handshakes (Canon EOS Camera
  // Connect / Nikon SnapBridge / Sony Camera Remote / Fujifilm Camera
  // Remote) into the native app — web V1 cannot speak these SDKs.
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Section 3 · DSLR Pro Camera Bridge
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Pair a real camera body —{' '}
            <span className="font-mono text-base text-success-700">
              included with Papic
            </span>
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          <Aperture aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {bridgeSeats} of {totalSeats} bridged
        </div>
      </div>

      <p className="max-w-prose text-sm text-ink/70">
        Turn one phone seat into a phone + DSLR pair. The phone keeps doing
        all of the work — gesture shutter, QR tagging, EXIF stamping,
        adaptive compression, upload — and the camera body
        provides the optical glass. Multi-purchase: one bridge per phone-
        camera pair.
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

      <div className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-3 sm:p-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Active bridges
        </p>
        {bridgeSeats === 0 ? (
          <p className="text-sm text-ink/65">
            No seats are bridged yet. Each bridge unlocks per device-pair,
            so you can mix phone-only and phone + DSLR seats however your
            crew is rigged.
          </p>
        ) : (
          <ul className="space-y-2">
            {seats
              .filter((s) => s.proBridge !== null)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-cream px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.label} · {s.claimedBy}
                    </p>
                    <p className="truncate text-xs text-ink/60">
                      Paired with {s.proBridge?.brand} {s.proBridge?.model}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
                    Active
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-xs text-ink/55">
          Bridging is included with your Papic seats — no extra purchase. One
          bridge per phone-camera pair, on whichever surface the paired phone
          is running (Papic or Panood live stream).
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-terracotta px-4 py-2 text-sm font-medium text-terracotta hover:bg-terracotta/5 disabled:opacity-70"
          disabled
          aria-label="Pair a Pro Camera Bridge to a seat (coming with native app)"
        >
          <Aperture aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Add bridge to a seat
        </button>
      </div>
    </article>
  );
}

function GestureReferenceCard() {
  return (
    <article className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Section 4 · gesture shutter
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Teach your crew the four shutter gestures
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Papic&rsquo;s shutter handles photo, photo + flash, 5-second clip,
          and 5-second clip + flash — all from one button. Front camera is
          disabled by design (rear-only, locked 2026-05-09) so the optical
          quality stays high.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GESTURES.map((g) => (
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
          Every clip is exactly 5 seconds — no shorter. Once your
          paparazzo drags right, the recording runs the full 5 seconds and
          uploads in the background. They can walk away, tag a guest,
          or shoot again — nothing is lost.
        </p>
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
