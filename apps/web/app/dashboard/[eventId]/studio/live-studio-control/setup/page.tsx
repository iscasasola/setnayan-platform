import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  Smartphone,
  RefreshCw,
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
  Zap,
  Crown,
  Captions,
  QrCode,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderUrlQrSvg } from '@/lib/qr';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { panoodStreamingEnabled } from '@/lib/panood-camera-seats';
import {
  fetchChannelCameras,
  resolveChannelStatus,
  type ChannelCameraView,
} from '@/lib/live-studio-channel-cameras';
import { formatPhp } from '@/lib/orders';
import { eventSkuActive } from '@/lib/entitlements';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  LIVE_STUDIO_SKU,
  PROGRAM_CHANNEL_LABEL,
  FIRST_CAMERA_CHANNEL,
  FREE_CAMERA_NAME,
  UNLOCK_TO_BROADCAST_LABEL,
  buildChannelTiles,
  channelForZoneIndex,
  channelReadyCaption,
  formatChannel,
  liveStudioDetailPath,
  liveStudioControlLock,
  rehearseFreeNotice,
  showRehearsalUnlockNotice,
  type ChannelTile,
  type ControlZone,
} from '@/lib/live-studio-control';
import { MAX_ROAM_ZONES, canAddZone } from '@/lib/live-studio-roam-zones';
import {
  MONOGRAM_POSITIONS,
  QR_POSITIONS,
  POSITION_LABELS,
  LOWER_THIRD_TITLE_MAX,
  LOWER_THIRD_SUBTITLE_MAX,
  HIGHLIGHT_LABEL_MAX,
  canMarkHighlight,
  fetchHighlights,
  fetchOverlaySettings,
  formatHighlightOffset,
  overlayPositionClass,
  resolveOverlays,
  type ResolvedOverlays,
} from '@/lib/live-studio-overlays';
import { deriveMonogram } from '@/lib/monogram';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import {
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
} from '@/lib/panood-broadcast';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { SubmitButton } from '@/app/_components/submit-button';
import { CopyButton } from '@/app/_components/copy-button';
import { TransportRow } from './transport-row';
import { CameraFeedsProvider, ChannelVideo } from './_components/camera-feeds';
import {
  addRoamZone,
  deleteRoamZone,
  renameRoamZone,
  setFeaturedRoamZone,
  cutToMainStage,
  clearMainStage,
  createChannelJoinLink,
  reissueChannelJoinLink,
  saveControlWatchUrl,
  clearControlWatchUrl,
  setMonogramOverlay,
  setLowerThird,
  setEventQrOverlay,
  setGuestPick,
  markHighlight,
  deleteHighlight,
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
// ⭐ WAVE 3 — "REHEARSE FREE, PAY TO BROADCAST" (owner-locked 2026-07-25 · § 4d).
// This SUPERSEDES the Wave 1/2 gating the rest of this file was written under.
//
// A host WITHOUT LIVE_STUDIO opens a FULLY WORKING REHEARSAL ROOM: they add cameras,
// name them, tap-cut between them on CH 1, place the monogram and lower third, set
// guest-pick — all of it, unlimited, at their actual rehearsal, on their own phones.
// Nothing they do here is published, so no guest can watch, so there is nothing to
// gate. The paywall is PUBLICATION (lib/live-studio-publish.ts), enforced where the
// multi-channel manifest is written and again on every public read.
//
// WHAT THAT MEANS FOR THIS SCREEN — three deliberate reversals of Wave 1/2:
//   1. NO PADLOCKS OVER THE TILES. Every configured camera renders at FULL
//      brightness with its real state, for every host. Seeing the cameras actually
//      working IS the conversion mechanism; dimming them recreates the exact defect
//      Wave 3 fixes — asking ₱2,999 for an experience the couple never felt, for a
//      day that cannot be redone.
//   2. THE PAYWALL IS STATED AT THE GO-LIVE MOMENT — "Rehearse free · Unlock <price>
//      to broadcast all your cameras", right under the monitor where going live
//      happens, plus a contextual "Unlock to broadcast" chip on a 2nd+ camera the
//      moment the host puts it on Channel 1. Nudges, never blocks: the cut has
//      already succeeded by the time the chip appears.
//   3. COPY LOCK — "Unlock to BROADCAST", never "Unlock to use". They can use it.
//
// WAVE 2's ₱0 broadcast extras, with their Wave 3 gating:
//   • Ⓜ monogram bug (repositionable, default upper-right)  · free to PLACE, paid ON AIR
//   • ▬ lower third (the host's own two lines)              · free to WRITE, paid ON AIR
//   • ⬛ event QR ("scan to join")                           · FREE — owner-locked,
//        because a scan-to-join code pulls guests in and grows Setnayan
//   • ⚡ highlight moments (timestamps only, no video work)   · PAID (an offset into a
//        real broadcast is not a rehearsal artifact)
//   • guest-pick — free to set, inert until the unlock publishes >1 channel
//
// TWO RESOLUTIONS OF THE OVERLAYS, ON PURPOSE:
//   • `rehearsalOverlays` — resolved as-if-owned. What the host is PLACING, and what
//     the toggle chips read from. Dimming or hiding it would defeat the point.
//   • `airOverlays` — the entitlement-derived truth (resolveOverlays), used to STATE
//     what a broadcast actually carries right now. On the free tier that is the
//     permanent "POWERED BY SETNAYAN" bar and no monogram — derived, never stored, so
//     there is no setting a free host can flip and no request to replay.
//   • `monitorOverlays` — what the CH 1 monitor draws: the rehearsal, EXCEPT that the
//     lower-third slot falls back to what will actually air, so a free host who never
//     touched the bar is not shown a clean frame their broadcast won't match.
// All three come from the SAME function, so the views cannot drift.
//
// NO FAKE DOORS (§ 4b), still: Split/PiP are NOT rendered — they need a mixing
// point that does not exist (phase 2), and the prototype's P2 chips are design
// intent only. There is likewise no viewer counter and no on-air timer: no live
// viewer data exists yet, and a fabricated number is a fake door with a number on
// it. The event-QR toggle is also withheld for a slug-less event, which has no
// code to show.
//
// LIVE MONITOR HONESTY: there is no video pipeline on THIS route yet (YouTube
// orchestration is owner-gated), so the monitor shows the on-air channel's
// IDENTITY — name, channel number, tally — over the same "preview — live video
// arrives with the streaming rollout" placeholder the shipped panood control room
// uses. It never fakes a frame. The overlay layers drawn over it are therefore a
// PLACEMENT REHEARSAL (same corner map as the real surface), not a composite.
//
// WHERE THE OVERLAYS ACTUALLY REACH AIR: the settings resolved here are re-resolved
// server-side on /panood/program/[eventId] — the chrome-less pop-out the couple's
// encoder window-captures — and drawn as DOM layers there. That is a real
// compositing point (it is how the SETNAYAN paywall overlay already reaches air),
// costs ₱0, and needs no server mixer. It is the LEGACY control room's output
// surface; this controller has no video of its own to composite onto yet.
//
// The whole surface stays dark behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED.
// ═════════════════════════════════════════════════════════════════════════════

type ZoneRow = ControlZone & { status: string; camera_operator_id: number | null };

/**
 * A channel plus its Wave 4 camera facts — the shape the render needs.
 *
 * `resolvedStatus` is the HONEST status (stored transition + the heartbeat
 * staleness window), and it is what feeds `channelReadyCaption`. `qrSvg` is only
 * ever non-null for an UNCLAIMED seat: a claimed seat's QR is a live seat-hijack
 * credential with no reason to be on screen (the same rule the shipped
 * /studio/panood/cameras page applies).
 */
type ChannelRow = ZoneRow & {
  camera: ChannelCameraView | null;
  resolvedStatus: string;
  qrSvg: string | null;
};

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
    overlay_saved?: string;
    overlay_error?: string;
    guest_pick?: string;
    highlight?: string;
    highlight_error?: string;
    camera_link?: string;
    camera_error?: string;
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
    overlay_saved,
    overlay_error,
    guest_pick,
    highlight,
    highlight_error,
    camera_link,
    camera_error,
  } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug, monogram_text')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // ── WAVE 4 · HOST GATE, and it is now load-bearing.
  //
  // Until Wave 4 this page leaned entirely on RLS: it read only the host's own
  // zones, so a non-host simply saw nothing. Wave 4 reads camera SEAT rows through
  // the SERVICE-ROLE client — `panood_camera_operators` RLS is control-room-only
  // and does not cover a moderator, who is a legitimate host here — and those rows
  // carry `claim_qr_token`, a seat-hijack credential. So this check is the only
  // thing standing in front of that read, and it is the SAME predicate the server
  // actions use (isLiveStudioSetupHost) so the two cannot drift.
  if (!(await isLiveStudioSetupHost(eventId, user.id))) redirect(`/dashboard/${eventId}`);

  // ── Entitlement — WAVE 3: this governs BROADCASTING, not using. A free host is
  // not bounced and nothing is locked away; `owned` decides whether they may put
  // more than one camera (and the paid overlays) on air, and therefore whether the
  // unlock affordances render at all.
  const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  const sku = await formatV2Sku(LIVE_STUDIO_SKU).catch(() => null);
  const priceLabel = sku ? formatPhp(sku.price_php) : null;
  const lock = liveStudioControlLock(owned, priceLabel);
  const detailHref = liveStudioDetailPath(eventId);

  // ── Camera channels (control-plane; RLS scopes to the host's own event).
  const { data: zoneRows } = await supabase
    .from('live_studio_roam_zones')
    .select(
      'id, zone_index, label, venue_label, is_featured, is_main_stage, status, camera_operator_id',
    )
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  const zoneBase = (zoneRows ?? []) as ZoneRow[];

  // ── WAVE 4 · THE JOINED CAMERAS ───────────────────────────────────────────
  //
  // This is the read that did not exist. `camera_operator_id` had zero writers, so
  // there was no binding to read and every channel reported 'planned' forever —
  // Wave 3's "Waiting for a camera" was correct precisely because nothing could
  // ever change it. Now a channel carries a real seat, a real join QR, and a real
  // heartbeat.
  //
  // Service-role client, gated by the host check above — see its note.
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'www.setnayan.com'}`;
  const admin = createAdminClient();
  const cameras = await fetchChannelCameras(admin, eventId, zoneBase, appUrl).catch(
    () => new Map<number, ChannelCameraView>(),
  );

  const now = new Date();
  const zones: ChannelRow[] = await Promise.all(
    zoneBase.map(async (z) => {
      const camera = cameras.get(z.id) ?? null;
      // THE HONEST STATUS. Stored transition + the heartbeat window, so a channel
      // whose operator walked out reads "Camera dropped out" rather than holding a
      // green "Camera connected" nobody ever came back to clear.
      const resolvedStatus = resolveChannelStatus({
        status: z.status,
        lastSeenAt: camera?.lastSeenAt ?? null,
        bound: Boolean(camera),
        claimed: camera?.claimed ?? false,
        now,
      });
      return {
        ...z,
        camera,
        resolvedStatus,
        // `status` is overwritten with the RESOLVED value on purpose: every
        // downstream reader (buildChannelTiles → channelReadyCaption, the manage
        // list) then states the same truth, and none of them can accidentally read
        // the stale column instead.
        status: resolvedStatus,
        qrSvg: camera?.claimUrl ? await renderUrlQrSvg(camera.claimUrl, 132) : null,
      };
    }),
  );

  const atCap = !canAddZone(zones.length);
  const mainStageZone = zones.find((z) => z.is_main_stage) ?? null;
  // The slot the CH 1 monitor should render — the on-air channel's camera, if a
  // phone has joined it. Null means there is genuinely nothing to show, and the
  // honest placeholder stays.
  const programSlot = mainStageZone?.camera?.slot ?? null;
  // Real media only flows when the owner has flipped streaming on (the
  // couple's-unrepeatable-day gate). OFF → no peer connection, no picture, and the
  // placeholder says so rather than a black rectangle pretending to be a feed.
  const streamingOn = panoodStreamingEnabled();

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
  // zoneId → WebRTC slot, so a tile can subscribe to its own camera. Kept here
  // rather than threaded through `ChannelTile` so Wave 3's pure controller helpers
  // stay free of transport concepts.
  const slotByZoneId = new Map(zones.filter((z) => z.camera).map((z) => [z.id, z.camera!.slot]));

  // ── WAVE 2 · broadcast extras · WAVE 3 gating (owner-locked 2026-07-25 · §§ 4b/4d).
  //
  // TWO resolutions from the SAME function, so they cannot drift:
  //   • rehearsalOverlays (owned: true) — what the host is PLACING. Drawn on the CH 1
  //     monitor at full strength for every host, because placing them is free and a
  //     dimmed rehearsal is not a rehearsal.
  //   • airOverlays (owned: the real entitlement) — what a broadcast actually carries
  //     right now. Used to TELL the truth beside the rehearsal, and re-asked every
  //     render, so a monogram left enabled by a LAPSED unlock states "not on air".
  const overlaySettings = await fetchOverlaySettings(supabase, eventId);
  const monogramText =
    (event.monogram_text as string | null)?.trim() || deriveMonogram(event.display_name);
  const rehearsalOverlays = resolveOverlays({ owned: true, settings: overlaySettings, monogramText });
  const airOverlays = resolveOverlays({ owned, settings: overlaySettings, monogramText });

  // What the MONITOR draws. Rehearsal for the things the host is placing, but the
  // lower-third slot falls back to what will actually air — otherwise a free host
  // who never touched the bar would see a clean frame while their broadcast goes
  // out carrying "POWERED BY SETNAYAN". A preview may show them something better
  // than reality only where they explicitly asked for it; it must never show them
  // an empty space where reality has a bar.
  const monitorOverlays: ResolvedOverlays = {
    monogram: rehearsalOverlays.monogram,
    eventQr: rehearsalOverlays.eventQr,
    lowerThird: rehearsalOverlays.lowerThird ?? airOverlays.lowerThird,
  };
  const highlights = await fetchHighlights(supabase, eventId);
  const canMark = canMarkHighlight({ owned, isLive });

  // The go-live-moment paywall: only when there is genuinely something they cannot
  // broadcast (more than one camera configured, no unlock). Price from the catalog.
  const showUnlockNotice = showRehearsalUnlockNotice({ owned, configuredChannels: zones.length });

  // Guest-pick — the real switch (Wave 2). Guarded read: a pre-migration database
  // must not break the controller, and "unknown" defaults to ON (the owner default).
  let guestPickEnabled = true;
  try {
    const { data: gpRow, error: gpErr } = await supabase
      .from('events')
      .select('live_studio_guest_pick_enabled')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!gpErr) {
      guestPickEnabled =
        (gpRow as { live_studio_guest_pick_enabled?: unknown } | null)
          ?.live_studio_guest_pick_enabled !== false;
    }
  } catch {
    // pre-migration env — keep the default ON
  }

  // The (FREE) event-QR overlay's actual image. REUSES the already-shipped public
  // master-QR route — a real, scannable code encoding this event's canonical join
  // URL (owner-slug resolution and monogram centre included), so nothing about QR
  // rendering is re-implemented here.
  //
  // NO FAKE DOOR: a slug-less event has no code to show, so `qrSrc` is null and the
  // ⬛ toggle is not rendered at all — rather than offering a switch that would put
  // an empty box on the broadcast.
  const eventSlug = (event.slug as string | null) ?? null;
  const qrSrc = eventSlug ? `/api/website/qr/${encodeURIComponent(eventSlug)}` : null;

  // What Channel 1 is carrying, in the host's own words. Entitlement-independent:
  // a free host rehearsing a cut genuinely has that camera on Channel 1, and the
  // monitor has to say so.
  const programChannelCaption = mainStageZone
    ? formatChannel(channelForZoneIndex(mainStageZone.zone_index), mainStageZone.label)
    : zones.length === 0
      ? formatChannel(FIRST_CAMERA_CHANNEL, FREE_CAMERA_NAME)
      : null;
  const programCaption = mainStageZone
    ? mainStageZone.label
    : zones.length === 0
      ? isLive
        ? FREE_CAMERA_NAME
        : 'Go live below to start your stream'
      : 'Nothing on Channel 1 yet — tap a camera below';

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
      {overlay_saved ? <Banner tone="success" Icon={CheckCircle2}>Overlay updated.</Banner> : null}
      {overlay_error ? <Banner tone="error" Icon={AlertCircle}>Couldn’t save that overlay — please try again.</Banner> : null}
      {guest_pick === 'on' ? (
        <Banner tone="success" Icon={Users}>Guest-pick is on — guests can choose any camera channel.</Banner>
      ) : null}
      {guest_pick === 'off' ? (
        <Banner tone="muted" Icon={Users}>Guest-pick is off — everyone watches your cut.</Banner>
      ) : null}
      {highlight === 'marked' ? <Banner tone="success" Icon={Zap}>Moment saved.</Banner> : null}
      {highlight === 'removed' ? <Banner tone="muted" Icon={Trash2}>Moment removed.</Banner> : null}
      {highlight_error === 'offair' ? (
        <Banner tone="error" Icon={AlertCircle}>
          Moments are timestamps into a broadcast — go live first, then mark them.
        </Banner>
      ) : null}
      {highlight_error === 'save' ? <Banner tone="error" Icon={AlertCircle}>Couldn’t save that moment — please try again.</Banner> : null}
      {camera_link === 'ready' ? (
        <Banner tone="success" Icon={QrCode}>
          Join QR ready — show it to whoever is holding that phone.
        </Banner>
      ) : null}
      {camera_link === 'reissued' ? (
        <Banner tone="muted" Icon={RefreshCw}>
          New join QR made. The old link stopped working — that phone is disconnected.
        </Banner>
      ) : null}
      {camera_error === 'bind' ? (
        <Banner tone="error" Icon={AlertCircle}>Couldn’t make a join QR for that channel — please try again.</Banner>
      ) : null}
      {camera_error === 'reissue' ? (
        <Banner tone="error" Icon={AlertCircle}>Couldn’t make a new join QR — please try again.</Banner>
      ) : null}

      {/* ═══ THE SINGLE SCREEN ════════════════════════════════════════════════
          Phone: monitor → transport → channel grid, stacked.
          Desktop (lg+): monitor + transport LEFT, channel grid RIGHT — the same
          components, re-flowed (the prototype's Desktop toggle). */}
      {/* WAVE 4 · ONE shared WebRTC viewer for the whole operating screen. The
          transport is one-publisher-→-one-viewer per slot, so the CH 1 monitor and
          every tile must subscribe to the SAME connection — two viewers would
          fight and one of them would go black. See _components/camera-feeds.tsx. */}
      <CameraFeedsProvider eventId={eventId} streamingEnabled={streamingOn}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        {/* ── LEFT · CH 1 monitor + transport ──────────────────────────────── */}
        <div className="space-y-3">
          <section
            aria-label="Channel 1 — the controlled screen"
            className={`relative aspect-video w-full overflow-hidden rounded-2xl border-2 bg-ink/90 ${
              isLive ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-ink/15'
            }`}
          >
            {/* Honest placeholder — identity, never a faked frame.
                WAVE 4: it is now a FALLBACK rather than the only state. The live
                picture below covers it when a joined phone is genuinely
                delivering one; with no camera, no join, or streaming switched
                off, this is what stays — which is the truth in all three cases. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <Tv aria-hidden className="h-8 w-8 text-cream/55" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-cream">{programCaption}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/50">
                {streamingOn
                  ? programSlot
                    ? 'waiting for this camera’s picture'
                    : 'nothing joined on this channel yet'
                  : 'preview — live video arrives with the streaming rollout'}
              </p>
            </div>

            {/* ── WAVE 4 · THE REAL PICTURE. Renders only when a joined phone is
                actually publishing this channel (lib/panood-webrtc.ts, the same
                transport the legacy control room uses). Sits UNDER the overlay
                layers below so the monogram / lower third / QR composite over the
                video exactly as they do on the encode surface. */}
            <ChannelVideo slot={programSlot} />

            {/* CH 1 is the controlled screen — the fixed label from the design. */}
            <span className="absolute left-2.5 top-2.5 rounded-md bg-ink/60 px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-cream/85">
              {PROGRAM_CHANNEL_LABEL}
            </span>

            {/* Take Channel 1 off air — a real control (clearMainStage), free:
                a rehearsing host who cut a camera on must be able to cut it off. */}
            {mainStageZone ? (
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

            {/* ── WAVE 2 · overlay PLACEMENT PREVIEW ─────────────────────────
                Drawn with the SAME position map the capture surface uses
                (overlayPositionClass), so "top right" here is "top right" on air.
                This monitor has no video, so these sit over the placeholder — a
                placement rehearsal, labelled as one, never a claim that a frame
                is being composited right now.

                WAVE 3: this uses the REHEARSAL resolution, so a free host sees the
                monogram and bar they placed, at full strength, undimmed. What a
                free broadcast actually carries instead is stated in words directly
                below the overlay row — a preview that predicts is worth more than a
                blackout that punishes. */}
            <MonitorOverlays
              overlays={monitorOverlays}
              qrSrc={qrSrc}
              lowerThirdFallback={monogramText}
            />

            {/* Tally + the on-air channel's identity. Lifted clear of the bottom
                strip whenever a lower third owns it. */}
            <div
              className={`absolute left-2.5 flex flex-wrap items-center gap-1.5 ${
                monitorOverlays.lowerThird ? 'bottom-14' : 'bottom-2.5'
              }`}
            >
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

            {/* ⚡ HIGHLIGHT MOMENT — a real control, and only when it can do
                something real: paid AND on air (canMarkHighlight). One tap saves a
                timestamped row; no video is touched. */}
            {canMark ? (
              <form
                action={markHighlight}
                className={`absolute right-2.5 ${
                  monitorOverlays.lowerThird ? 'bottom-14' : 'bottom-2.5'
                }`}
              >
                <input type="hidden" name="event_id" value={eventId} />
                <SubmitButton
                  pendingLabel="…"
                  overlay={false}
                  title="Mark a highlight moment — saves the timestamp"
                  className="inline-flex items-center gap-1.5 rounded-full border border-cream/40 bg-ink/55 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:bg-ink/75"
                >
                  <Zap aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Moment
                </SubmitButton>
              </form>
            ) : null}
          </section>

          {/* ── TRANSPORT — go live / end + guest-pick ──────────────────────── */}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <TransportRow
              eventId={eventId}
              oauthReady={oauthReady}
              connected={!!youtubeGrant}
              isLive={isLive}
              connectHref="#connect"
            />

            {/* GUEST-PICK — a REAL switch (Wave 2), and free to SET (Wave 3 § 4d).
                The public page enforces it by omission (applyGuestPick) AFTER the
                publish gate has already reduced a free event to one channel, so a
                free host's setting is inert rather than blocked — one enforcement
                point instead of two that could disagree. */}
            <form action={setGuestPick}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="enabled" value={guestPickEnabled ? 'false' : 'true'} />
              <SubmitButton
                pendingLabel="Saving…"
                overlay={false}
                aria-pressed={guestPickEnabled}
                title={
                  guestPickEnabled
                    ? 'Guest-pick is ON — tap to make everyone watch your cut'
                    : 'Guest-pick is OFF — tap to let guests choose their view'
                }
                className="flex min-h-[52px] w-full items-center gap-2 rounded-xl border border-ink/10 bg-cream/70 px-3 py-2 text-left text-xs text-ink/75 transition-colors hover:border-terracotta/40"
              >
                <Users aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="leading-tight">
                  <span className="block font-semibold">Guest-pick</span>
                  <span className="block text-[11px]">
                    {guestPickEnabled ? 'Guests choose their view' : 'Everyone sees your cut'}
                  </span>
                </span>
                <span
                  className={`ml-1 shrink-0 rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] ${
                    guestPickEnabled ? 'bg-success-100 text-success-900' : 'bg-ink/10 text-ink/55'
                  }`}
                >
                  {guestPickEnabled ? 'On' : 'Off'}
                </span>
              </SubmitButton>
            </form>
          </div>

          {/* ── THE PAYWALL, AT THE GO-LIVE MOMENT (Wave 3 · § 4d) ────────────
              Not a padlock over the tiles — a sentence exactly where broadcasting
              happens, and only once the host has more than one camera to broadcast.
              Their single-camera stream above stays free and is not blocked. */}
          {showUnlockNotice ? (
            <Link
              href={detailHref}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-terracotta/40 bg-terracotta/[0.07] px-3.5 py-2.5 text-xs leading-snug text-ink/75 transition-colors hover:bg-terracotta/[0.12]"
            >
              <Radio aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{rehearseFreeNotice(priceLabel)}</span>
                Going live now broadcasts one camera — free, as always. Your{' '}
                {zones.length} channels stay here to rehearse with.
              </span>
              <span className="shrink-0 rounded-lg bg-mulberry px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-cream">
                {lock.unlockCtaLabel}
              </span>
            </Link>
          ) : null}

          {/* ── CH 1 · OVERLAY ROW (Wave 2 · Wave 3 gating) ─────────────────────
              The prototype's `.layouts` strip, minus every control that does not
              exist: NO Split/PiP chips (still phase 2 — they need a mixing point).
              Only Ⓜ / ▬ / ⬛ ship, because only those are real.

              WAVE 3: all three are REAL toggles for every host — placing them is
              rehearsal (§ 4d). The `on` state comes from the REHEARSAL resolution,
              so a free host's chip reads "on" because their overlay genuinely is
              placed. What reaches AIR is stated in the line underneath rather than
              implied by a disabled control. */}
          <div
            role="group"
            aria-label="Channel 1 overlays"
            className="flex items-center gap-1.5 overflow-x-auto px-1"
          >
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
              CH 1
            </span>

            <OverlayToggle
              action={setMonogramOverlay}
              eventId={eventId}
              on={Boolean(rehearsalOverlays.monogram)}
              label="Monogram"
              title={
                rehearsalOverlays.monogram
                  ? 'Monogram overlay is ON — tap to hide it'
                  : 'Place your monogram on Channel 1'
              }
              Icon={Crown}
            />
            <OverlayToggle
              action={setLowerThird}
              eventId={eventId}
              on={Boolean(rehearsalOverlays.lowerThird && !rehearsalOverlays.lowerThird.forced)}
              label="Lower third"
              title={
                rehearsalOverlays.lowerThird && !rehearsalOverlays.lowerThird.forced
                  ? 'Lower third is ON — tap to hide it'
                  : 'Place a news-style info bar on Channel 1'
              }
              Icon={Captions}
            />

            {/* FREE for every host — the one overlay that airs on the free tier too. */}
            {qrSrc ? (
              <OverlayToggle
                action={setEventQrOverlay}
                eventId={eventId}
                on={Boolean(rehearsalOverlays.eventQr)}
                label="Event QR"
                title={
                  rehearsalOverlays.eventQr
                    ? 'Event QR is ON — tap to hide it'
                    : 'Show your scan-to-join QR on the broadcast (free)'
                }
                Icon={QrCode}
                freeChip
              />
            ) : null}
          </div>

          {/* WHAT ACTUALLY GOES OUT (Wave 3). The monitor above is a placement
              rehearsal; this is the entitlement-derived truth beside it, so the
              preview is never mistaken for a promise. Only shown when the two
              differ — a paid host needs no disclaimer. */}
          {!owned ? (
            <p className="px-1 text-[11px] leading-snug text-ink/55">
              <span className="font-semibold text-ink/70">Rehearsal preview.</span> A free
              broadcast goes out carrying{' '}
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-terracotta">
                {airOverlays.lowerThird?.title}
              </span>{' '}
              — that bar is how people find Setnayan, and it can’t be switched off. Your own
              monogram and lower third go on air when you unlock Live Studio
              {qrSrc ? '. Your event QR is free either way' : ''}.
            </p>
          ) : null}
        </div>

        {/* ── RIGHT · camera-channel grid ──────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
            <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55">
              Camera channels · {zones.length} of {MAX_ROAM_ZONES}
            </h2>
            <span className="ml-auto text-[11px] text-ink/45">tap = put on Channel 1</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((tile) => (
              <ChannelTileCard
                key={tile.key}
                tile={tile}
                eventId={eventId}
                detailHref={detailHref}
                slot={tile.zoneId !== null ? slotByZoneId.get(tile.zoneId) ?? null : null}
              />
            ))}

            {/* Add a camera — FREE (Wave 3: rehearsal is unlimited), when there's
                room. Jumps to the real form below rather than opening a sub-page. */}
            {!atCap ? (
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

          {zones.length === 0 ? (
            <p className="px-1 text-[11px] leading-snug text-ink/50">
              No cameras yet. Add your first below — each one becomes its own channel you can put on
              Channel 1 with a tap. Setting them up and rehearsing with them is free.
            </p>
          ) : null}

          {atCap ? (
            <p className="px-1 text-[11px] text-ink/50">
              You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one below to add another.
            </p>
          ) : null}
        </div>
      </div>
      </CameraFeedsProvider>

      {/* ═══ UNLOCK BAR — the pitch, price from the catalog ════════════════════
          Wave 3 wording: what the ₱2,999 buys is BROADCASTING the cameras, because
          using them is already free. This is the sales surface, not a gate. */}
      {!lock.multiCamUnlocked ? (
        <Link
          href={detailHref}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-terracotta/40 bg-gradient-to-r from-terracotta/10 to-terracotta/[0.04] p-3.5 transition-colors hover:from-terracotta/15"
        >
          <span className="min-w-0 flex-1 text-xs leading-snug text-ink/65">
            <span className="block text-[12.5px] font-semibold text-ink">
              Rehearse free — unlock to broadcast all your cameras
              {priceLabel ? ` · ${priceLabel} · one event` : ' · one event'}
            </span>
            Set up every camera, name them and practise your cuts as often as you like. The unlock
            is what puts more than one of them on air for your guests — with guest-pick and your own
            monogram and lower third.
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
          camera. FREE for every host (Wave 3 · § 4d) — setting cameras up is
          rehearsal, and a rehearsal you can't set up is not one. */}
      <section id="add-camera" aria-labelledby="cameras-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="sn-eye">Cameras</p>
            <h2 id="cameras-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Video aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Manage your channels
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Every channel has its own join QR. Show it to whoever is holding that phone — they
              scan, tap once, and their camera becomes that channel. No app to install, no account
              to make. You name every channel; the name is what guests see. Only you (signed in
              here) run the controller.
            </p>
            {!lock.multiCamUnlocked ? (
              <p className="max-w-prose text-[12.5px] leading-snug text-ink/55">
                Add as many as you like and practise with them at your rehearsal — that costs
                nothing. Broadcasting more than one of them to your guests is what the unlock buys.
              </p>
            ) : null}
          </div>
        </div>

        {zones.length > 0 ? (
          <ul className="space-y-2">
            {zones.map((z) => (
              <li key={z.id} className="sn-row space-y-2 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                    {/* WAVE 4: the resolved, human answer — not the raw column. */}
                    <span
                      className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] ${
                        z.resolvedStatus === 'live' ? 'text-success-700' : 'text-ink/35'
                      }`}
                    >
                      {channelReadyCaption(z.resolvedStatus)}
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
                </div>

                {/* ═══ WAVE 4 · THE JOIN QR ═══════════════════════════════════
                    THE gap this whole wave exists to close. The grid above has
                    promised "scan QR · no login" since Wave 1 while nothing on
                    this page could produce a QR — `camera_operator_id` had no
                    writers, so no channel had a camera seat and no phone could
                    ever join one.

                    Three honest shapes, never a fourth:
                      • no seat yet  → one tap creates the join link
                      • seat open    → the real QR + the copyable link
                      • seat claimed → who has it, and how to take it back

                    FREE for every host (§ 4d): joining cameras and rehearsing
                    with them costs nothing. The unlock is about BROADCASTING more
                    than one of them, and that gate lives at publication
                    (lib/live-studio-publish.ts), not here. */}
                <ChannelJoinRow eventId={eventId} zone={z} />
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
      </section>

      {/* ═══ BROADCAST OVERLAYS — the detail behind the CH 1 icon row ══════════
          The row above is the operating loop (on/off in one tap, mid-show). The
          text and corner choices live down here, because typing is setup. */}
      <section aria-labelledby="overlays-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="sn-eye">Overlays</p>
          <h2 id="overlays-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Captions aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            What sits on the broadcast
          </h2>
          <p className="text-sm leading-relaxed text-ink/60">
            These are drawn on the picture your encoder captures — nothing is re-encoded on our
            side, so they cost nothing and add no delay.
          </p>
        </div>

        {/* ── Monogram — position. FREE to place (Wave 3); paid to put on air. */}
        <div className="space-y-2 border-t border-ink/10 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Crown aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Monogram — {rehearsalOverlays.monogram ? 'placed' : 'hidden'}
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">
              {monogramText}
            </span>
          </p>
          <p className="text-[11.5px] text-ink/55">
            Pick the corner it sits in. Upper right by default — where a broadcast bug usually
            lives.
          </p>
          <div className="flex flex-wrap gap-2">
            {MONOGRAM_POSITIONS.map((pos) => (
              <form key={pos} action={setMonogramOverlay}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="position" value={pos} />
                <SubmitButton
                  pendingLabel="…"
                  overlay={false}
                  aria-pressed={overlaySettings.monogramPosition === pos}
                  className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                    overlaySettings.monogramPosition === pos
                      ? 'border-terracotta bg-terracotta/10 text-ink'
                      : 'border-ink/15 text-ink/60 hover:border-terracotta/40'
                  }`}
                >
                  {POSITION_LABELS[pos]}
                </SubmitButton>
              </form>
            ))}
          </div>
          {!airOverlays.monogram && rehearsalOverlays.monogram ? (
            <p className="text-[11.5px] leading-snug text-ink/55">
              Placed and saved. It goes on air when you unlock Live Studio —{' '}
              <Link href={detailHref} className="font-medium text-terracotta hover:underline">
                {lock.unlockCtaLabel}
              </Link>
            </p>
          ) : null}
        </div>

        {/* ── Lower third — the host's own two lines. FREE to write (Wave 3); on the
            free tier the SETNAYAN bar is what actually airs, and that is stated
            rather than implied by a missing form. */}
        <div className="space-y-2 border-t border-ink/10 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Captions aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Lower third
          </p>
          <form action={setLowerThird} className="space-y-2">
            <input type="hidden" name="event_id" value={eventId} />
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink/45">
                Title line
              </span>
              <input
                name="title"
                defaultValue={overlaySettings.lowerThirdTitle ?? ''}
                maxLength={LOWER_THIRD_TITLE_MAX}
                placeholder="MARIA ✕ JOSEF"
                className="sn-input mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink/45">
                Second line
              </span>
              <input
                name="subtitle"
                defaultValue={overlaySettings.lowerThirdSubtitle ?? ''}
                maxLength={LOWER_THIRD_SUBTITLE_MAX}
                placeholder="Dinner is served — Grand Ballroom · 7:00 PM"
                className="sn-input mt-1 w-full"
              />
            </label>
            <SubmitButton
              pendingLabel="Saving…"
              className="rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
            >
              Save lower third
            </SubmitButton>
          </form>

          {/* FREE: the permanent Setnayan bar. Said plainly, with no switch — because
              there is no switch (it is derived from the entitlement, never stored),
              and pretending otherwise would be the dishonest version of this. */}
          {airOverlays.lowerThird?.forced ? (
            <div className="space-y-2 rounded-xl border border-ink/15 bg-ink/[0.03] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                On air right now
              </p>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-terracotta">
                {airOverlays.lowerThird.title}
              </p>
              <p className="text-[11.5px] text-ink/55">{airOverlays.lowerThird.subtitle}</p>
              <p className="text-[11.5px] leading-snug text-ink/60">
                Free streams carry this bar — it’s how people find Setnayan, and it can’t be
                switched off. Your own two lines above are saved and previewed on Channel 1;
                unlocking Live Studio is what puts them on air instead.
              </p>
              <Link
                href={detailHref}
                className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta/10 px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-terracotta-700 hover:bg-terracotta/20"
              >
                <Radio aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                {UNLOCK_TO_BROADCAST_LABEL}
              </Link>
            </div>
          ) : null}
        </div>

        {/* ── Event QR — FREE for every host (owner-locked). */}
        {qrSrc ? (
          <div className="space-y-2 border-t border-ink/10 pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <QrCode aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
              Event QR — {rehearsalOverlays.eventQr ? 'showing' : 'hidden'}
              <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-success-900">
                Free
              </span>
            </p>
            <p className="text-[11.5px] text-ink/55">
              Anyone watching can scan it to open your event page. Free on every plan.
            </p>
            <div className="flex flex-wrap gap-2">
              {QR_POSITIONS.map((pos) => (
                <form key={pos} action={setEventQrOverlay}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="position" value={pos} />
                  <SubmitButton
                    pendingLabel="…"
                    overlay={false}
                    aria-pressed={overlaySettings.eventQrPosition === pos}
                    className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                      overlaySettings.eventQrPosition === pos
                        ? 'border-terracotta bg-terracotta/10 text-ink'
                        : 'border-ink/15 text-ink/60 hover:border-terracotta/40'
                    }`}
                  >
                    {POSITION_LABELS[pos]}
                  </SubmitButton>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ═══ MOMENTS — the ⚡ list ══════════════════════════════════════════════ */}
      {lock.multiCamUnlocked ? (
        <section aria-labelledby="moments-heading" className="sn-tile space-y-3 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="sn-eye">Moments</p>
            <h2 id="moments-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Zap aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Highlight moments
            </h2>
            <p className="text-sm leading-relaxed text-ink/60">
              While you’re live, tap <strong>Moment</strong> on the monitor and we save the
              timestamp — nothing more. Afterwards this is your shortlist of what to cut, and the
              chapter marks for the replay.
            </p>
          </div>

          {highlights.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/20 px-3 py-3 text-[12.5px] text-ink/55">
              No moments yet.{' '}
              {isLive
                ? 'Tap Moment on the monitor when something happens.'
                : 'The button appears on the monitor once you’re on air.'}
            </p>
          ) : (
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
              {highlights.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="shrink-0 rounded-md bg-ink/[0.06] px-2 py-1 font-mono text-[11px] font-bold tabular-nums text-ink/70">
                    {formatHighlightOffset(h.offset_seconds)}
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <span className="block truncate font-medium text-ink/85">
                      {h.label ?? 'Moment'}
                    </span>
                    <span className="block truncate text-[11px] text-ink/50">
                      {h.channel && h.channel_label
                        ? formatChannel(h.channel, h.channel_label)
                        : 'Channel 1'}
                      {' · '}
                      {new Date(h.marked_at).toLocaleTimeString('en-PH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <form action={deleteHighlight} className="shrink-0">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="highlight_id" value={h.id} />
                    <SubmitButton
                      pendingLabel="…"
                      overlay={false}
                      title="Remove this moment"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-danger-50 hover:text-danger-700"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span className="sr-only">Remove moment</span>
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {/* Optional label for the NEXT tap — typed ahead, because nobody types
              mid-ceremony. Only offered when the button it feeds actually exists. */}
          {canMark ? (
            <form action={markHighlight} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="event_id" value={eventId} />
              <label className="min-w-[180px] flex-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink/45">
                  Name this moment (optional)
                </span>
                <input
                  name="label"
                  maxLength={HIGHLIGHT_LABEL_MAX}
                  placeholder="The kiss"
                  className="sn-input mt-1 w-full"
                />
              </label>
              <SubmitButton
                pendingLabel="Saving…"
                overlay={false}
                className="inline-flex items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
              >
                <Zap aria-hidden className="h-4 w-4" strokeWidth={2.25} />
                Mark it
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}

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
              Your own camera goes live free from your phone or OBS — one camera, always free.
              Rehearsing with every channel here is free too: hand out the join QRs, watch the
              cameras arrive on this screen, and practise your cuts as often as you like. When you
              unlock Live Studio, more than one of them can be on air at once and the picker on your
              event page lights up so guests can choose their view. That last step — pushing your
              cut out to YouTube — is being wired now, and we’ll email you the moment it’s ready.
              Nothing you set up here needs redoing.
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
 * The overlay layers drawn over the CH 1 monitor — the PLACEMENT PREVIEW.
 *
 * Uses `overlayPositionClass` (the same map the real capture surface uses) so the
 * corner a host picks here is the corner it lands in on air. This monitor has no
 * video, so this is a rehearsal of placement, not a claim that we are compositing a
 * frame right now — the placeholder underneath says so.
 */
function MonitorOverlays({
  overlays,
  qrSrc,
  lowerThirdFallback,
}: {
  overlays: ResolvedOverlays;
  qrSrc: string | null;
  /** Shown when a paid host enabled the bar but hasn't typed a title yet. */
  lowerThirdFallback: string;
}) {
  return (
    <>
      {overlays.monogram ? (
        <span
          className={`absolute ${overlayPositionClass(
            overlays.monogram.position,
          )} rounded-full border border-cream/35 bg-ink/40 px-3 py-1 font-serif text-[13px] italic text-cream backdrop-blur-sm`}
        >
          {overlays.monogram.text}
        </span>
      ) : null}

      {overlays.eventQr && qrSrc ? (
        <span
          className={`absolute ${overlayPositionClass(
            overlays.eventQr.position,
          )} flex flex-col items-center gap-0.5 rounded-lg bg-cream/95 p-1.5`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- served by an API
              route as a PNG; next/image adds an optimizer hop for no benefit here. */}
          <img src={qrSrc} alt="" width={44} height={44} className="h-11 w-11" />
          <span className="font-mono text-[6.5px] font-bold uppercase tracking-[0.08em] text-ink">
            Scan to join
          </span>
        </span>
      ) : null}

      {overlays.lowerThird ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-ink/90 via-ink/70 to-transparent px-3 pb-2.5 pt-6">
          <span aria-hidden className="h-7 w-[3px] shrink-0 rounded-sm bg-terracotta" />
          <span className="min-w-0">
            <span
              className={`block truncate font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] ${
                overlays.lowerThird.forced ? 'text-terracotta' : 'text-cream'
              }`}
            >
              {overlays.lowerThird.title || lowerThirdFallback}
            </span>
            {overlays.lowerThird.subtitle ? (
              <span className="block truncate text-[11px] text-cream/75">
                {overlays.lowerThird.subtitle}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  );
}

/**
 * ⭐ WAVE 4 — a channel's JOIN surface: the QR a phone scans to become this camera.
 *
 * ── HOW A PHONE ACTUALLY JOINS (all of it already shipped) ─────────────────
 * The QR encodes `/panood/cam/[token]` — the login-free, install-free claim page
 * that has existed since the Live Studio Cast controller. The operator opens it,
 * taps once, and `claimPanoodCamera` mints a native ANONYMOUS Supabase session and
 * binds the seat through the SECURITY DEFINER `panood_claim_camera()` RPC. No
 * account, no app, no Google. Wave 4 did not invent any of that; it bound the seat
 * to a Live Studio CHANNEL so the join finally lands somewhere.
 *
 * ── WHY THE TOKEN IS EVENT-SCOPED ──────────────────────────────────────────
 * `claim_qr_token` is UNIQUE and every seat row carries exactly one `event_id`, so
 * a token resolves to one seat on one event — there is no parameter through which
 * another event could be named, in the claim RPC or the heartbeat. And a channel
 * can only ever be bound to a seat on its OWN event: the composite FK
 * (camera_operator_id, event_id) makes a cross-event binding a database error, so
 * this row can never render another event's credential.
 *
 * ── WHY A CLAIMED SEAT SHOWS NO QR ─────────────────────────────────────────
 * A claimed seat's link is a live credential that would let a second phone try the
 * same camera; the shipped /studio/panood/cameras page applies the same rule, and
 * `fetchChannelCameras` enforces it upstream by not even building the URL. Taking
 * a camera back is an explicit, stated act (reissue), not a quiet re-scan.
 *
 * SERVER COMPONENT. The raw token never crosses to the client — only the finished
 * URL (for the copy control) and the rendered QR markup, exactly as the shipped
 * cameras page states in its own header.
 */
function ChannelJoinRow({ eventId, zone }: { eventId: string; zone: ChannelRow }) {
  const channel = channelForZoneIndex(zone.zone_index);
  const camera = zone.camera;

  // No seat yet — a channel made before Wave 4, or one whose bind-on-add didn't
  // land. One tap fixes it; nothing is broken in the meantime.
  if (!camera) {
    return (
      <form action={createChannelJoinLink} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="zone_id" value={zone.id} />
        <SubmitButton
          pendingLabel="Making the QR…"
          overlay={false}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink/70 transition-colors hover:border-terracotta/50 hover:text-terracotta"
        >
          <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Make the join QR
        </SubmitButton>
        <span className="text-[11px] text-ink/50">
          No phone can join CH {channel} until this exists.
        </span>
      </form>
    );
  }

  // Retired seat — its token is already dead to both RPCs. Say so and offer the
  // one thing that helps, rather than printing a QR that silently cannot work.
  if (camera.revoked) {
    return (
      <form action={reissueChannelJoinLink} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="zone_id" value={zone.id} />
        <SubmitButton
          pendingLabel="Making the QR…"
          overlay={false}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink/70 transition-colors hover:border-terracotta/50 hover:text-terracotta"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Make a new join QR
        </SubmitButton>
        <span className="text-[11px] text-ink/50">
          CH {channel}&rsquo;s old link was retired — nothing can join until you make a new one.
        </span>
      </form>
    );
  }

  // Claimed — a phone holds this camera. State it, and offer the way back.
  if (camera.claimed) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink/60">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-success-900">
          <Smartphone aria-hidden className="h-3 w-3" strokeWidth={2.25} />
          Phone joined
        </span>
        <span className="min-w-0 flex-1">
          A phone holds CH {channel}. Reissuing makes a new QR and disconnects
          them — the old link stops working immediately.
        </span>
        <form action={reissueChannelJoinLink}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="zone_id" value={zone.id} />
          <SubmitButton
            pendingLabel="…"
            overlay={false}
            title={`Disconnect the phone on CH ${channel} and make a new QR`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink/60 transition-colors hover:border-burgundy/40 hover:text-burgundy"
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            New QR
          </SubmitButton>
        </form>
      </div>
    );
  }

  // Open — show the code. Collapsed by default: a wedding has up to twelve of
  // these and a wall of QR blocks would bury the channel list they belong to.
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink/70 marker:content-[''] transition-colors hover:border-terracotta/50 hover:text-terracotta">
        <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Join QR for CH {channel}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-ink/10 bg-cream/60 p-3">
        {zone.qrSvg ? (
          <div
            aria-hidden
            className="w-28 shrink-0 rounded-lg bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: zone.qrSvg }}
          />
        ) : null}
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <p className="text-[11.5px] leading-snug text-ink/65">
            Hand this phone to whoever is shooting <strong>{zone.label}</strong>. They
            scan it, tap once, and their camera becomes CH {channel} — no app, no
            account, no sign-in.
          </p>
          {camera.claimUrl ? (
            <CopyButton value={camera.claimUrl} label="Copy the link" copiedLabel="Copied" />
          ) : null}
          <p className="text-[11px] text-ink/45">
            This code only works for this celebration and only for this channel.
          </p>
        </div>
      </div>
    </details>
  );
}

/**
 * One overlay on/off chip in the CH 1 row. A form, not a client toggle: the state
 * lives in the database, so the button posts the state it wants and re-renders from
 * what actually saved. `on` is the RESOLVED state (post-entitlement), never the raw
 * column, so a chip can never read "on" while nothing is drawn.
 */
function OverlayToggle({
  action,
  eventId,
  on,
  label,
  title,
  Icon,
  freeChip = false,
}: {
  action: (formData: FormData) => Promise<void>;
  eventId: string;
  on: boolean;
  label: string;
  title: string;
  Icon: typeof Crown;
  /** Mark the chip as free-tier-inclusive (the event QR). */
  freeChip?: boolean;
}) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
      <SubmitButton
        pendingLabel="…"
        overlay={false}
        aria-pressed={on}
        title={title}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
          on
            ? 'border-terracotta bg-terracotta/10 text-ink'
            : 'border-ink/15 text-ink/55 hover:border-terracotta/40 hover:text-ink'
        }`}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {label}
        {freeChip ? (
          <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] text-success-700">
            Free
          </span>
        ) : null}
      </SubmitButton>
    </form>
  );
}

/**
 * ONE camera-channel tile, two shapes, no third:
 *   • CUTTABLE (any configured channel, free or paid) — the whole tile is the cut
 *     control: one tap puts this channel on Channel 1. A ✎ disclosure sits beside it
 *     (a sibling, never nested in the tile button) for renaming in place.
 *   • STATUS (the host's own camera, or a channel already on CH 1) — nothing to cut
 *     to, so it is not a button.
 *
 * ⚠ WAVE 3 (owner "but they can still see it"): the third shape — a DIMMED tile with
 * a 🔒 "Unlock to use" badge covering it — is DELETED, and must not come back.
 * Seeing the cameras actually working IS the conversion mechanism; a blackout over
 * them recreates the exact defect Wave 3 exists to fix. The only thing an
 * un-entitled host sees extra is the contextual "Unlock to broadcast" chip, placed
 * clear of the tally so on-air red still reads instantly.
 */
function ChannelTileCard({
  tile,
  eventId,
  detailHref,
  slot,
}: {
  tile: ChannelTile;
  eventId: string;
  detailHref: string;
  /** WAVE 4: this channel's WebRTC slot, or null when no phone is bound to it. */
  slot: string | null;
}) {
  // Frame classes are shared by the control and the status shapes so a tile never
  // changes size when it goes on air — only its edge.
  const frame = `relative block aspect-video w-full overflow-hidden rounded-xl border-2 p-0 text-left transition-colors ${
    tile.tally
      ? 'border-danger-500 ring-2 ring-danger-500/30'
      : tile.onProgram
        ? 'border-terracotta'
        : 'border-ink/10 hover:border-terracotta/60'
  }`;

  // Every real channel can be renamed — including the one on air, whose name is
  // exactly what a host is most likely to want to fix mid-show.
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
            <TileSurface tile={tile} slot={slot} />
          </SubmitButton>
        </form>
      ) : (
        <div className={frame}>
          <TileSurface
            tile={tile}
            slot={slot}
            subtitle={tile.kind === 'free' ? 'Free · always on Channel 1' : undefined}
          />
        </div>
      )}

      {/* ── "UNLOCK TO BROADCAST" — the contextual nudge (Wave 3, owner-locked).
          Appears only once an un-entitled host has ENGAGED a 2nd+ camera (put it on
          Channel 1), so it lands at the moment they feel the value rather than
          sitting there from page load. It is a LABEL beside a cut that already
          succeeded — never a block.

          Placement is deliberate: bottom-RIGHT, above the name band, so it can
          never cover the top-left channel/tally chip. On-air red stays the one
          signal an operator can trust at a glance. */}
      {tile.nudgeUnlock ? (
        <Link
          href={detailHref}
          title={`${UNLOCK_TO_BROADCAST_LABEL} — CH ${tile.channel} is yours to rehearse with; broadcasting more than one camera is the unlock`}
          className="absolute bottom-7 right-1.5 z-20 inline-flex items-center gap-1 rounded-full bg-mulberry px-2 py-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.06em] text-cream shadow-sm transition-colors hover:bg-mulberry-600"
        >
          <Radio aria-hidden className="h-2.5 w-2.5" strokeWidth={2.5} />
          {UNLOCK_TO_BROADCAST_LABEL}
        </Link>
      ) : null}

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
 * app's cream/terracotta system).
 *
 * NO FRAME IS FAKED, AND NO TILE IS DIMMED (Wave 3). The `dim` prop that used to
 * grey out locked tiles is deleted on purpose; every host sees every channel at
 * full brightness.
 *
 * ⭐ WAVE 4 UPDATE. Wave 3's note here said "there is no thumbnail source yet —
 * nothing binds a joined phone to a ROAM channel". THAT IS NOW WIRED: a channel
 * carries a camera seat, a phone joins it by QR, and `ChannelVideo` renders the
 * REAL live picture over this surface when one is arriving. The rule the note was
 * protecting is unchanged and still absolute — nothing is fabricated. No stream
 * means no <video> element at all, so the icon plus the channel's honest state
 * (channelReadyCaption over the RESOLVED status, heartbeat window applied) is what
 * a host sees. A picture appears if and only if a camera is sending one.
 */
function TileSurface({
  tile,
  subtitle,
  slot,
}: {
  tile: ChannelTile;
  subtitle?: string;
  /** This channel's WebRTC slot, or null when no phone is bound. */
  slot?: string | null;
}) {
  // Second line: the host's venue grouping when they set one, and always the honest
  // answer to "is a camera actually on this channel yet?".
  const ready = tile.kind === 'zone' ? channelReadyCaption(tile.status) : null;
  const metaLine = subtitle ?? (tile.venue && ready ? `${tile.venue} · ${ready}` : (tile.venue ?? ready));

  return (
    <span className="absolute inset-0 block bg-ink/90">
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(255,255,255,0.10),transparent_65%)]"
      />
      <span className="absolute inset-0 grid place-items-center">
        <Video aria-hidden className="h-5 w-5 text-cream/30" strokeWidth={1.5} />
      </span>

      {/* WAVE 4 · the channel's live picture, when one genuinely exists. Renders
          nothing at all otherwise, so the honest state above stays visible. */}
      <ChannelVideo slot={slot ?? null} />

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

      {/* Host's own name + venue / real join state (the design's meta band). */}
      <span className="absolute inset-x-0 bottom-0 flex items-end gap-1.5 bg-gradient-to-t from-ink/90 to-transparent px-2 pb-1.5 pt-6">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold leading-tight text-cream">
            {tile.name}
          </span>
          {metaLine ? (
            <span className="block truncate text-[10px] leading-tight text-cream/60">
              {metaLine}
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
