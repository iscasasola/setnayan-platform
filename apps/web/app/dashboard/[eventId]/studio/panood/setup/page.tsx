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
import {
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
} from '@/lib/panood-broadcast';
import { eventSkuActive } from '@/lib/entitlements';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { savePanoodWatchUrl, clearPanoodWatchUrl } from './actions';
import { GoLiveCard } from './go-live-card';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Live Studio setup · Setnayan' };

// Iteration 0011 — Live Studio couple-facing setup + broadcaster admin surface.
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

// V1.5+ style pack mode count — descriptive copy only (the pack itself has no
// admin-catalog SKU yet, so its price is honest-stated as "arrives with the
// streaming rollout" below rather than hardcoded — owner rule: prices live in
// the admin catalog via formatV2Sku, never as a constant in code).
const STYLE_PACK_MODES = 4;

// Real per-event Live Studio ownership. 2026-06-25 honesty pass (see CLAUDE.md
// decision log): the prior mockPanoodSetup() faked baseOwned:true + an extra
// cam/hour + null packs regardless of what the couple actually bought. This
// type now reflects ONLY what has a real source:
//   • baseOwned          ← eventSkuActive(PANOOD_SYSTEM) (orders.status) — owns
//                          the PAID multicam control-room upgrade
//   • customMonogramOwned← eventSkuActive(ANIMATED_MONOGRAM)
//   • youtubeWatchUrl    ← events.panood_watch_url (existing real read)
// Camera/hour add-ons, the Broadcast Style Pack, and the AI Edited Highlight
// have NO admin-catalog SKU and NO orders source in V1 (confirmed against the
// live catalog + orders table), so they are NOT modeled as fake counts/flags
// here — the UI honest-states them as "arrives with the streaming rollout".
type PanoodSetup = {
  baseOwned: boolean;
  customMonogramOwned: boolean;
  // The live watch URL is written here once the broadcaster session goes
  // live; null while the broadcast is staged but not yet running. With the
  // BYO-YouTube pivot, this URL points at the couple's own channel.
  youtubeWatchUrl: string | null;
};

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
    .select('event_id, display_name')
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
  // disabled "coming soon" placeholder. This lets the page ship safely
  // before the owner finishes Google Cloud verified-app review (1-4wk).
  const oauthConfig = await getYoutubeOAuthConfig();
  const oauthReady = oauthConfig.ready;

  // REAL per-event ownership, read from orders (bundle-aware, refund-aware,
  // admin-approval-gated) — replaces the old mockPanoodSetup() that faked a
  // base + add-on config. eventSkuActive degrades to false on a missing orders
  // table (42P01/42703), so a pre-bootstrap env safely shows "not owned".
  const [baseOwned, customMonogramOwned] = await Promise.all([
    eventSkuActive(supabase, eventId, 'PANOOD_SYSTEM'),
    eventSkuActive(supabase, eventId, 'ANIMATED_MONOGRAM'),
  ]);

  const setup: PanoodSetup = {
    baseOwned,
    customMonogramOwned,
    youtubeWatchUrl: null,
  };

  // REAL watch-URL read (the first live persistence on this surface —
  // migration 20261122000000). Tolerant separate select so a pre-migration
  // environment renders null instead of erroring the page; the user-session
  // client is RLS-scoped to the host's own events.
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
    // pre-migration env — keep null
  }

  // REAL broadcast state (Phase 1 one-tap go-live). getActivePanoodBroadcast /
  // getActivePanoodStreamKey use the service-role admin client (the table holds
  // the secret stream_key, RLS-policy-less). Wrapped so a pre-migration env
  // (missing panood_broadcasts table) renders "no active broadcast" instead of
  // crashing the page — same graceful-degrade posture as the watch-URL read.
  let activeBroadcast: Awaited<ReturnType<typeof getActivePanoodBroadcast>> = null;
  let activeStreamKey: string | null = null;
  try {
    activeBroadcast = await getActivePanoodBroadcast(eventId);
    if (activeBroadcast) {
      activeStreamKey = await getActivePanoodStreamKey(eventId);
    }
  } catch {
    // pre-migration env — keep null (no active broadcast)
  }

  // REAL pricing from the admin catalog (formatV2Sku). PANOOD_SYSTEM is NOT
  // priced here: single-cam Live Studio live is FREE for every host (owner model
  // 2026-06-26) and PANOOD_SYSTEM is the PAID multicam control-room upgrade
  // (built at /studio/panood/broadcast). The Animated-Monogram add-on
  // keeps its real catalog price;
  // the Broadcast Style Pack / AI Edited Highlight have NO V2 SKU yet, so those
  // surfaces honest-state "arrives with the streaming rollout" instead of a
  // price (owner rule: never hardcode a price).
  const monogramSku = await formatV2Sku('ANIMATED_MONOGRAM').catch(() => null);
  const monogramPriceLabel = monogramSku ? formatPhp(monogramSku.price_php) : null;

  // Single-camera live broadcast is the free core tool (no per-day SKU charge).
  // Today couples stream from their own phone or OBS to their own YouTube, so
  // this surface claims no camera count — the multi-camera control room is the
  // PAID upgrade (built at /studio/panood/broadcast).

  return (
    <section className="space-y-8">
      <Link
        href={`/dashboard/${eventId}/studio/panood`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Live Studio
      </Link>

      <header className="sn-reveal space-y-2">
        <p className="sn-eye">Setup</p>
        <h1 className="sn-h1 flex items-center gap-3">
          <Tv aria-hidden className="h-7 w-7 text-terracotta" strokeWidth={1.75} />
          Broadcast your wedding live
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Connect your YouTube channel, go live from your phone or OBS, and Setnayan
          embeds your broadcast on your event page so family abroad can watch in real
          time. The watch URL and auto-archive stay on your own channel. Want more
          than one camera? The Setnayan multicam control room — the paid upgrade —
          lets you switch between several phones with broadcast-style overlays.
        </p>
      </header>

      {youtubeConnected ? (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-2xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-900"
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
          className="inline-flex items-start gap-2 rounded-2xl border border-danger-300/70 bg-danger-50 px-4 py-3 text-sm text-danger-900"
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

      <GoLiveCard
        eventId={eventId}
        oauthReady={oauthReady}
        connected={!!youtubeGrant}
        // Single-cam go-live is FREE for any host (owner model 2026-06-26 —
        // "the tool is free; the premium layer is paid"). This page is already
        // host-gated, so anyone who can see it may go live without owning the
        // PANOOD_SYSTEM SKU (that SKU is the PAID multicam control-room + over-
        // lays upgrade, built at /studio/panood/broadcast). Pass true to unlock
        // the go-live button; the add-on rows below still reflect REAL ownership.
        ownsPanood={true}
        active={
          activeBroadcast
            ? {
                broadcastId: activeBroadcast.broadcast_id,
                ingestionUrl: activeBroadcast.ingestion_url,
                status: activeBroadcast.status,
                // broadcast_id IS the public videoId — derive the canonical
                // watch URL directly so this doesn't depend on the watch-URL
                // read order below.
                watchUrl: `https://www.youtube.com/watch?v=${activeBroadcast.broadcast_id}`,
              }
            : null
        }
        streamKey={activeStreamKey}
      />

      <SetupStatus eventId={eventId} />

      <BroadcastSetup eventId={eventId} />

      <StyleAndAddOns
        setup={setup}
        styleModes={STYLE_PACK_MODES}
        monogramPriceLabel={monogramPriceLabel}
      />

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
      className="sn-tile space-y-4 p-5 sm:p-6"
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
          Live Studio broadcasts to <em>your</em> YouTube channel — your family controls who
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
          + upload (broadcast lifecycle + recording archive).
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
    <div className="sn-row p-5">
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
    <div className="space-y-3 rounded-xl border border-success-200/80 bg-success-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-success-100 text-success-700"
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
          <SubmitButton
            pendingLabel="Disconnecting…"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Disconnect
          </SubmitButton>
        </form>
      </div>
      <p className="text-xs text-ink/65">
        Your broadcast goes live on this channel — start it from the YouTube app or OBS,
        then paste the watch link below so it appears on your event page. Automatic
        broadcast creation (with ads switched off) arrives with the streaming rollout.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Section 2 — Setup status (SKU summary)
// -----------------------------------------------------------------------------

function SetupStatus({ eventId }: { eventId: string }) {
  return (
    <section
      aria-labelledby="setup-status-heading"
      className="sn-tile space-y-4 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="sn-eye">
            Step 2 · what you get
          </p>
          <h2 id="setup-status-heading" className="text-xl font-semibold tracking-tight">
            Your Live Studio broadcast
          </h2>
        </div>
        {/* Single-cam live broadcast is FREE for any host (owner model
            2026-06-26). The green "Included" badge always shows; the
            PANOOD_SYSTEM SKU is the PAID multicam control-room upgrade. */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-3 py-1 text-xs font-medium text-success-900">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Included free
        </span>
      </div>

      <p className="text-sm text-ink/70">
        Single-camera live broadcast &middot; one event-day, embedded on your event
        page, YouTube delivery + auto-archive on your own channel &middot;{' '}
        <span className="font-medium text-success-700">free for every couple</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Where it plays"
          value="Your event page"
          sub="Embedded in your colors"
          Icon={MonitorPlay}
        />
        <Stat
          label="Coverage"
          value="One event-day"
          sub="Add a day per event-day"
          Icon={Clock3}
        />
        <Stat
          label="Viewers"
          value="Unlimited"
          sub="Free on YouTube"
          Icon={Star}
        />
      </div>

      <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 bg-cream/60 text-sm">
        {/* Single-cam live broadcast — FREE for every host (owner model
            2026-06-26), so it always shows as included rather than as a paid,
            owned-gated row. */}
        <AddOnRow
          label="Single-camera live broadcast (embedded on your event page)"
          price="Free"
          owned={true}
        />
      </ul>

      <div className="sn-row p-3 text-xs text-ink/60">
        <p className="font-medium text-ink/75">The multi-camera control room — the paid upgrade</p>
        <p className="mt-1">
          Going live with one camera is free. The Setnayan multi-camera control
          room — switch between several phone cameras, mark highlights, cut to
          standby, with broadcast-style overlays — is the paid upgrade. See what
          it does on the{' '}
          <Link
            href={`/dashboard/${eventId}/studio/panood`}
            className="text-terracotta hover:underline"
          >
            Live Studio page
          </Link>
          .
        </p>
      </div>
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
            className="h-4 w-4 text-success-600"
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

function BroadcastSetup({ eventId }: { eventId: string }) {
  return (
    <section
      aria-labelledby="broadcast-setup-heading"
      className="sn-tile space-y-4 p-5 sm:p-6"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="sn-eye">
            Step 3 · broadcaster + cameras
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            <Star aria-hidden className="h-3 w-3" strokeWidth={2} />
            Paid upgrade
          </span>
        </div>
        <h2
          id="broadcast-setup-heading"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          The multi-camera control room
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Going live with one camera from your own phone or OBS is free. The Setnayan
          multicam control room is the paid upgrade: one broadcaster who switches between
          several phone cameras, marks highlights, and cuts to standby — each camera a
          phone running the Live Studio operator web client, no install. Open the control room
          below to set it up.
        </p>
      </div>

      {/* Honest state: the control room is built (foundation PR1-5), but the
          live per-camera ingest + camera-operator session links are minted by
          the streaming engine, which finishes wiring with the streaming rollout.
          We don't show a fake setnayan.com/... URL here — instead we point at the
          real control room and keep an honest note on the live camera links. */}
      <div className="sn-row p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/55"
          >
            <Clock3 className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink/85">
              Live camera links finish with the streaming rollout
            </p>
            <p className="max-w-prose text-xs text-ink/60">
              On broadcast day you&rsquo;ll run the control room from a single broadcaster
              link, plus a private setup link for each camera operator — no install, just
              open on any modern phone. The control room is built and you can open it now;
              the live per-camera ingest finishes wiring with the streaming rollout, and
              we&rsquo;ll email you the moment it&rsquo;s ready.
            </p>
          </div>
        </div>
      </div>

      <article className="space-y-3 rounded-xl border border-ink/10 bg-cream/70 p-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Video aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Open the control room
        </h3>
        <p className="text-sm text-ink/65">
          Lay out the broadcaster admin and rehearse the camera switching so you and your
          camera operators are ready ahead of the day.
        </p>
        <Link
          href={`/dashboard/${eventId}/studio/panood/broadcast`}
          className="inline-flex items-center gap-2 rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          <Tv aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Open the control room
        </Link>
      </article>

      <p className="text-xs text-ink/55">
        Pro tip: each phone needs ~500 kbps sustained upload — once streaming is live,
        run a venue connectivity check a week ahead so you can rent a portable hotspot if
        needed.
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Section 4 — Style + add-ons promo
// -----------------------------------------------------------------------------

function StyleAndAddOns({
  setup,
  styleModes,
  monogramPriceLabel,
}: {
  setup: PanoodSetup;
  styleModes: number;
  monogramPriceLabel: string | null;
}) {
  return (
    <section
      aria-labelledby="addons-heading"
      className="sn-tile space-y-4 p-5 sm:p-6"
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
          Optional packs that elevate the broadcast and the post-event recap. Prices are
          set in the Setnayan catalog; buy through the normal orders flow and refunds
          follow the standard 24-hour SLA.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Animated Monogram — REAL admin-catalog SKU (ANIMATED_MONOGRAM). Owned
            state is real (eventSkuActive). */}
        <PackCard
          Icon={Star}
          title="Animated Monogram"
          price={monogramPriceLabel}
          owned={setup.customMonogramOwned}
          blurb="Your bespoke monogram across your event-page chrome today — and on the broadcast watermark, intro/outro and standby screens when the streaming control room arrives."
          state="purchasable"
        />
        {/* Broadcast Style Pack — NO admin-catalog SKU in V1 (no real price source),
            so we honest-state it as arriving with the streaming rollout rather than
            inventing a price. */}
        <PackCard
          Icon={Sparkles}
          title="Broadcast Style Pack"
          price={null}
          owned={false}
          blurb={`${styleModes} broadcast looks (News · Cinematic · Sports · Royalty) with transitions and color presets, switchable mid-event from the broadcaster admin.`}
          state="rollout"
        />
        {/* AI Edited Highlight — NO admin-catalog SKU in V1 (retired V1 code, no V2
            successor), so honest-stated as arriving with the streaming rollout. */}
        <PackCard
          Icon={Video}
          title="AI Edited Highlight"
          price={null}
          owned={false}
          blurb="A storyline cut of the broadcast — beats, music, and pacing chosen by Setnayan AI — pulled from the auto-archive after the event."
          state="rollout"
        />
      </div>

      <p className="text-xs text-ink/55">
        Highlight markers (the &ldquo;★ Mark&rdquo; button on the broadcaster) and cast-to-projector
        arrive <span className="font-medium text-ink/75">free</span> with the streaming control
        room &mdash; coming with the rollout.
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
  // null when there is no real admin-catalog price source (the pack hasn't
  // launched) — the card honest-states "arrives with the streaming rollout"
  // instead of showing a hardcoded number.
  price: string | null;
  blurb: string;
  owned: boolean;
  // 'rollout' = not built yet (no SKU); 'purchasable' = real catalog SKU.
  state: 'purchasable' | 'rollout';
}) {
  const disabled = state === 'rollout';
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
          <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
            <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
            Owned
          </span>
        ) : disabled ? (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Coming with rollout
          </span>
        ) : (
          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            Add-on
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="font-mono text-xs text-ink/65">
          {disabled
            ? 'Pricing set at launch'
            : price ?? 'Price set in the Setnayan catalog'}
        </p>
      </div>
      <p className="text-sm text-ink/70">{blurb}</p>
      <div className="mt-auto">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink/45">
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Arrives with the streaming rollout
          </span>
        ) : owned ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
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
      className="sn-tile space-y-4 p-5 sm:p-6"
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
          You stream to <em>your</em> own YouTube — from your phone or from OBS on a
          laptop — and Setnayan embeds that live broadcast on your event page, dressed in
          your colors. Viewers watching on your Setnayan landing page and viewers watching
          on YouTube directly see the same broadcast served from YouTube&rsquo;s CDN.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <DeliveryFact
          label="End-to-end latency"
          value="~10 seconds"
          sub="YouTube&rsquo;s own ultra-low-latency live delivery — what your viewers see, give or take a few seconds"
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
          value="Coming with the rollout"
          sub="HDMI from the broadcaster device — arrives with the streaming control room"
        />
      </ul>

      <div className="rounded-lg border border-ink/10 bg-cream/60 p-4">
        <p className="sn-eye">
          YouTube watch URL
        </p>
        {watchUrlSaved ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-success-300/70 bg-success-50 px-2.5 py-1 text-xs font-medium text-success-800">
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
              <SubmitButton
                pendingLabel="Removing…"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
              >
                <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove link
              </SubmitButton>
            </form>
          </>
        ) : connected ? (
          <p className="mt-1 text-sm text-ink/60">
            Start your broadcast on YouTube — from the YouTube app or OBS — then paste its
            watch link below and it appears on your event page. Set the broadcast to
            ultra-low latency and switch off ads when you create it so loved ones watch
            uninterrupted.
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
            <SubmitButton
              pendingLabel="Saving…"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90"
            >
              <Radio aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save watch link
            </SubmitButton>
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
