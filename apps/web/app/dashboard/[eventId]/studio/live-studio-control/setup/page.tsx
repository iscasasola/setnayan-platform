import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ChevronLeft,
  Star,
  Trash2,
  Plus,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Lock,
  Radio,
  MonitorPlay,
  Scissors,
  PowerOff,
  Users,
  Tv,
  Video,
  ExternalLink,
  Unlink2,
  Server,
  KeyRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { eventSkuActive } from '@/lib/entitlements';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  LIVE_STUDIO_SKU,
  PROGRAM_CHANNEL_LABEL,
  FIRST_CAMERA_CHANNEL,
  buildChannelTiles,
  channelForZoneIndex,
  formatChannel,
  liveStudioDetailPath,
  liveStudioControlLock,
  type ChannelTile,
  type ControlZone,
} from '@/lib/live-studio-control';
import { MAX_ROAM_ZONES, canAddZone } from '@/lib/live-studio-roam-zones';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import {
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
} from '@/lib/panood-broadcast';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { SubmitButton } from '@/app/_components/submit-button';
import { CopyButton } from '@/app/_components/copy-button';
import { TransportRow } from './transport-row';
import {
  addRoamZone,
  deleteRoamZone,
  renameRoamZone,
  setFeaturedRoamZone,
  cutToMainStage,
  clearMainStage,
  saveControlWatchUrl,
  clearControlWatchUrl,
} from './actions';

export const metadata = { title: 'Live Studio controller · Setnayan' };

// ═════════════════════════════════════════════════════════════════════════════
// LIVE STUDIO CONTROLLER — the OWNER-APPROVED single-screen layout
// (Wave 1 · Live_Studio_Unified_Spec_2026-07-25 § 4b LAYOUT BUILD PLAN; design
// reference = the approved `live-studio-control.html` prototype.)
//
// ONE screen runs the whole broadcast — no sub-pages, no menus mid-show:
//
//   status row (event · off-air/on-air · free chip)
//     → CH 1 monitor          — the CONTROLLED SCREEN, tally-red when on air
//     → transport             — Go live / End broadcast + guest-pick state
//     → camera-channel grid   — CH 2+, host-named, one tap = put on Channel 1
//     → unlock bar (free)     — "Unlock · <catalog price>", in place
//   then a secondary SETUP region below (connect · manage cameras · encoder ·
//   watch link) — setup is not the operating loop, so it sits under the fold.
//
// CHANNEL VOCABULARY (owner-locked): Channel 1 is the CONTROLLED SCREEN — the
// program itself. Every camera is its own numbered channel wearing the HOST'S OWN
// name, and tapping one puts it on Channel 1. Internal names (is_main_stage,
// live_studio_roam_zones) are unchanged — only the words the host reads.
//
// TALLY DISCIPLINE: red means ON AIR and nothing else is red. A tile only goes red
// when it is on Channel 1 *and* the broadcast is actually live (lib/…-control.ts →
// ChannelTile.tally). A cut with no broadcast wears terracotta "On CH 1" instead —
// red on an off-air controller would be a lie about the one signal an operator has
// to be able to trust at a glance.
//
// FREE vs PAID, in place: a free host opens the SAME controller. They keep CH 1 +
// ONE usable camera channel (CH 2 = their own phone/encoder — the always-free
// single-camera livestream, and the free Go-live button) and see the rest of the
// grid locked with 🔒 "Unlock to use". No tile a free host sees renders a cut
// control (ChannelTile.cuttable is false for all of them) and the server actions
// keep their own ownership backstop (setup/actions.ts → requireLiveStudioOwned).
//
// NO FAKE DOORS (§ 4b): Wave 1 renders the monitor + cut + transport + grid +
// unlock and NOTHING else. Split/PiP, the Ⓜ monogram, lower-thirds, the event-QR
// overlay and the ⚡ highlight button are Wave 2 / P2 — the prototype shows them
// for design intent; the shipped controller must not tease controls that do not
// exist. Likewise there is no viewer counter and no on-air timer: no live viewer
// data exists yet, and a fabricated number is a fake door with a number on it.
//
// LIVE MONITOR HONESTY: there is no video pipeline on this route yet (YouTube
// orchestration is owner-gated), so the monitor shows the on-air channel's
// IDENTITY — name, channel number, tally — over the same "preview — live video
// arrives with the streaming rollout" placeholder the shipped panood control room
// uses. It never fakes a frame.
//
// The whole surface stays dark behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED.
// ═════════════════════════════════════════════════════════════════════════════

type ZoneRow = ControlZone & { status: string };

type YoutubeGrant = {
  grant_id: string;
  external_account_display: string | null;
} | null;

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    zone_added?: string;
    zone_deleted?: string;
    zone_renamed?: string;
    featured_set?: string;
    main_stage_cut?: string;
    main_stage_cleared?: string;
    zone_error?: string;
    watch_url_saved?: string;
    watch_url_error?: string;
  }>;
};

export default async function LiveStudioControlPage({ params, searchParams }: Props) {
  // Flag-dark: the whole surface is gated. notFound() (not redirect) so a direct hit
  // while the flag is off behaves as if the route doesn't exist.
  if (!liveStudioRoamEnabled()) notFound();

  const { eventId } = await params;
  const {
    zone_added,
    zone_deleted,
    zone_renamed,
    featured_set,
    main_stage_cut,
    main_stage_cleared,
    zone_error,
    watch_url_saved,
    watch_url_error,
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

  // ── Entitlement — the multi-camera LOCK. A free (un-owned) host is NOT bounced:
  // they open the SAME controller and use the free single-camera livestream, with
  // the multi-camera extras shown locked in place.
  const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  const sku = await formatV2Sku(LIVE_STUDIO_SKU).catch(() => null);
  const priceLabel = sku ? formatPhp(sku.price_php) : null;
  const lock = liveStudioControlLock(owned, priceLabel);
  const detailHref = liveStudioDetailPath(eventId);

  // ── Camera channels (control-plane; RLS scopes to the host's own event).
  const { data: zoneRows } = await supabase
    .from('live_studio_roam_zones')
    .select('id, zone_index, label, venue_label, is_featured, is_main_stage, status')
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  const zones = (zoneRows ?? []) as ZoneRow[];
  const atCap = !canAddZone(zones.length);
  const mainStageZone = zones.find((z) => z.is_main_stage) ?? null;

  // ── FREE single-camera livestream state (reuses the live panood reads verbatim).
  const oauthReady = (await getYoutubeOAuthConfig()).ready;

  const { data: grantRaw } = await supabase
    .from('oauth_grants')
    .select('grant_id, external_account_display')
    .eq('event_id', eventId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .maybeSingle();
  const youtubeGrant = (grantRaw ?? null) as YoutubeGrant;

  let youtubeWatchUrl: string | null = null;
  try {
    const { data: watchRow, error: watchErr } = await supabase
      .from('events')
      .select('panood_watch_url')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!watchErr && watchRow?.panood_watch_url) {
      youtubeWatchUrl = watchRow.panood_watch_url as string;
    }
  } catch {
    // pre-migration env — keep null
  }

  let activeBroadcast: Awaited<ReturnType<typeof getActivePanoodBroadcast>> = null;
  let activeStreamKey: string | null = null;
  try {
    activeBroadcast = await getActivePanoodBroadcast(eventId);
    if (activeBroadcast) activeStreamKey = await getActivePanoodStreamKey(eventId);
  } catch {
    // pre-migration env — no active broadcast
  }

  // The one fact the tally depends on: is the broadcast actually up?
  const isLive = Boolean(activeBroadcast);
  const tiles = buildChannelTiles({ zones, multiCamUnlocked: lock.multiCamUnlocked, isLive });

  // What Channel 1 is carrying, in the host's own words.
  const programChannelCaption = owned
    ? mainStageZone
      ? formatChannel(channelForZoneIndex(mainStageZone.zone_index), mainStageZone.label)
      : null
    : formatChannel(FIRST_CAMERA_CHANNEL, 'Your camera');
  const programCaption = owned
    ? mainStageZone
      ? mainStageZone.label
      : 'Nothing on Channel 1 yet — tap a camera below'
    : isLive
      ? 'Your camera'
      : 'Go live below to start your stream';

  return (
    <section className="space-y-4">
      {/* The single screen replaces the page masthead with the status row below —
          the event name lives there, useful during a show. Screen-reader title only. */}
      <h1 className="sr-only">Live Studio controller</h1>

      {/* ═══ STATUS ROW ═══════════════════════════════════════════════════════
          Everything a header used to spend ~150px saying, in one 44px row that is
          also useful mid-show. Mirrors the shipped panood control-room strip. */}
      <div className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-ink/10 bg-ink/[0.03] px-2">
        <Link
          href={detailHref}
          aria-label="Back to Live Studio"
          title="Back to Live Studio"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/55 hover:bg-ink/5 hover:text-ink"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>

        <span className="min-w-0 truncate text-xs font-medium text-ink/70">
          {event.display_name ?? 'Your celebration'}
        </span>

        {!owned ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta">
            Free
          </span>
        ) : null}

        <span
          className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
            isLive ? 'bg-danger-600 text-cream' : 'bg-ink/10 text-ink/60'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${isLive ? 'animate-pulse bg-cream' : 'bg-ink/40'}`}
          />
          {isLive ? 'On air' : 'Off air'}
        </span>
      </div>

      {/* status banners */}
      {zone_added ? <Banner tone="success" Icon={CheckCircle2}>Camera channel added.</Banner> : null}
      {zone_renamed ? <Banner tone="success" Icon={Pencil}>Channel renamed.</Banner> : null}
      {zone_deleted ? <Banner tone="muted" Icon={Trash2}>Camera channel removed.</Banner> : null}
      {featured_set ? <Banner tone="success" Icon={Star}>Default channel updated.</Banner> : null}
      {main_stage_cut ? <Banner tone="success" Icon={Scissors}>Now on Channel 1.</Banner> : null}
      {main_stage_cleared ? <Banner tone="muted" Icon={PowerOff}>Channel 1 cleared.</Banner> : null}
      {watch_url_saved ? <Banner tone="success" Icon={CheckCircle2}>Watch link saved — guests see “Watch Live”.</Banner> : null}
      {watch_url_error ? <Banner tone="error" Icon={AlertCircle}>That doesn’t look like a YouTube link — paste the watch or share URL.</Banner> : null}
      {zone_error === 'label' ? <Banner tone="error" Icon={AlertCircle}>Give the channel a name first.</Banner> : null}
      {zone_error === 'cap' ? (
        <Banner tone="error" Icon={AlertCircle}>You’ve reached the limit of {MAX_ROAM_ZONES} cameras for one event.</Banner>
      ) : null}
      {zone_error === 'save' ? <Banner tone="error" Icon={AlertCircle}>Couldn’t save that channel — please try again.</Banner> : null}

      {/* ═══ THE SINGLE SCREEN ════════════════════════════════════════════════
          Phone: monitor → transport → channel grid, stacked.
          Desktop (lg+): monitor + transport LEFT, channel grid RIGHT — the same
          components, re-flowed (the prototype's Desktop toggle). */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        {/* ── LEFT · CH 1 monitor + transport ──────────────────────────────── */}
        <div className="space-y-3">
          <section
            aria-label="Channel 1 — the controlled screen"
            className={`relative aspect-video w-full overflow-hidden rounded-2xl border-2 bg-ink/90 ${
              isLive ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-ink/15'
            }`}
          >
            {/* Honest placeholder — identity, never a faked frame. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <Tv aria-hidden className="h-8 w-8 text-cream/55" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-cream">{programCaption}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/50">
                preview — live video arrives with the streaming rollout
              </p>
            </div>

            {/* CH 1 is the controlled screen — the fixed label from the design. */}
            <span className="absolute left-2.5 top-2.5 rounded-md bg-ink/60 px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-cream/85">
              {PROGRAM_CHANNEL_LABEL}
            </span>

            {/* Take Channel 1 off air — a real control (clearMainStage), paid-only
                because only a paid host can have cut anything onto it. */}
            {owned && mainStageZone ? (
              <form action={clearMainStage} className="absolute right-2 top-2">
                <input type="hidden" name="event_id" value={eventId} />
                <SubmitButton
                  pendingLabel="…"
                  overlay={false}
                  title="Clear Channel 1 — nothing on air"
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink/55 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-cream/90 transition-colors hover:bg-ink/75"
                >
                  <PowerOff aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                  Clear
                </SubmitButton>
              </form>
            ) : null}

            {/* Tally + the on-air channel's identity. */}
            <div className="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
              {isLive ? (
                <span className="rounded-md bg-danger-600 px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-cream">
                  On air
                </span>
              ) : null}
              {programChannelCaption ? (
                <span className="rounded-md bg-ink/60 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-cream">
                  {programChannelCaption}
                </span>
              ) : null}
            </div>
          </section>

          {/* ── TRANSPORT — go live / end + guest-pick state ────────────────── */}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <TransportRow
              eventId={eventId}
              oauthReady={oauthReady}
              connected={!!youtubeGrant}
              isLive={isLive}
              connectHref="#connect"
            />

            {/* GUEST-PICK — rendered as STATE, not as a switch. Guests can pick
                their own view whenever a paid host has channels live; there is no
                persisted off-switch yet, so a toggle here would be a control that
                silently does nothing (the § 4b no-fake-door rule). It flips to a
                real switch in the wave that persists it. */}
            <div
              className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                lock.multiCamUnlocked
                  ? 'border-ink/10 bg-cream/70 text-ink/75'
                  : 'border-ink/10 bg-ink/[0.03] text-ink/45'
              }`}
            >
              <Users aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="leading-tight">
                <span className="block font-semibold">Guest-pick</span>
                <span className="block text-[11px]">
                  {lock.multiCamUnlocked ? 'Guests choose their view' : 'Everyone sees Channel 1'}
                </span>
              </span>
              {lock.multiCamUnlocked ? (
                <span className="ml-1 shrink-0 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-success-900">
                  On
                </span>
              ) : (
                <Link
                  href={detailHref}
                  className="ml-1 shrink-0 rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-terracotta-700 hover:bg-terracotta/20"
                >
                  <Lock aria-hidden className="mr-1 inline h-2.5 w-2.5" strokeWidth={2.5} />
                  Locked
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT · camera-channel grid ──────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
            <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55">
              Camera channels · {owned ? zones.length : 1} of {MAX_ROAM_ZONES}
            </h2>
            <span className="ml-auto text-[11px] text-ink/45">
              {lock.multiCamUnlocked ? 'tap = put on Channel 1' : 'one camera is free'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile) => (
              <ChannelTileCard
                key={tile.key}
                tile={tile}
                eventId={eventId}
                detailHref={detailHref}
              />
            ))}

            {/* Add a camera — paid, and only when there's room. Jumps to the real
                form below rather than opening a sub-page. */}
            {lock.multiCamUnlocked && !atCap ? (
              <a
                href="#add-camera"
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/20 text-center text-[11.5px] font-semibold text-ink/55 transition-colors hover:border-terracotta/50 hover:text-terracotta"
              >
                <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
                Add camera
                <span className="text-[10px] font-normal text-ink/40">scan QR · no login</span>
              </a>
            ) : null}
          </div>

          {lock.multiCamUnlocked && zones.length === 0 ? (
            <p className="px-1 text-[11px] leading-snug text-ink/50">
              No cameras yet. Add your first below — each one becomes its own channel you can put on
              Channel 1 with a tap.
            </p>
          ) : null}

          {lock.multiCamUnlocked && atCap ? (
            <p className="px-1 text-[11px] text-ink/50">
              You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one below to add another.
            </p>
          ) : null}
        </div>
      </div>

      {/* ═══ UNLOCK BAR — free only, in place, price from the catalog ══════════ */}
      {!lock.multiCamUnlocked ? (
        <Link
          href={detailHref}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-terracotta/40 bg-gradient-to-r from-terracotta/10 to-terracotta/[0.04] p-3.5 transition-colors hover:from-terracotta/15"
        >
          <span className="min-w-0 flex-1 text-xs leading-snug text-ink/65">
            <span className="block text-[12.5px] font-semibold text-ink">
              Unlock multi-cam{priceLabel ? ` — ${priceLabel} · one event` : ' · one event'}
            </span>
            Every camera becomes its own channel: put any of them on Channel 1 with a tap, and let
            guests pick their own view.
          </span>
          <span className="shrink-0 rounded-lg bg-mulberry px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-cream">
            {lock.unlockCtaLabel}
          </span>
        </Link>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECONDARY · SETUP — under the operating loop, on the same screen.
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* Connect YouTube (the free single-cam prerequisite). */}
      <section id="connect" aria-labelledby="connect-heading" className="sn-tile space-y-3 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="sn-eye">Connect</p>
          <h2 id="connect-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Tv aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Your YouTube channel
          </h2>
        </div>
        {!oauthReady ? (
          <p className="inline-flex items-start gap-2 rounded-lg border border-ink/15 bg-ink/5 px-3 py-2.5 text-sm text-ink/60">
            <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            Coming soon — Setnayan’s YouTube app review is still with Google. We’ll email you the
            moment the Connect button lights up.
          </p>
        ) : youtubeGrant ? (
          <p className="inline-flex items-center gap-2 rounded-lg border border-success-200/80 bg-success-50/60 px-3 py-2.5 text-sm text-ink">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" strokeWidth={2} />
            Connected{youtubeGrant.external_account_display ? ` — ${youtubeGrant.external_account_display}` : ''}. Your broadcast goes live on this channel.
          </p>
        ) : (
          <Link
            href={`/api/oauth/youtube/start?event_id=${eventId}`}
            className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
          >
            <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Connect YouTube
          </Link>
        )}
      </section>

      {/* Encoder details — only while a broadcast is up. The transport above owns
          going live and ending; this is just where the stream goes. The key stays
          masked (copy it straight into OBS — no reason to put a secret on screen). */}
      {activeBroadcast ? (
        <section aria-labelledby="encoder-heading" className="sn-tile space-y-3 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="sn-eye">Encoder</p>
            <h2 id="encoder-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Server aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Where to send your video
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Point OBS (or any RTMP encoder) at the server + key below and press “Start
              Streaming” — or open the YouTube app and go live to the same broadcast. Setnayan
              never touches your video.
            </p>
          </div>

          <div className="sn-row space-y-1 p-3">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              <Server aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              RTMP server
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="break-all font-mono text-sm text-ink/85">
                {activeBroadcast.ingestion_url}
              </code>
              <CopyButton value={activeBroadcast.ingestion_url} label="Copy" copiedLabel="Copied" />
            </div>
          </div>

          <div className="sn-row space-y-1 p-3">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              <KeyRound aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Stream key · keep this secret
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="break-all font-mono text-sm text-ink/85">
                {activeStreamKey
                  ? `${'•'.repeat(Math.max(0, activeStreamKey.length - 4))}${activeStreamKey.slice(-4)}`
                  : '— unavailable —'}
              </code>
              {activeStreamKey ? (
                <CopyButton value={activeStreamKey} label="Copy" copiedLabel="Copied" />
              ) : null}
            </div>
            <p className="text-[11px] text-ink/50">
              Treat it like a password — anyone with it can stream to your broadcast.
            </p>
          </div>

          <div className="sn-row space-y-1 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Watch URL
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${activeBroadcast.broadcast_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 break-all font-mono text-sm text-terracotta hover:underline"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {`https://www.youtube.com/watch?v=${activeBroadcast.broadcast_id}`}
            </a>
          </div>
        </section>
      ) : null}

      {/* Manage camera channels — add a channel + per-channel default / remove.
          The grid above is the operating control (tap = put on Channel 1); the
          housekeeping lives here so a mis-tap during a ceremony can't delete a
          camera. LOCKED for a free host. */}
      <section id="add-camera" aria-labelledby="cameras-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="sn-eye">Cameras</p>
            <h2 id="cameras-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Video aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Manage your channels
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Each camera is a phone your paparazzi join by scanning the event QR — no install, no
              account. You name every channel; the name is what guests see. Only you (signed in
              here) run the controller.
            </p>
          </div>
          {!lock.multiCamUnlocked ? <UnlockChip href={detailHref} label={lock.unlockCtaLabel} /> : null}
        </div>

        {!lock.multiCamUnlocked ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/45">
            <Lock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Extra camera channels are part of Live Studio. Your own camera stays free.
            <Link href={detailHref} className="font-medium text-terracotta hover:underline">
              {lock.unlockCtaLabel}
            </Link>
          </p>
        ) : (
          <>
            {zones.length > 0 ? (
              <ul className="space-y-2">
                {zones.map((z) => (
                  <li
                    key={z.id}
                    className="sn-row flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="font-mono text-[11px] font-bold text-ink/45">
                        CH {channelForZoneIndex(z.zone_index)}
                      </span>
                      <span className="truncate font-medium text-ink">{z.label}</span>
                      {z.venue_label ? (
                        <span className="truncate text-xs text-ink/45">{z.venue_label}</span>
                      ) : null}
                      {z.is_featured ? (
                        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-terracotta">
                          <Star aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                          Default
                        </span>
                      ) : null}
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/35">
                        {z.status}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!z.is_featured ? (
                        <form action={setFeaturedRoamZone}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="zone_id" value={z.id} />
                          <SubmitButton
                            pendingLabel="…"
                            title="Make this the default channel"
                            className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-[11px] font-medium text-ink/60 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                          >
                            <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span className="sr-only">Make default</span>
                          </SubmitButton>
                        </form>
                      ) : null}
                      <form action={deleteRoamZone}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="zone_id" value={z.id} />
                        <SubmitButton
                          pendingLabel="…"
                          title="Remove this channel"
                          className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2 py-1 text-ink/50 transition-colors hover:border-burgundy/40 hover:text-burgundy"
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span className="sr-only">Remove channel</span>
                        </SubmitButton>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {atCap ? (
              <p className="rounded-lg border border-ink/15 bg-ink/5 p-4 text-sm text-ink/60">
                You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one to add another.
              </p>
            ) : (
              <form action={addRoamZone} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="event_id" value={eventId} />
                <label className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Channel name</span>
                  <input
                    type="text"
                    name="label"
                    required
                    maxLength={60}
                    placeholder="Main Stage, Garden Aisle, Photo Booth…"
                    className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                    Venue <span className="text-ink/40">(optional)</span>
                  </span>
                  <input
                    type="text"
                    name="venue_label"
                    maxLength={60}
                    placeholder="Church, Grand Ballroom…"
                    className="min-h-[44px] w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink/75 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="is_featured"
                    className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                  />
                  Make this the default channel guests open on
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton
                    pendingLabel="Adding…"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
                  >
                    <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Add channel
                  </SubmitButton>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {/* Watch link — free single-cam delivery (reuses the panood watch-url actions). */}
      <section aria-labelledby="watch-heading" className="sn-tile space-y-3 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="sn-eye">Watch link</p>
          <h2 id="watch-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            How guests watch
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            Start your broadcast on YouTube, then paste the watch link — your event page shows a
            “Watch Live” player during the celebration.
          </p>
        </div>
        {youtubeWatchUrl ? (
          <div className="space-y-2">
            <p className="font-mono text-sm text-ink/85">{youtubeWatchUrl}</p>
            <form action={clearControlWatchUrl}>
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                pendingLabel="Removing…"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
              >
                <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove link
              </SubmitButton>
            </form>
          </div>
        ) : (
          <form action={saveControlWatchUrl} className="flex flex-col gap-2 sm:flex-row">
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
        )}
      </section>

      {/* Going live note (owner-OAuth gated). */}
      <section aria-labelledby="golive-note-heading" className="sn-tile space-y-3 p-5 sm:p-6">
        <h2 id="golive-note-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Radio aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          On the day
        </h2>
        <div className="sn-row p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/55">
              {oauthReady ? <Clock3 className="h-4 w-4" strokeWidth={1.75} /> : <Lock className="h-4 w-4" strokeWidth={1.75} />}
            </span>
            <p className="max-w-prose text-xs text-ink/60">
              Your own camera goes live free from your phone or OBS. When you unlock Live Studio,
              each added camera becomes its own channel you can put on Channel 1 with a tap, and the
              picker on your event page lights up so guests can choose their view. That multi-camera
              streaming step is being wired now — we’ll email you the moment it’s ready. Nothing
              here needs redoing.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Camera-channel tile — the one gesture of the whole controller.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Three shapes, one look:
 *   • CUTTABLE (paid zone) — the whole tile is the cut control: one tap puts this
 *     channel on Channel 1. A ✎ disclosure sits beside it (a sibling, never nested
 *     in the tile button) for renaming in place.
 *   • FREE (CH 2 on the free tier) — the host's own camera. A status tile, not a
 *     control: it is already what Channel 1 carries, there is nothing to cut to.
 *   • LOCKED — a Link to the buy surface. Deliberately NOT a form: a free host's
 *     UI contains no cut control at all, so there is nothing to replay. (The
 *     server action's requireLiveStudioOwned is still the hard backstop.)
 */
function ChannelTileCard({
  tile,
  eventId,
  detailHref,
}: {
  tile: ChannelTile;
  eventId: string;
  detailHref: string;
}) {
  if (tile.locked) {
    return (
      <Link
        href={detailHref}
        aria-label={`CH ${tile.channel} — ${tile.name} — locked, unlock Live Studio to use`}
        className="relative block aspect-video overflow-hidden rounded-xl border-2 border-dashed border-ink/20 bg-ink/70 transition-colors hover:border-terracotta/50"
      >
        <TileSurface tile={tile} dim />
        <span className="absolute inset-0 grid place-items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-cream">
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2.5} />
            Unlock to use
          </span>
        </span>
      </Link>
    );
  }

  // Frame classes are shared by the control and the status shapes so a tile never
  // changes size when it goes on air — only its edge.
  const frame = `relative block aspect-video w-full overflow-hidden rounded-xl border-2 p-0 text-left transition-colors ${
    tile.tally
      ? 'border-danger-500 ring-2 ring-danger-500/30'
      : tile.onProgram
        ? 'border-terracotta'
        : 'border-ink/10 hover:border-terracotta/60'
  }`;

  // Every real (paid) channel can be renamed — including the one on air, whose
  // name is exactly what a host is most likely to want to fix mid-show.
  const showRename = tile.cuttable && tile.zoneId !== null;

  return (
    <div className="relative">
      {/* A channel ALREADY on Channel 1 is a status tile, not a control — there is
          nothing to cut to (the monitor's "Clear" takes it off air). Same for the
          free tier's own camera. Rendering either as a *disabled* button would dim
          the one tile whose tally has to stay legible. */}
      {tile.cuttable && !tile.onProgram ? (
        <form action={cutToMainStage}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="zone_id" value={String(tile.zoneId)} />
          <SubmitButton
            pendingLabel=""
            overlay={false}
            title={`Put CH ${tile.channel} — ${tile.name} — on Channel 1`}
            className={frame}
          >
            <TileSurface tile={tile} />
          </SubmitButton>
        </form>
      ) : (
        <div className={frame}>
          <TileSurface
            tile={tile}
            subtitle={tile.kind === 'free' ? 'Free · always on Channel 1' : undefined}
          />
        </div>
      )}

      {/* ✎ rename in place — a SIBLING of the tile button (nesting buttons is
          invalid HTML and would swallow the cut). Pure <details>, no client JS.
          The container spans the tile so the panel can be tile-width — anchoring a
          fixed-width popover to the pencil pushed it off-screen on a 320px phone —
          and it is pointer-events-none so its invisible strip can't eat taps meant
          for the cut. */}
      {showRename ? (
      <details className="pointer-events-none absolute inset-x-1.5 top-1.5 z-20 text-right">
        <summary
          title={`Rename CH ${tile.channel}`}
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink/55 text-cream/90 marker:content-[''] hover:bg-ink/75"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="sr-only">Rename CH {tile.channel}</span>
        </summary>
        <form
          action={renameRoamZone}
          className="pointer-events-auto absolute inset-x-0 top-full z-30 mt-1 space-y-1.5 rounded-lg border border-ink/15 bg-cream p-2 text-left shadow-lg"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="zone_id" value={String(tile.zoneId)} />
          <input
            type="text"
            name="label"
            required
            maxLength={60}
            defaultValue={tile.name}
            aria-label={`Name for CH ${tile.channel}`}
            className="min-h-[36px] w-full rounded-md border border-ink/15 bg-white px-2 text-xs text-ink focus:border-terracotta focus:outline-none"
          />
          <input
            type="text"
            name="venue_label"
            maxLength={60}
            defaultValue={tile.venue ?? ''}
            placeholder="Venue (optional)"
            aria-label={`Venue for CH ${tile.channel}`}
            className="min-h-[36px] w-full rounded-md border border-ink/15 bg-white px-2 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          />
          <SubmitButton
            pendingLabel="Saving…"
            overlay={false}
            className="inline-flex min-h-[36px] w-full items-center justify-center rounded-md bg-mulberry px-3 text-xs font-semibold text-cream hover:bg-mulberry-600"
          >
            Save name
          </SubmitButton>
        </form>
      </details>
      ) : null}
    </div>
  );
}

/**
 * The tile's dark video surface + its overlays. Camera tiles are video surfaces,
 * so they wear the broadcast dark deliberately (the rest of the page stays on the
 * app's cream/terracotta system). No frame is faked — the placeholder is an icon.
 */
function TileSurface({
  tile,
  dim = false,
  subtitle,
}: {
  tile: ChannelTile;
  dim?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={`absolute inset-0 block bg-ink/90 ${dim ? 'opacity-70' : ''}`}>
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(255,255,255,0.10),transparent_65%)]"
      />
      <span className="absolute inset-0 grid place-items-center">
        <Video aria-hidden className="h-5 w-5 text-cream/30" strokeWidth={1.5} />
      </span>

      {/* Channel chip. Red ONLY when this channel is genuinely on air. */}
      <span
        className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${
          tile.tally
            ? 'bg-danger-600 text-cream'
            : tile.onProgram
              ? 'bg-terracotta text-cream'
              : 'bg-ink/60 text-cream/85'
        }`}
      >
        {tile.tally
          ? `CH ${tile.channel} · On air`
          : tile.onProgram
            ? `CH ${tile.channel} · On CH 1`
            : `CH ${tile.channel}`}
      </span>

      {/* Host's own name + venue, over the gradient (the design's meta band). */}
      <span className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 bg-gradient-to-t from-ink/90 to-transparent px-2 pb-1.5 pt-6">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold leading-tight text-cream">
            {tile.name}
          </span>
          {(subtitle ?? tile.venue) ? (
            <span className="block truncate text-[10px] leading-tight text-cream/60">
              {subtitle ?? tile.venue}
            </span>
          ) : null}
        </span>
        {tile.featured ? (
          <Star aria-hidden className="h-3.5 w-3.5 shrink-0 text-terracotta-300" strokeWidth={2.25} />
        ) : null}
      </span>
    </span>
  );
}

/** Small inline "Unlock · ₱X" pill that routes to the Live Studio buy. */
function UnlockChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1 text-xs font-semibold text-terracotta-700 transition-colors hover:bg-terracotta/20"
    >
      <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </Link>
  );
}

function Banner({
  tone,
  Icon,
  children,
}: {
  tone: 'success' | 'muted' | 'error';
  Icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'border-success-300/70 bg-success-50 text-success-900'
      : tone === 'error'
        ? 'border-danger-300/70 bg-danger-50 text-danger-900'
        : 'border-ink/15 bg-cream text-ink/75';
  return (
    <p role="status" className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${cls}`}>
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      {children}
    </p>
  );
}
