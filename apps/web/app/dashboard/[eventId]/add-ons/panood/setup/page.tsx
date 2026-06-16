import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Tv,
  Video,
  Camera,
  Sparkles,
  MonitorPlay,
  Clock3,
  CheckCircle2,
  Lock,
  Star,
  Radio,
  ExternalLink,
  Unlink2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import { CopyLink } from '../_components/copy-link';
import { savePanoodWatchUrl, clearPanoodWatchUrl } from './actions';

export const metadata = { title: 'Panood setup · Setnayan' };

// Iteration 0011 — Panood couple-facing setup + broadcaster admin surface.
//
// Rewritten 2026-05-16 per the V1 scope expansion that wires real OAuth on
// the V1.5+ scaffold setup pages (see CLAUDE.md decision log row 2026-05-16
// "OAuth wiring for V1.5+ scaffold setup pages shipped early"). The original
// scaffold (PR #86) framed the broadcast against a Cloudflare Stream Live
// SFU + Setnayan-owned master YouTube channel. The 2026-05-16 BYO-YouTube
// pricing pivot moved couples onto their own YouTube channel via OAuth —
// this rewrite swaps Section 1 from "what you've unlocked" to "connect your
// YouTube channel" and surfaces a coming-soon placeholder when the
// owner-side Google Cloud setup isn't ready yet (graceful-fallback rule).
//
// What this page is NOT: a real broadcaster. Every integration seam — SFU
// ingest, RTMP relay, AI render pipeline, projector cast, camera-operator
// handshake — is still stubbed with mock data and a `// TODO(0011):`
// marker so the real wiring drops into clear seams in follow-up iterations.

// V1.5+ price floors — see CLAUDE.md decision log row 2026-05-09 (apparatus
// rule). The 2026-05-16 BYO-YouTube pivot is pricing-only and does NOT
// change these floor numbers; SKU codes flip in the orders system (separate
// concern from this UI). Do NOT invent new prices; if the spec moves, this
// constant moves with it. All values are PHP whole pesos.
const PANOOD_BASE_PHP = 2500;
const CAMERA_ADDON_PHP = 1000;
const HOUR_ADDON_PHP = 1000;
const STYLE_PACK_PHP = 3000;
const STYLE_PACK_MODES = 4;
const AI_EDITED_HIGHLIGHT_PHP = 5000;
const CUSTOM_MONOGRAM_PHP = 1999;
const SAME_DAY_EDIT_PHP = 24999;

// Mock event state. TODO(0011): replace with a real Supabase read against
// `events.panood_state` (or wherever the orchestrator settles) once the
// schema lands. For the scaffold we surface a typical "base + 1 extra cam +
// 1 extra hour, no premium packs yet" configuration so the UI shows both
// the "owned" and "not yet owned" states side by side.
type PanoodSetup = {
  baseOwned: boolean;
  extraCameras: number;     // count of `panood_camera_addon` purchases
  extraHours: number;       // count of `panood_hour_addon` purchases
  customMonogramOwned: boolean;
  broadcastStyleOwned: boolean;
  aiEditedHighlightCount: number; // multi-purchase
  // The live watch URL is written here once the broadcaster session goes
  // live; null while the broadcast is staged but not yet running. With the
  // BYO-YouTube pivot, this URL points at the couple's own channel.
  youtubeWatchUrl: string | null;
};

function mockPanoodSetup(): PanoodSetup {
  return {
    baseOwned: true,
    extraCameras: 1,
    extraHours: 1,
    customMonogramOwned: false,
    broadcastStyleOwned: false,
    aiEditedHighlightCount: 0,
    // Mock YouTube watch URL — appears once the setup is "complete". The
    // real value lands here from the YouTube Data API after broadcast
    // creation against the couple's connected channel.
    youtubeWatchUrl: null,
  };
}

type YoutubeGrant = {
  grant_id: string;
  external_account_id: string | null;
  external_account_display: string | null;
  granted_at: string;
  metadata: { thumbnail_url?: string } | null;
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    youtube_connected?: string;
    youtube_disconnected?: string;
    youtube_error?: string;
    watch_url_saved?: string;
    watch_url_error?: string;
  }>;
};

export default async function PanoodSetupPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const {
    youtube_connected: youtubeConnected,
    youtube_disconnected: youtubeDisconnected,
    youtube_error: youtubeError,
    watch_url_saved: watchUrlSaved,
    watch_url_error: watchUrlError,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, public_id, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // --- OAuth grant lookup ---
  // RLS scopes oauth_grants by event_id IN current_event_ids(), so the
  // regular anon client is fine here — no service role needed for the read.
  const { data: grantRaw } = await supabase
    .from('oauth_grants')
    .select(
      'grant_id, external_account_id, external_account_display, granted_at, metadata',
    )
    .eq('event_id', eventId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .maybeSingle();
  const youtubeGrant = (grantRaw ?? null) as YoutubeGrant | null;

  // --- Graceful-fallback flag ---
  // When YOUTUBE_OAUTH_CLIENT_ID is unset the Connect CTA renders as a
  // disabled "coming soon" placeholder. This lets the page ship safely.
  const oauthConfig = getYoutubeOAuthConfig();
  // 2026-06-17: the programmatic YouTube-broadcast feature this OAuth connect was
  // built for is NOT implemented — shipped Panood goes live via the paste-your-
  // watch-URL flow (YouTubeDelivery below), which needs no Google scopes. The
  // youtube + youtube.upload scopes were removed from the OAuth consent screen:
  // they were dragging the WHOLE project into sensitive-scope verification + the
  // 100-user cap + the "unverified app" warning, for a feature nothing exercised
  // (the real, non-sensitive drive.file Papic/Drive flow lives elsewhere). Hold
  // this connect in its graceful "coming soon" state so no button requests the
  // now-removed scopes. Flip PANOOD_OAUTH_BROADCAST_ENABLED to true when the
  // YouTube Data API broadcast lifecycle is actually built — then re-add the
  // scopes to the consent screen and submit for verification with a working demo.
  const PANOOD_OAUTH_BROADCAST_ENABLED = false;
  const oauthReady = PANOOD_OAUTH_BROADCAST_ENABLED && oauthConfig.ready;

  const setup = mockPanoodSetup();

  // REAL watch-URL read (the first live persistence on this surface —
  // migration 20261122000000). Tolerant separate select so a pre-migration
  // environment renders the mock null instead of erroring the page; the
  // user-session client is RLS-scoped to the host's own events.
  try {
    const { data: watchRow, error: watchErr } = await supabase
      .from('events')
      .select('panood_watch_url')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!watchErr && watchRow?.panood_watch_url) {
      setup.youtubeWatchUrl = watchRow.panood_watch_url as string;
    }
  } catch {
    // pre-migration env — keep the mock null
  }

  const totalCameras = 3 + setup.extraCameras;
  const totalHours = 3 + setup.extraHours;
  const hoursConsumed = 0;
  const hoursRemaining = totalHours - hoursConsumed;

  // Stub broadcaster + camera-operator setup URLs. The slug uses the
  // event's public_id (the canonical, share-safe id) so the URL stays
  // consistent across the four hand-offs we'd make in the real system.
  const slug = event.public_id;
  const broadcasterUrl = `setnayan.com/v/panood/${slug}/broadcaster`;
  // TODO(0011): camera-operator URLs should embed a per-camera session
  // token and a per-cam slot id once the orchestrator can mint them.
  const cameraUrl = (n: number) => `setnayan.com/v/panood/${slug}/cam/${n}`;

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/add-ons/panood`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Panood · live broadcast
        </p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Tv aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Broadcast your wedding live
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Connect your YouTube channel, set up the broadcaster, send a setup link to each
          camera operator, and we&rsquo;ll relay the composited feed to your own channel
          so family abroad can watch in real time. Highlight markers, projector cast, and
          auto-archive are included in the base SKU.
        </p>
      </header>

      {youtubeConnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          YouTube connected
          {youtubeGrant?.external_account_display
            ? ` — ${youtubeGrant.external_account_display}`
            : ''}
          . Your broadcast will go live on this channel.
        </p>
      ) : null}

      {youtubeDisconnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/75"
        >
          <Unlink2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          YouTube disconnected. Reconnect any time to re-enable the broadcast.
        </p>
      ) : null}

      {youtubeError ? (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          <span>
            YouTube connection failed (
            <span className="font-mono text-xs">{youtubeError}</span>
            ). Try again, or contact support if this persists.
          </span>
        </p>
      ) : null}

      <YoutubeConnect
        eventId={eventId}
        oauthReady={oauthReady}
        youtubeGrant={youtubeGrant}
      />

      <SetupStatus
        eventId={eventId}
        setup={setup}
        totalCameras={totalCameras}
        totalHours={totalHours}
        hoursConsumed={hoursConsumed}
        hoursRemaining={hoursRemaining}
      />

      <BroadcastSetup
        eventId={eventId}
        broadcasterUrl={broadcasterUrl}
        cameraUrl={cameraUrl}
        totalCameras={totalCameras}
      />

      <StyleAndAddOns setup={setup} />

      <YouTubeDelivery
        eventId={eventId}
        youtubeWatchUrl={setup.youtubeWatchUrl}
        connected={!!youtubeGrant}
        watchUrlSaved={Boolean(watchUrlSaved)}
        watchUrlError={Boolean(watchUrlError)}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Section 1 — Connect YouTube
// -----------------------------------------------------------------------------
// The OAuth entry point. Three states:
//   1. oauthReady=false → "coming soon — admin setup pending" placeholder.
//   2. oauthReady=true + no grant → "Connect" CTA pointing at /api/oauth/youtube/start.
//   3. oauthReady=true + grant → "Connected to <channel>" + disconnect form.

function YoutubeConnect({
  eventId,
  oauthReady,
  youtubeGrant,
}: {
  eventId: string;
  oauthReady: boolean;
  youtubeGrant: YoutubeGrant | null;
}) {
  return (
    <section
      aria-labelledby="youtube-connect-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 1 · connect your channel
        </p>
        <h2
          id="youtube-connect-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Tv aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Connect your YouTube channel
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Panood broadcasts to <em>your</em> YouTube channel — your family controls who
          subscribes, the archive belongs to you, and the watch URL is yours forever. We
          request the minimum scopes needed to create + manage the live broadcast.
        </p>
      </div>

      {!oauthReady ? (
        <ComingSoonPlaceholder />
      ) : youtubeGrant ? (
        <ConnectedPanel eventId={eventId} grant={youtubeGrant} />
      ) : (
        <ConnectCTA eventId={eventId} />
      )}

      <ul className="grid gap-2 text-xs text-ink/55 sm:grid-cols-2">
        <li className="rounded-md border border-ink/10 bg-cream/70 px-3 py-2">
          <span className="font-mono text-ink/65">Scopes requested:</span> YouTube manage
          + upload (broadcast lifecycle + same-day-edit archive).
        </li>
        <li className="rounded-md border border-ink/10 bg-cream/70 px-3 py-2">
          <span className="font-mono text-ink/65">One-time consent:</span> disconnect any
          time from this page; we revoke the grant on Google&rsquo;s side too.
        </li>
      </ul>
    </section>
  );
}

function ComingSoonPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-cream/60 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/55"
        >
          <Lock className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink/85">
            Coming soon — admin setup pending
          </p>
          <p className="max-w-prose text-xs text-ink/60">
            Setnayan&rsquo;s YouTube OAuth verified-app review is still in progress with
            Google (the review window is 1–4 weeks). Once it clears, the Connect button
            lights up here and your broadcast goes live to your own channel. We&rsquo;ll
            email you the moment it&rsquo;s ready.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectCTA({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-terracotta/30 bg-cream/80 p-5">
      <Link
        href={`/api/oauth/youtube/start?event_id=${eventId}`}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
      >
        <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Connect YouTube
      </Link>
      <p className="text-xs text-ink/55">
        You&rsquo;ll be redirected to Google to grant access, then bounced back here.
        Takes about 20 seconds.
      </p>
    </div>
  );
}

function ConnectedPanel({
  eventId,
  grant,
}: {
  eventId: string;
  grant: YoutubeGrant;
}) {
  const channelLabel =
    grant.external_account_display ?? 'Connected channel';
  const grantedDate = new Date(grant.granted_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink">
              Connected to YouTube: {channelLabel}
            </p>
            <p className="font-mono text-[11px] text-ink/55">
              {grant.external_account_id
                ? `Channel id ${grant.external_account_id} · `
                : ''}
              Connected {grantedDate}
            </p>
          </div>
        </div>
        <form action="/api/oauth/youtube/disconnect" method="post">
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Disconnect
          </button>
        </form>
      </div>
      <p className="text-xs text-ink/65">
        We&rsquo;ll create the live broadcast on this channel with{' '}
        <span className="font-mono text-ink/80">monetization=false</span> and{' '}
        <span className="font-mono text-ink/80">latencyPreference=ultraLow</span> the
        moment the broadcaster opens for the first time.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section 2 — Setup status (SKU summary)
// -----------------------------------------------------------------------------

function SetupStatus({
  eventId,
  setup,
  totalCameras,
  totalHours,
  hoursConsumed,
  hoursRemaining,
}: {
  eventId: string;
  setup: PanoodSetup;
  totalCameras: number;
  totalHours: number;
  hoursConsumed: number;
  hoursRemaining: number;
}) {
  return (
    <section
      aria-labelledby="setup-status-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Step 2 · what you&rsquo;ve unlocked
          </p>
          <h2 id="setup-status-heading" className="text-xl font-semibold tracking-tight">
            Your Panood package
          </h2>
        </div>
        {setup.baseOwned ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Live Stream base owned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Base SKU not yet purchased
          </span>
        )}
      </div>

      <p className="text-sm text-ink/70">
        Live Stream base &middot; 1 broadcaster + 3 cameras + 3hr capacity &middot;{' '}
        <span className="font-mono text-ink">{formatPhp(PANOOD_BASE_PHP)}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Cameras"
          value={`${totalCameras}`}
          sub={
            setup.extraCameras > 0
              ? `3 base + ${setup.extraCameras} add-on${setup.extraCameras === 1 ? '' : 's'}`
              : '3 base · no add-ons yet'
          }
          Icon={Camera}
        />
        <Stat
          label="Stream-capacity hours"
          value={`${hoursRemaining}`}
          sub={`${hoursConsumed} used / ${totalHours} total`}
          Icon={Clock3}
        />
        <Stat
          label="Highlight markers"
          value="Unlimited"
          sub="Included in base"
          Icon={Star}
        />
      </div>

      <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 bg-cream/60 text-sm">
        <AddOnRow
          label="Live Stream base (1 broadcaster · 3 cams · 3hr)"
          price={formatPhp(PANOOD_BASE_PHP)}
          owned={setup.baseOwned}
        />
        <AddOnRow
          label={`+1 camera (${setup.extraCameras} purchased · max 2)`}
          price={`${formatPhp(CAMERA_ADDON_PHP)} each`}
          owned={setup.extraCameras > 0}
        />
        <AddOnRow
          label={`+1 hour (${setup.extraHours} purchased · unlimited)`}
          price={`${formatPhp(HOUR_ADDON_PHP)} each`}
          owned={setup.extraHours > 0}
        />
      </ul>

      <p className="text-xs text-ink/55">
        Need more cameras or hours? Open the{' '}
        <Link
          href={`/dashboard/${eventId}/orders/new?service=panood-add-on`}
          className="text-terracotta hover:underline"
        >
          orders page
        </Link>{' '}
        &mdash; same apply-then-pay flow as every other Setnayan purchase. Prices are
        locked V1; we never auto-charge.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Camera;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/80 p-3">
      <div className="flex items-center gap-2 text-ink/60">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{sub}</p>
    </div>
  );
}

function AddOnRow({
  label,
  price,
  owned,
}: {
  label: string;
  price: string;
  owned: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <span className="flex items-center gap-2 text-ink/80">
        {owned ? (
          <CheckCircle2
            aria-hidden
            className="h-4 w-4 text-emerald-600"
            strokeWidth={2}
          />
        ) : (
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full border border-ink/20"
          />
        )}
        {label}
      </span>
      <span className="font-mono text-xs text-ink/65">{price}</span>
    </li>
  );
}

// -----------------------------------------------------------------------------
// Section 3 — Broadcast setup (broadcaster + camera operator links)
// -----------------------------------------------------------------------------

function BroadcastSetup({
  eventId,
  broadcasterUrl,
  cameraUrl,
  totalCameras,
}: {
  eventId: string;
  broadcasterUrl: string;
  cameraUrl: (n: number) => string;
  totalCameras: number;
}) {
  return (
    <section
      aria-labelledby="broadcast-setup-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 3 · broadcaster + cameras
        </p>
        <h2
          id="broadcast-setup-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Get the broadcaster + cameras online
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          The broadcaster runs the show: switches between cameras, marks highlights, and
          decides when to cut to standby. Each camera is a phone running the Panood
          camera-operator web client &mdash; no install, just open the link.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-ink/10 bg-cream/70 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Video aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Broadcaster URL
          </h3>
          <p className="text-sm text-ink/65">
            Open this on a laptop or tablet on broadcast day. Recommended: a screen with
            enough room for the camera grid plus the program feed.
          </p>
          <CopyLink
            label="Broadcaster admin"
            url={broadcasterUrl}
            hint="Only the broadcaster should hold this link. Single concurrent session."
          />
          <Link
            href={`/dashboard/${eventId}/add-ons/panood/broadcast`}
            className="inline-flex items-center gap-2 rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <Tv aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Open broadcaster preview
          </Link>
        </article>

        <article className="space-y-3 rounded-xl border border-ink/10 bg-cream/70 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Camera aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Camera operators
          </h3>
          <p className="text-sm text-ink/65">
            Send each operator their own setup link. The web client runs on any modern
            phone browser; no install required.
          </p>
          <div className="space-y-3">
            {Array.from({ length: Math.min(totalCameras, 3) }, (_, i) => i + 1).map((n) => (
              <CopyLink
                key={n}
                label={`Camera ${n} setup link`}
                url={cameraUrl(n)}
                hint={
                  n === 1
                    ? 'Camera 1 is the default wide / program-camera mic source.'
                    : undefined
                }
              />
            ))}
          </div>
          {totalCameras > 3 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              You&rsquo;ve added {totalCameras - 3} extra camera
              {totalCameras - 3 === 1 ? '' : 's'} &mdash; setup links for cameras 4
              {totalCameras > 4 ? '/5' : ''} appear once the broadcaster session opens.
            </p>
          ) : null}
        </article>
      </div>

      <p className="text-xs text-ink/55">
        Pro tip: each phone needs ~500 kbps sustained upload. Run the Venue Check tool a
        week ahead to flag low-connectivity venues so you can rent a portable hotspot if
        needed.
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Section 4 — Style + add-ons promo
// -----------------------------------------------------------------------------

function StyleAndAddOns({ setup }: { setup: PanoodSetup }) {
  return (
    <section
      aria-labelledby="addons-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 4 · optional packs
        </p>
        <h2
          id="addons-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Sparkles aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Make it look like a film
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Optional packs that elevate the broadcast and the post-event recap. Buy any of
          them through the normal orders flow; refunds follow the standard 24-hour SLA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PackCard
          Icon={Sparkles}
          title="Broadcast Style Pack"
          price={formatPhp(STYLE_PACK_PHP)}
          owned={setup.broadcastStyleOwned}
          blurb={`${STYLE_PACK_MODES} modes (News · Cinematic · Sports · Royalty) + transitions + color presets. Switch modes mid-event from the broadcaster admin.`}
          state="purchasable"
        />
        <PackCard
          Icon={Video}
          title="AI Edited Highlight"
          price={`${formatPhp(AI_EDITED_HIGHLIGHT_PHP)} / 3 min`}
          owned={setup.aiEditedHighlightCount > 0}
          blurb="A 3-minute storyline cut of the event — beats, music, and pacing chosen by Claude vision. Multi-purchase if you want alternate cuts."
          state="purchasable"
        />
        <PackCard
          Icon={Star}
          title="Custom Monogram Pack"
          price={formatPhp(CUSTOM_MONOGRAM_PHP)}
          owned={setup.customMonogramOwned}
          blurb="Replaces Setnayan branding on the broadcast watermark, intro/outro, and landing-page chrome. Includes Custom Standby screens."
          state="purchasable"
        />
        <PackCard
          Icon={Video}
          title="Same-Day Edit"
          price={`${formatPhp(SAME_DAY_EDIT_PHP)} flagship`}
          owned={false}
          blurb="The cinematic 3–5 minute film, delivered before the reception ends. Played live on the LED background screen at the climactic moment."
          state="v1_1"
        />
      </div>

      <p className="text-xs text-ink/55">
        Highlight markers (the &ldquo;★ Mark&rdquo; button on the broadcaster) and cast-to-projector
        are <span className="font-medium text-ink/75">free</span> with the base SKU.
      </p>
    </section>
  );
}

function PackCard({
  Icon,
  title,
  price,
  blurb,
  owned,
  state,
}: {
  Icon: typeof Sparkles;
  title: string;
  price: string;
  blurb: string;
  owned: boolean;
  state: 'purchasable' | 'v1_1';
}) {
  const disabled = state === 'v1_1';
  const cardClass = disabled
    ? 'flex h-full flex-col gap-3 rounded-xl border border-dashed border-ink/15 bg-cream/50 p-4 opacity-80'
    : 'flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream/80 p-4';

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {owned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-900">
            <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
            Owned
          </span>
        ) : disabled ? (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            V1.1 · coming soon
          </span>
        ) : (
          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            Add-on
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="font-mono text-xs text-ink/65">{price}</p>
      </div>
      <p className="text-sm text-ink/70">{blurb}</p>
      <div className="mt-auto">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink/45">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Not yet available
          </span>
        ) : owned ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Active on this event
          </span>
        ) : (
          <span className="text-xs text-ink/55">
            Open the orders page to purchase. Refundable per the standard 24-hour SLA.
          </span>
        )}
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Section 5 — YouTube delivery info
// -----------------------------------------------------------------------------
// Reworded slightly from the original scaffold to reflect the BYO pivot:
// the broadcast goes to the couple's connected channel (when present),
// not the Setnayan master channel. Latency/audience/auto-archive facts
// are unchanged.

function YouTubeDelivery({
  eventId,
  youtubeWatchUrl,
  connected,
  watchUrlSaved,
  watchUrlError,
}: {
  eventId: string;
  youtubeWatchUrl: string | null;
  connected: boolean;
  watchUrlSaved: boolean;
  watchUrlError: boolean;
}) {
  return (
    <section
      aria-labelledby="youtube-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 5 · how viewers watch
        </p>
        <h2
          id="youtube-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          How viewers watch
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Setnayan ingests every camera, composites them server-side with your monogram
          and broadcast style, then relays the program feed to YouTube Live on your own
          channel. Viewers watching on your Setnayan landing page and viewers watching on
          YouTube directly see the same broadcast served from YouTube&rsquo;s CDN.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <DeliveryFact
          label="End-to-end latency"
          value="~10 seconds"
          sub="Ultra-low-latency mode + a couple seconds of composite headroom"
        />
        <DeliveryFact
          label="Audience cap"
          value="Unlimited"
          sub="YouTube&rsquo;s CDN handles 100 or 100,000 viewers at no extra cost"
        />
        <DeliveryFact
          label="Auto-archive"
          value="Unlisted on your own channel"
          sub="Downloadable from your dashboard after the event — the archive stays yours"
        />
        <DeliveryFact
          label="Cast to projector"
          value="Included free"
          sub="HDMI from the broadcaster device — full polished feed on a laptop, raw camera feed on iPhone"
        />
      </ul>

      <div className="rounded-lg border border-ink/10 bg-cream/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          YouTube watch URL
        </p>
        {watchUrlSaved ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Saved — guests see Watch
            Live on the big day.
          </p>
        ) : null}
        {watchUrlError ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/10 px-2.5 py-1 text-xs text-terracotta-700">
            <AlertCircle aria-hidden className="h-3.5 w-3.5" /> That doesn&rsquo;t look
            like a YouTube link — paste the watch or share URL.
          </p>
        ) : null}
        {youtubeWatchUrl ? (
          <>
            <p className="mt-1 font-mono text-sm text-ink/85">{youtubeWatchUrl}</p>
            <p className="mt-1 text-xs text-ink/55">
              During the live window, your wedding page shows a Watch Live player with
              this broadcast — front and center for the loved ones watching from afar.
            </p>
            <form action={clearPanoodWatchUrl} className="mt-3">
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
              >
                <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove link
              </button>
            </form>
          </>
        ) : connected ? (
          <p className="mt-1 text-sm text-ink/60">
            Available once the broadcaster opens the session for the first time.
            We&rsquo;ll auto-create the broadcast on your channel with{' '}
            <span className="font-mono text-ink/75">monetization=false</span> and
            <span className="font-mono text-ink/75"> latencyPreference=ultraLow</span>{' '}
            so the broadcast is structurally incapable of running ads.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">
            Connect your YouTube channel in step 1 to enable the broadcast. The watch
            URL appears here the moment the broadcaster opens the session for the first
            time.
          </p>
        )}

        {!youtubeWatchUrl ? (
          <form action={savePanoodWatchUrl} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="url"
              name="watch_url"
              required
              placeholder="Paste your YouTube watch link — youtube.com/watch?v=…"
              className="min-h-[44px] flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90"
            >
              <Radio aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save watch link
            </button>
          </form>
        ) : null}
        {!youtubeWatchUrl ? (
          <p className="mt-2 text-xs text-ink/50">
            Already created your broadcast on YouTube yourself? Paste its link here and
            your wedding page shows Watch Live during the celebration — no need to wait
            for the broadcaster hand-off.
          </p>
        ) : null}
      </div>

      <p className="text-xs text-ink/55">
        Want to share with smart-TV viewers? Once the broadcast is live, the YouTube
        watch URL can be cast to any Chromecast / Apple TV / Fire TV &mdash; the same URL
        works on every device.
      </p>
    </section>
  );
}

function DeliveryFact({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <li className="rounded-lg border border-ink/10 bg-cream/70 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{sub}</p>
    </li>
  );
}

// =============================================================================
// Integration seams — every TODO below is a real follow-up engineering ticket.
// Listed here in one place so a future iteration can grep for the marker and
// see the entire shape of the work without reading every JSX block.
//
// 2026-05-16 update: the OAuth connect surface (step 1) is wired end-to-end
// against /api/oauth/youtube/start + /callback + /disconnect against
// public.oauth_grants. The remaining TODOs are the same broadcaster /
// orchestrator surface as before — just now they read the per-event
// refresh_token out of oauth_grants instead of the retired
// Setnayan-master-channel path.
//
// TODO(0011): Cloudflare Stream Live SFU connection — ingest WebRTC publishes
//             from each camera operator's phone; per-camera health pings up
//             to the broadcaster admin grid. Vendor entitlement is a Stripe
//             billing prerequisite Setnayan does not yet have.
// TODO(0011): YouTube RTMP relay — create the per-event broadcast on the
//             COUPLE's channel via the YouTube Data API with
//             monetization=false + latencyPreference=ultraLow, push the
//             composited program feed via RTMP, and write the resulting
//             watch URL back to the event row so the landing page can embed
//             the IFrame Player. Uses oauth_grants.refresh_token (refreshed
//             via /api/cron/oauth-refresh) for the per-event access token.
// TODO(0011): Camera-operator handshake / session tokens — mint a short-
//             lived per-cam token at the moment the broadcaster issues a
//             "Send setup link" CTA. Token binds the phone to a specific
//             slot id so reconnects survive battery handoffs.
// TODO(0011): AI Edited Highlight render pipeline — pull from the YouTube
//             archive once recording lands, run the Claude vision pass on
//             the captured clips, render a 3-min cut via Remotion + Lottie
//             + LUT in the matching feel-category template.
// TODO(0011): Broadcast Style Pack runtime mode switching — the ffmpeg
//             compositor reads `events.panood_state.style_mode` per frame.
//             Mode switching is a JSONB patch the broadcaster admin pushes
//             via a server action.
// TODO(0011): Projector cast — wire the laptop popup-window + iPhone
//             external-display flow on the broadcaster admin. WebRTC client
//             pulls the composited feed (laptop) or raw active-camera feed
//             (iPhone) into a fullscreen <video> for the secondary display.
// TODO(0011): integration tests — no test runner exists in apps/web today.
//             Once vitest (or similar) lands, add cases for: (a) /start
//             returns 503 when env vars missing + 302 to Google when set;
//             (b) /callback rejects mismatched/expired state; (c) page
//             renders coming-soon when oauthReady=false, Connect when true.
// =============================================================================
