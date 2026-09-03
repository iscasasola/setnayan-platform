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
  Printer,
  SlidersHorizontal,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchReadinessFacts } from '@/lib/live-studio-readiness-server';
import { poolRouteToAir } from '@/lib/live-studio-readiness';
import { renderUrlQrSvg } from '@/lib/qr';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import {
  panoodStreamingEnabled,
  panoodCameraAnonEnabled,
  cameraJoinCaption,
} from '@/lib/panood-camera-seats';
import {
  fetchChannelCameras,
  resolveChannelStatus,
  type ChannelCameraView,
} from '@/lib/live-studio-channel-cameras';
import { printableCardCount } from '@/lib/live-studio-camera-cards';
import { formatPhp } from '@/lib/orders';
import { resolveBroadcastWindow } from '@/lib/live-studio-window-server';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { turnConfigured } from '@/lib/turn';
import {
  liveStudioPoolOnly,
  poolOnlyConnectNotice,
} from '@/lib/live-studio-pool-only';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchEventRecordings } from '@/lib/live-studio-recordings';
import {
  LIVE_STUDIO_SKU,
  LIVE_STUDIO_HOSTED_CHANNEL_SKU,
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
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import {
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
} from '@/lib/panood-broadcast';
import { resolveLiveAir, shouldOfferManualAir } from '@/lib/live-studio-manual-air';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { decideProgramAir, type ProgramChannel } from '@/lib/live-studio-publish';
import { BroadcastWindowStrip } from './_components/broadcast-window-strip';
import { ChannelFreshness } from './_components/channel-freshness';
import { SubmitButton } from '@/app/_components/submit-button';
import { CopyButton } from '@/app/_components/copy-button';
import { FacebookDualStreamCard } from '@/app/_components/facebook-dual-stream-card';
import { LiveStudioRecordingsCard } from '@/app/_components/live-studio-recordings-card';
import { readEventWatchUrls } from '@/lib/watch-live-links';
import { TransportRow } from './transport-row';
import { CameraFeedsProvider, ChannelVideo } from './_components/camera-feeds';
import { ProgramBridgeHost } from './_components/program-bridge';
import { SetupSheet } from './_components/setup-sheet';
import { ViewportLock } from './_components/viewport-lock';
import { ToastLayer } from './_components/toast-layer';
import { IngestHealthStrip } from './_components/ingest-health-strip';
import { filmFromRow, type EventFilmRow } from '@/lib/event-films';
import {
  addRoamZone,
  deleteRoamZone,
  renameRoamZone,
  setFeaturedRoamZone,
  cutToMainStage,
  clearMainStage,
  createChannelJoinLink,
  reissueChannelJoinLink,
  addEventFilm,
  removeEventFilm,
  saveControlWatchUrl,
  clearControlWatchUrl,
  saveControlFacebookUrl,
  clearControlFacebookUrl,
  setControlManualAir,
  clearControlManualAir,
  setMonogramOverlay,
  setLowerThird,
  setEventQrOverlay,
  setGuestPick,
  markHighlight,
  deleteHighlight,
} from './actions';

export const metadata = { title: 'Live Studio controller' };

// ═════════════════════════════════════════════════════════════════════════════
// LIVE STUDIO CONTROLLER — the OWNER-APPROVED single-screen layout
// (Wave 1 · Live_Studio_Unified_Spec_2026-07-25 § 4b LAYOUT BUILD PLAN; design
// reference = the approved `live-studio-control.html` prototype.)
//
// ONE screen runs the whole broadcast — no sub-pages, no menus mid-show:
//
//   status row (exit · event · off-air/on-air · free chip)   ── fixed
//     → CH 1 monitor          — the CONTROLLED SCREEN, tally-red when on air
//     → transport             — Go live / End broadcast + guest-pick state
//     → broadcast-window strip — the day / 12-hour archive warnings (Wave 7)
//     → CH 1 icon row         — overlays + the door to Setup
//     → camera-channel grid   — CH 2+, host-named, one tap = put on Channel 1
//     → unlock bar (free)     — "Unlock · <catalog price>", pinned to the foot
//
// ═════════════════════════════════════════════════════════════════════════════
// ⭐ WAVE 8 — CHROME-LESS, SCROLL-FREE, FULL-VIEWPORT (owner-locked 2026-07-25 ·
// § 4g: "we will achieve the exact look on our design prototype. scroll free
// controller. nothing under and above it.")
//
// Three structural changes, and the reason for each:
//
//   1. THE ROUTE LEFT /dashboard. It is now `/panood/control/[eventId]`. An App
//      Router page cannot opt out of an ancestor layout, and
//      `dashboard/[eventId]/layout.tsx` IS the masthead + bottom nav + nav FAB +
//      section sub-nav. Covering them from inside is a documented dead end —
//      `/panood/program/[eventId]` records that its own `fixed inset-0` attempt
//      rendered nothing, because the shell's `<main>` carries a
//      `view-transition-name` and therefore becomes the containing block for
//      fixed descendants. So this follows the SAME escape that pop-out already
//      uses: a top-level route inheriting only the root layout. The old URL
//      redirects here. Authorization is unchanged and still stricter than the
//      layout's — `isLiveStudioSetupHost`, the same predicate the actions use.
//
//   2. THE PAGE NEVER SCROLLS. The shell is `fixed inset-0` at `100dvh` (NOT
//      `100vh`: mobile browser chrome resizes the viewport mid-session and `vh`
//      clips the transport row exactly when the operator reaches for Go live)
//      with safe-area padding on all four sides. Every child is `shrink-0`; the
//      camera-channel grid is the ONE internal scroller. Two bounded exceptions,
//      both documented at their site: the window-warning strip (capped, and null
//      in normal operation) and the Setup sheet (an overlay, not the page).
//
//   3. SETUP MOVED INTO A SHEET. Connect · encoder · manage channels + join QRs ·
//      overlay text and corners · moments · watch link were ~700px stacked under
//      the loop, which is what made the page scroll. None of it is deleted or
//      re-gated — it is the same markup, handed to <SetupSheet>, reachable from
//      the Setup chip and from the existing `#connect` / `#add-camera` anchors.
// ═════════════════════════════════════════════════════════════════════════════
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
//      Wave 3 fixes — asking ₱3,000 for an experience the couple never felt, for a
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
    film_saved?: string;
    film_error?: string;
    facebook_url_saved?: string;
    facebook_url_error?: string;
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
    film_saved,
    film_error,
    facebook_url_saved,
    facebook_url_error,
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

  // RLS is the gate, so `{ data: null, error: null }` is the designed 404 —
  // "not your event". A REJECTED query also lands on null, and answering that
  // with the same 404 tells a host mid-event that their own control room does
  // not exist. The two are distinguishable; they are now distinguished.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(`event_id, slug, event_date, ${HERO_MONOGRAM_COLUMNS}`)
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) {
    console.error('[panood/control] event read refused', eventError);
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">We couldn&rsquo;t open the control room</h1>
        <p className="mt-3 text-sm text-ink/70">
          Something went wrong reading your event — this is <strong>not</strong> a sign it
          was deleted or that you have lost access. If you are already on air, you are
          still on air. Reload in a moment.
        </p>
      </main>
    );
  }
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

  // ── Price + links. The ENTITLEMENT itself is resolved further down, once the
  // active broadcast is known — WAVE 7 makes it depend on whether a broadcast is on
  // air (the never-interrupt rule), so it cannot be answered this early.
  const sku = await formatV2Sku(LIVE_STUDIO_SKU).catch(() => null);
  const priceLabel = sku ? formatPhp(sku.price_php) : null;
  const detailHref = liveStudioDetailPath(eventId);

  // ⭐ Does this event own the OPTIONAL hosted-channel add-on (owner ruling
  // 2026-09-02)? Decides which pool-only connect notice renders in the "Connect"
  // section below — NOT multicam entitlement, which stays keyed on LIVE_STUDIO_SKU
  // alone (resolved further down via `entitled`/`lock`). See the SKU's own
  // docblock in lib/live-studio-control.ts.
  const ownsHostedChannel = await eventSkuActive(supabase, eventId, LIVE_STUDIO_HOSTED_CHANNEL_SKU);

  // ── Camera channels (control-plane; RLS scopes to the host's own event).
  // Refused, the operator sees NO camera zones — identical to an event that has
  // none set up, on the screen they use to run a live broadcast.
  const { data: zoneRows, error: zoneError } = await supabase
    .from('live_studio_roam_zones')
    .select(
      'id, zone_index, label, venue_label, is_featured, is_main_stage, status, camera_operator_id',
    )
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  if (zoneError) console.error('[panood/control] zone read refused', zoneError);
  const zonesUnreadable = Boolean(zoneError) || zoneRows === null;
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

  // ⭐ THE RECORDING HANDOFF (09_Panood § 6) on the surface that SURVIVES the flag
  // flip. The legacy /studio/panood/setup page carries the same card; which one a
  // couple uses depends on a flag they cannot see, so a recording present on only
  // one of them is a recording they lose at the flip. Same rule, same reason as
  // FACEBOOK_REPLAY_WARNING rendering on both couple-facing setup surfaces.
  //
  // Reuses the `admin` client above (both source tables carry stream keys and are
  // RLS-policy-less; this page is already behind isLiveStudioSetupHost). Fail-soft:
  // returns [] on a pre-migration DB and never throws, and the card renders nothing
  // for an event that has not finished a broadcast.
  const recordings = await fetchEventRecordings(admin, eventId).catch(() => []);

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
  // How many channels have a join code you could actually hand to somebody. This is
  // the SAME function the print sheet builds itself from, so the doorway below can
  // never promise cards the sheet would not print.
  const printableCards = printableCardCount(
    zones.map((z) => ({
      zoneId: z.id,
      zoneIndex: z.zone_index,
      label: z.label,
      venueLabel: z.venue_label,
      claimUrl: z.camera?.claimUrl ?? null,
      hasSeat: Boolean(z.camera),
      claimed: z.camera?.claimed ?? false,
      revoked: z.camera?.revoked ?? false,
    })),
  );
  const mainStageZone = zones.find((z) => z.is_main_stage) ?? null;
  // The slot the CH 1 monitor should render — the on-air channel's camera, if a
  // phone has joined it. Null means there is genuinely nothing to show, and the
  // honest placeholder stays.
  const programSlot = mainStageZone?.camera?.slot ?? null;
  // Real media only flows when the owner has flipped streaming on (the
  // couple's-unrepeatable-day gate). OFF → no peer connection, no picture, and the
  // placeholder says so rather than a black rectangle pretending to be a feed.
  const streamingOn = panoodStreamingEnabled();

  // The Add-camera tile's caption must not promise a login-free join when the
  // flag is off — /panood/cam/[token] shows a sign-in wall in that case.
  const addCameraCaption = cameraJoinCaption(panoodCameraAnonEnabled());

  // Read once, server-side: the two CLOUDFLARE_TURN_* vars are server-only secrets
  // and must never reach the client — only this boolean does.
  const relayConfigured = turnConfigured();

  // ── FREE single-camera livestream state (reuses the live panood reads verbatim).
  const oauthReady = (await getYoutubeOAuthConfig()).ready;

  // Refused, this reads as "YouTube not connected" — so an operator whose
  // channel IS connected is invited to reconnect it mid-event.
  const { data: grantRaw, error: grantError } = await supabase
    .from('oauth_grants')
    .select('grant_id, external_account_display')
    .eq('event_id', eventId)
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .maybeSingle();
  if (grantError) console.error('[panood/control] youtube grant read refused', grantError);
  const youtubeGrant = (grantRaw ?? null) as YoutubeGrant;

  // ⭐ A ROUTE TO AIR IS NOT ONLY A BYO GRANT. The read above asks `oauth_grants`,
  // which is the COUPLE'S OWN channel and nothing else — but `goLivePanood` has
  // preferred a SETNAYAN POOL channel since Wave 9. Gating the button on the BYO
  // table alone told every pool-served host to "Connect your YouTube channel
  // first", the one instruction Wave 9 exists to abolish, while a healthy Setnayan
  // channel sat available and the hidden button would have worked.
  // See lib/live-studio-readiness.ts → poolRouteToAir for the measurement.
  // Fail-honest: a refused read leaves this false, so the by-hand switch is offered
  // rather than a one-tap button nobody can prove will work.
  // No flag guard here on purpose: this page already `notFound()`s above when
  // liveStudioRoamEnabled() is false, so a second check would be dead code.
  let pooledRoute = false;
  try {
    pooledRoute = poolRouteToAir(await fetchReadinessFacts(admin, eventId));
  } catch (e) {
    console.error('[panood/control] pool readiness read refused', e);
  }
  const hasRouteToAir = !!youtubeGrant || pooledRoute;

  // 🎞 The films the couple has attached — free, host-gated, and the thing the ₱2,500
  // description already promises ("unlimited video-link uploads"). Fail-soft: a refused
  // or pre-migration read yields [] and the section shows its empty state, never an
  // error over a control room.
  //
  // ⚠ Each row is converted ON ITS OWN and keeps its own id. `filmsFromRows` DROPS rows
  // it cannot validate, so mapping ids back by index would silently attach the wrong id
  // to the wrong film the moment one row is bad — and the id is what Remove deletes.
  type ControlFilm = NonNullable<ReturnType<typeof filmFromRow>> & { id: number };
  let films: ControlFilm[] = [];
  try {
    const { data: filmRows } = await supabase
      .from('event_films')
      .select('id, provider, video_id, video_hash, label')
      .eq('event_id', eventId)
      .order('sort_key', { ascending: true })
      .order('id', { ascending: true });
    films = ((filmRows ?? []) as Array<EventFilmRow & { id: number }>)
      .map((row) => {
        const film = filmFromRow(row);
        return film ? { ...film, id: row.id } : null;
      })
      .filter((f): f is ControlFilm => f !== null);
  } catch {
    films = [];
  }

  let youtubeWatchUrl: string | null = null;
  // DUAL-STREAM (2026-07-26): the couple's simultaneous Facebook Live link.
  let facebookWatchUrl: string | null = null;
  try {
    // readEventWatchUrls falls back to a YouTube-only select on 42703, so adding
    // the Facebook column can never take the live YouTube field off this screen
    // in an environment where migration 20271006100000 has not landed yet.
    const urls = await readEventWatchUrls(supabase, eventId);
    youtubeWatchUrl = urls.youtubeWatchUrl;
    facebookWatchUrl = urls.facebookWatchUrl;
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

  // ── BY-HAND ON AIR ────────────────────────────────────────────────────────
  //
  // The host who starts their own stream and pastes the watch link leaves no
  // panood_broadcasts row, so the tally below used to read them as off air — no red
  // light, and no ⚡ Moment button, which they PAID for. This is their trace.
  //
  // ⚠ ADMIN CLIENT, and it is not a shortcut. `events.panood_manual_on_air_at`
  // deliberately carries no column grant (migration 20271137667349), so naming it in
  // the host-session select above would get that ENTIRE query rejected — the whole
  // event read returns null, `notFound()` fires, and the controller 404s for
  // everyone. Rejected, not thrown; the only symptom would be an absence. Its own
  // read, fail-soft, so a pre-migration environment reads "off air" rather than
  // crashing — the same posture as the broadcast read above.
  let manualOnAirAt: string | null = null;
  {
    // Fail-soft is deliberate here and is KEPT (a pre-migration environment must
    // read "off air" rather than crash the control room). But the swallow was
    // total: refused, the room reads OFF AIR while the broadcast may be live.
    // The trade stands; the reason now reaches the logs.
    const { data, error: onAirError } = await admin
      .from('events')
      .select('panood_manual_on_air_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (onAirError) console.error('[panood/control] manual on-air read refused', onAirError);
    manualOnAirAt = (data as { panood_manual_on_air_at?: string | null } | null)
      ?.panood_manual_on_air_at ?? null;
  }

  // The one fact the tally depends on: is this event actually on air — by EITHER
  // route? `isLive` and the start instant come out of one resolver together, because
  // handing the window `isLive` without a start is what it reads as "protected".
  const liveAir = resolveLiveAir({
    hasActiveBroadcast: Boolean(activeBroadcast),
    broadcastStartedAt:
      activeBroadcast?.went_live_at ?? activeBroadcast?.scheduled_start_at ?? null,
    manualOnAirAt,
  });
  const isLive = liveAir.isLive;
  // Is the by-hand switch on right now, and should it be on screen at all? Both
  // answers come from the shared module so this page and the transport button cannot
  // disagree about whether one-tap go-live is available.
  const manualOnAir = liveAir.source === 'manual';
  // Offered unless a REAL broadcast is running. Deliberately NOT gated on "is a
  // channel connected": a host connects, presses Go live, YouTube refuses — and
  // gating on the connection would take away the fallback at exactly that moment.
  const offerManualAir = shouldOfferManualAir({
    broadcastLive: liveAir.source === 'broadcast',
  });
  // When the CURRENT run started. No longer bounds a never-interrupt rule (LS6
  // retired the clock that rule protected against) — kept because the 12-hour
  // YouTube archive-cap warning (BroadcastWindowStrip, below) is still per-stream
  // and still needs it.
  const broadcastStartedAt = liveAir.startedAt;

  // ── ⭐ THE BROADCAST UNLOCK ───────────────────────────────────────────────────
  // (LS6 · owner-ruled 2026-09-02 · lib/live-studio-window.ts)
  //
  // ₱2,500 buys MULTI-CAM broadcasting for the event, once, forever — unlimited
  // streams, no clock, never expiring. This is the SAME resolver
  // `canPublishMultiCam` delegates to, so the controller, the program pop-out, the
  // manifest mirror and the public page cannot disagree about whether this host
  // may put more than one camera on air.
  //
  // ⚠ ADMIN CLIENT, and this is a correctness fix, not a shortcut. `orders` RLS is
  // purchaser-scoped (orders_owner_read: user_id = auth.uid()), so a coordinator
  // running the controller for a couple who paid would read "not owned" under
  // their own session — silently downgraded to one camera, mid-wedding.
  // Membership was verified above by isLiveStudioSetupHost, which is the
  // authorization boundary; the same posture the Wave 5 program pop-out already
  // documents for the identical read.
  const broadcastWindow = await resolveBroadcastWindow(admin, eventId);

  // `owned`/`entitled` used to differ (a lapsed event-day was entitled but not
  // currently owned; LS6 retired that gap). They are the SAME boolean now — kept
  // as two names because `owned` feeds the program-output gate below and
  // `entitled` feeds only the WORDS (`liveStudioControlLock`'s "Unlock · price" vs
  // "Open controller" copy), and a future change to one must not silently change
  // the other's meaning.
  const owned = broadcastWindow.multiCam;
  const entitled = broadcastWindow.reason !== 'not-owned';
  const lock = liveStudioControlLock(entitled, priceLabel);

  const tiles = buildChannelTiles({ zones, multiCamUnlocked: lock.multiCamUnlocked, isLive });

  // ── ⭐ WAVE 5 · THE PATH TO AIR, and its paywall ──────────────────────────
  //
  // Until now a cut here reached the host's monitor and stopped. The surface an
  // encoder can actually capture is `/panood/program/[eventId]`, which reads frames
  // from its opener's bridge — and only the LEGACY control room installed one.
  // `ProgramBridgeHost` below installs it from here, so Channel 1 finally has an
  // output window.
  //
  // That output is also a PUBLICATION PATH WE DO NOT OWN (the host's own OBS → the
  // host's own YouTube), so it carries its own gate: an un-entitled event's program
  // frame carries ONE camera, pinned to the host's ★ default and INDEPENDENT of their
  // cut. Rehearsal is untouched — the monitor above still follows every cut, for
  // every host, at full strength (§ 4d). Decided server-side here and independently
  // re-decided server-side on the pop-out; see lib/live-studio-publish.ts.
  const programChannels: ProgramChannel[] = zones.map((z) => ({
    slot: z.camera?.slot ?? null,
    featured: z.is_featured,
    mainStage: z.is_main_stage,
    status: z.status,
  }));
  const air = decideProgramAir({ owned, channels: programChannels });
  // The host's own name for what is actually going out — used only in the pop-out's
  // no-signal state, so it must never claim a camera that isn't the one being sent.
  const airZone = air.airSlot ? zones.find((z) => z.camera?.slot === air.airSlot) ?? null : null;
  const airLabel = airZone
    ? formatChannel(channelForZoneIndex(airZone.zone_index), airZone.label)
    : 'Nothing on Channel 1 yet';
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
  // L11: the couple's real mark, same precedence the public hero resolves
  // (uploaded ?? custom) — the bug drew derived initials even when this existed.
  const monogramMarkSvg = resolveEventMonogramSvg(event);
  const rehearsalOverlays = resolveOverlays({
    owned: true,
    settings: overlaySettings,
    monogramText,
    monogramMarkSvg,
  });
  const airOverlays = resolveOverlays({ owned, settings: overlaySettings, monogramText, monogramMarkSvg });

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
  // WAVE 7: `entitled`, not `owned`. A moment is a timestamp into a broadcast, not
  // multi-cam broadcasting — a couple who bought Live Studio can mark moments on any
  // stream they run, including one after their event-day lapsed. Deliberately kept in
  // step with the server action (requireLiveStudioOwned), which the window also does
  // not gate: blocking a paying couple from tidying their own moment list after the
  // wedding would be petty, and a UI stricter than its own POST handler is a bug.
  const canMark = canMarkHighlight({ owned: entitled, isLive });

  // The go-live-moment paywall: only when there is genuinely something they cannot
  // broadcast (more than one camera configured, no unlock). Price from the catalog.
  // WAVE 7: `entitled` — a host mid-lapse is not sold the SKU again; the window strip
  // tells them their day ended and offers another one.
  const showUnlockNotice = showRehearsalUnlockNotice({
    owned: entitled,
    configuredChannels: zones.length,
  });

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
    /* ═══════════════════════════════════════════════════════════════════════════
       ⭐ WAVE 8 · THE FIXED, SCROLL-FREE SHELL
       (owner-locked 2026-07-25 · § 4g: "scroll free controller. nothing under and
       above it.")

       `fixed inset-0` + `100dvh` + `overflow-hidden`. Three deliberate choices:

         • FIXED, not just tall — a fixed root has no flow height, so no global
           sibling the root layout mounts (cookie banner, pilot/demo banner) can
           push the document past the viewport and hand the operator a scrollbar.
           It resolves against the viewport here because this route escaped the
           dashboard shell: the `.sn-vt-page` view-transition containment that
           broke the old in-tree `fixed inset-0` attempt is not in this tree.
         • 100dvh, NEVER 100vh — mobile browser chrome resizes the viewport mid
           session. With `vh` the transport row is clipped exactly when the
           operator reaches for Go live, which is the one moment that cannot be
           retried. `dvh` tracks the live viewport.
         • SAFE-AREA INSETS on all four sides — the tally chip and the Go live
           button must never sit under a notch or a home indicator. Written as
           padding on the shell rather than on each child so there is one place
           the physical screen is accounted for. Zero-valued on desktop, so this
           costs nothing there.

       Inside, EVERY child is `shrink-0` except the camera-channel grid, which is
       `flex-1 min-h-0 overflow-y-auto` — the one and only internal scroller. */
    <div
      className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-cream"
      style={{
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Belt-and-braces: html/body overflow hidden while this surface is mounted,
          restored on unmount. See _components/viewport-lock.tsx. */}
      <ViewportLock />

      {/* The single screen replaces the page masthead with the status row below —
          the event name lives there, useful during a show. Screen-reader title only. */}
      <h1 className="sr-only">Live Studio controller</h1>

      {/* ═══ STATUS ROW ═══════════════════════════════════════════════════════
          Everything a header used to spend ~150px saying, in one 44px row that is
          also useful mid-show. Mirrors the shipped panood control-room strip.

          ⭐ WAVE 8: this row is also THE WAY OUT. Removing the app chrome removed
          the sidebar, the bottom nav and the account plaque — every route back to
          the dashboard. Stranding an operator on a full-screen surface with no
          exit would be a worse defect than the scrolling this wave fixes, so the
          back control is a labelled 44px target with visible text at sm+, not a
          bare icon. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-ink/10 bg-ink/[0.03] px-2">
        <Link
          href={detailHref}
          aria-label="Leave the controller — back to Live Studio"
          title="Leave the controller — back to Live Studio"
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-1.5 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          <span className="hidden text-[11px] font-medium sm:inline">Exit</span>
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

      {/* ═══ STATUS BANNERS ═══════════════════════════════════════════════════
          ⭐ WAVE 8: these used to be a stacked block in the page flow, which under a
          fixed viewport would push the transport row off-screen every time a server
          action came back. They are now a floating toast layer over the top of the
          surface — `pointer-events-none` so they never swallow a tap meant for the
          monitor, and `position: fixed` so they cost the layout ZERO height. Every
          message is preserved verbatim; only where they are drawn changed. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3rem)] z-30 mx-auto flex w-full max-w-md flex-col gap-1.5 px-3"
      >
      <ToastLayer>
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
      </ToastLayer>
      </div>

      {/* ═══ THE SINGLE SCREEN ════════════════════════════════════════════════
          Phone: monitor → transport → channel grid, stacked.
          Desktop (lg+): monitor + transport LEFT, channel grid RIGHT — the same
          components, re-flowed (the prototype's Desktop toggle).

          ⭐ WAVE 8: this is now the FLEX BODY of a fixed viewport — `min-h-0` on
          every level so the grid column can actually shrink (without it a flex
          child's `auto` min-height is its content, and the "scroller" silently
          grows the shell instead of scrolling). The desktop breakpoint is a real
          two-column grid with `lg:overflow-hidden` on the left column, so a long
          window warning cannot push the transport out of a fixed viewport. */}
      {/* WAVE 4 · ONE shared WebRTC viewer for the whole operating screen. The
          transport is one-publisher-→-one-viewer per slot, so the CH 1 monitor and
          every tile must subscribe to the SAME connection — two viewers would
          fight and one of them would go black. See _components/camera-feeds.tsx. */}
      <CameraFeedsProvider eventId={eventId} streamingEnabled={streamingOn}>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2.5 pt-2 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-stretch lg:gap-3 lg:px-3">
        {/* ── LEFT · CH 1 monitor + transport. Never scrolls. ───────────────── */}
        <div data-lsc-left
          className="flex min-h-0 shrink-0 flex-col gap-2 lg:overflow-hidden">
          <section
            data-lsc-monitor
            aria-label="Channel 1 — the controlled screen"
            /* ⭐ WAVE 8 · `max-h` is the anti-clip valve. `aspect-video` alone is a
               RIGID 56.25% of the width, so on a short phone (360×640) the monitor
               would claim ~190px it cannot give back and the grid below would
               collapse to nothing. Capping it in dvh lets the monitor give way
               first, and every overlay is positioned against this box, so a
               slightly-off ratio costs nothing, while a clipped transport row
               costs the operator their go-live.
               ⭐ WAVE 9 · the picture is `object-contain`, matching the program
               output (program-surface.tsx) exactly. This is the ONE monitor an
               operator composes a shot against — it has to show what actually
               goes out, portrait letterboxing included, or a frame that looks
               fine here airs pillarboxed with no way to see it happening. */
            className={`relative aspect-video max-h-[34dvh] w-full shrink-0 overflow-hidden rounded-2xl border-2 bg-ink/90 lg:max-h-[46dvh] ${
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
            <ChannelVideo slot={programSlot} className="absolute inset-0 h-full w-full object-contain" />

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
          <div
            /* ⭐ WAVE 8: two-up at EVERY width, which is what the prototype's
               `.transport` row does (`.golive{flex:1}` with the guest-pick switch
               beside it). It used to stack below `sm:`, costing 112px of a 640px
               phone for two 52px controls — the single largest avoidable block in
               the fixed budget, and it sat directly under the monitor. */
            className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2"
          >
            <TransportRow
              eventId={eventId}
              oauthReady={oauthReady}
              connected={hasRouteToAir}
              isLive={isLive}
              liveSource={liveAir.source}
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
                className="flex h-full min-h-[52px] w-full items-center gap-1.5 rounded-xl border border-ink/10 bg-cream/70 px-2.5 py-2 text-left text-xs text-ink/75 transition-colors hover:border-terracotta/40 sm:gap-2 sm:px-3"
              >
                <Users aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="leading-tight">
                  <span className="block font-semibold">Guest-pick</span>
                  {/* ⭐ WAVE 8: the explanatory line is desktop-only. At 360px the
                      transport is two-up (prototype parity) and this sentence would
                      wrap to three lines, growing the row it is meant to keep small.
                      The state itself is never hidden — the On/Off pill beside it is
                      the actual answer, and the button's `title` carries the full
                      sentence for hover and AT. */}
                  <span className="hidden text-[11px] sm:block">
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

          {/* ── INGEST HEALTH — is the encoder actually sending video? ──────────
              lib/live-studio-ingest-health.ts § the defect: `getYoutubeStreamStatus`
              cost 1 quota unit and had zero callers, so a dead encoder mid-ceremony
              rendered identically to a healthy one. Only mounted when a Setnayan-
              managed broadcast exists to poll — the by-hand route (below) has no
              stream_id for YouTube to report on. PERSISTENT, beside the tally —
              never a toast, never console-only. */}
          {liveAir.source === 'broadcast' ? (
            <IngestHealthStrip
              eventId={eventId}
              initialLive
              initialStreamStatus={null}
              initialHealthStatus={null}
            />
          ) : null}

          {/* ── BY-HAND ON AIR ────────────────────────────────────────────────
              The host who starts their own stream and pastes the watch link — the
              route the Watch-link card below sends them down, and until Setnayan's
              own YouTube channel is connected the ONLY route that works — left no
              trace anything could read. They lost the red tally AND the ⚡ Moment
              button they had paid for.

              Offered when one-tap go-live is unavailable, OR whenever the switch is
              already on: a host who declares themselves on air and later connects
              YouTube must not watch the only way to turn it off disappear while the
              red light stays lit. Whenever the state exists, so does its handle. */}
          {offerManualAir ? (
            <form
              action={manualOnAir ? clearControlManualAir : setControlManualAir}
              className="shrink-0"
            >
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                pendingLabel={manualOnAir ? 'Ending…' : 'Going on air…'}
                overlay={false}
                aria-pressed={manualOnAir}
                title={
                  manualOnAir
                    ? 'Your control room is showing as on air — tap when your stream ends'
                    : 'Already streaming from YouTube or Facebook? Tap to light up your control room'
                }
                className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                  manualOnAir
                    ? 'bg-danger-600 font-mono uppercase tracking-[0.08em] text-cream hover:bg-danger-700'
                    : 'border border-dashed border-ink/20 bg-cream/70 text-ink/75 hover:border-terracotta/40 hover:text-ink'
                }`}
              >
                <Radio aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                {manualOnAir ? 'We’re off air' : 'We’re on air'}
              </SubmitButton>
            </form>
          ) : null}

          {/* ── ⭐ THE 12-HOUR ARCHIVE CAP (§ 4f ③) ──────────────────────────
              🚫 LS6 (2026-09-02) retired the OTHER two warnings that used to live in
              this slot — the broadcast-day countdown ("ends in 43 minutes", "add
              another day") and the unanchored-day notice — because multi-cam no
              longer expires on a clock (lib/live-studio-window.ts). Only the
              archive cap survives: it is YouTube's own per-stream recording limit,
              unrelated to how Live Studio is billed.

              Sits directly under the transport because it is about a broadcast that
              is already running, and it is a TIME CROSSING mid-show — which is why
              it lives in a client component that ticks rather than in this server
              render nobody is going to refresh: approaching 12 hours, YouTube
              archives only the first 12 hours, so a longer stream can leave no
              replay — the sharp edge for a wedding feeding the Alaala handover.

              It DECIDES nothing: the entitlement is `broadcastWindow` above, resolved
              server-side on every render of this page, the pop-out and the public
              page. Nothing here disables a control or ends a broadcast.

              ⭐ WAVE 8: `compact` + a hard `max-h` bound. This block appears WITHOUT
              WARNING (a time crossing) directly above the transport. Unbounded, that
              is the one thing capable of pushing Go live out of a viewport nobody
              can scroll — the exact failure § 4g exists to prevent. It stays in the
              FIXED region because an archive deadline is not something to bury in a
              scroller; it is simply not allowed to grow without limit.
              `overflow-y-auto` is the last-resort valve, not the steady state (the
              strip returns null in normal operation). */}
          <div
            data-lsc-window
            className="max-h-[18dvh] shrink-0 overflow-y-auto overscroll-contain empty:hidden"
          >
          <BroadcastWindowStrip
            compact
            isLive={isLive}
            broadcastStartedAt={broadcastStartedAt}
          />
          </div>

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
            /* ⭐ WAVE 8: `shrink-0` — the icon row is part of the fixed operating loop.
               It keeps its own horizontal scroll (the prototype's `.layouts` strip does
               the same); horizontal scroll inside a fixed row is not page scroll. */
            className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-1 pb-0.5"
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

            {/* ⭐ WAVE 8 · THE DOOR TO SETUP. Everything that is typing rather than
                operating — connect YouTube, encoder credentials, the channel
                manager and its join QRs, overlay text + corners, the moments list,
                the watch link — moved off the fixed surface into a sheet (§ 4g).
                A plain anchor, so it works with JS still loading and so the
                existing `#connect` / `#add-camera` deep links keep working through
                the same hash mechanism. */}
            <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-ink/10" />
            <a
              href="#setup"
              title="Cameras, overlays, encoder and watch link"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink/65 transition-colors hover:border-terracotta/45 hover:text-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
              Setup
            </a>
          </div>
        </div>

        {/* ── RIGHT · camera-channel grid — THE ONLY INTERNAL SCROLLER ──────────
            ⭐ WAVE 8 (§ 4g): "Only the camera-channel grid may scroll internally."
            The column header stays put; the tiles below it are the one region that
            scrolls, and the notices that used to live under the transport ride with
            them so nothing was deleted to make the loop fit. */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
            <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink/55">
              Camera channels · {zones.length} of {MAX_ROAM_ZONES}
            </h2>
            <span className="ml-auto text-[11px] text-ink/45">tap = put on Channel 1</span>
          </div>

          {/* ⭐ NO RELAY = A NETWORK RULE THE HOST HAS TO KNOW BEFORE THE DAY.
              turnConfigured() has existed since TURN landed and was read by nothing,
              so a host whose cameras all failed with "couldn't reach the controller
              on this network" had no way to learn whether a relay even existed.
              Stated here, beside the cameras it governs, rather than in a log.
              ⚠ A NOTICE, NOT A BLOCKER: without a relay cameras still connect on a
              network that permits peer traffic, so refusing to show the grid would
              take away something that works. */}
          {!relayConfigured ? (
            <p className="shrink-0 rounded-lg border border-terracotta/25 bg-terracotta/5 px-3 py-2 text-[11.5px] leading-snug text-ink/75">
              <strong className="font-semibold text-ink/85">No camera relay is set up.</strong>{' '}
              Every camera phone must be on the same Wi-Fi as this controller — and on a
              network that lets devices talk to each other, which guest Wi-Fi usually does
              not. If a camera says it can&rsquo;t reach the controller, this is why.
            </p>
          ) : null}

          <div
            data-testid="lsc-channel-scroller"
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-1 pr-0.5"
          >
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
                room. Opens the Setup sheet at the add-camera form (§ 4g: nothing to
                scroll to any more — the anchor opens the sheet). */}
            {!atCap ? (
              <a
                href="#add-camera"
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/20 text-center text-[11.5px] font-semibold text-ink/55 transition-colors hover:border-terracotta/50 hover:text-terracotta"
              >
                <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
                Add camera
                <span className="text-[10px] font-normal text-ink/40">{addCameraCaption}</span>
              </a>
            ) : null}
          </div>

          {/* 🔑 THE EMPTY STATE IS CORRECTED IN PLACE, NOT ADDED ABOVE. This shell
              is the owner-locked scroll-free controller ("nothing under and above
              it"), so a banner is not available here — and it is not needed: the
              lie was always this sentence, which invited an operator with cameras
              already set up to go and add their first one, mid-event. */}
          {zones.length === 0 ? (
            zonesUnreadable ? (
              <p className="px-1 text-[11px] leading-snug text-warn-900">
                Your cameras couldn&rsquo;t be loaded just now — this is not a sign you have
                none. Any camera already set up is still set up. Reload to bring them back.
              </p>
            ) : (
              <p className="px-1 text-[11px] leading-snug text-ink/50">
                No cameras yet. Add your first in Setup — each one becomes its own channel you can put on
                Channel 1 with a tap. Setting them up and rehearsing with them is free.
              </p>
            )
          ) : null}

          {atCap ? (
            <p className="px-1 text-[11px] text-ink/50">
              You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one in Setup to add another.
            </p>
          ) : null}

          {/* ── ⭐ WAVE 5 · THE PATH TO AIR ───────────────────────────────────
              Installs the program bridge (so Channel 1 has an output window at
              all) and opens the chrome-less pop-out the host's encoder captures.
              Publishes what the SERVER permits, never the raw cut.

              ⭐ WAVE 8 · IT MOVED HERE, AND IT MUST STAY MOUNTED. This component
              INSTALLS the bridge in an effect and disposes it on unmount, so it
              could not go into the setup sheet: closing the sheet would unmount it
              and kill a host's live output mid-ceremony. It sits at the foot of the
              always-rendered scroller instead — the pop-out is opened once while
              setting OBS up, not reached for mid-show. */}
          <ProgramBridgeHost
            eventId={eventId}
            air={air}
            isLive={isLive}
            airLabel={airLabel}
            streamingEnabled={streamingOn}
            mainStageSlot={programSlot}
          />

          {/* ⭐ THE RESOLVED STATUS, KEPT CURRENT. `resolveChannelStatus` above runs
              once per render and this page has no timer of its own, so without this
              the honest status freezes at page load — which is how a card was seen
              reading "Camera connected" over a heartbeat 140 seconds stale. Renders
              nothing; installs no timer at all when no seat is bound. It sits here,
              beside ProgramBridgeHost and OUTSIDE the setup sheet, for the same
              reason that one does: a component the sheet can unmount is a component
              that stops working the moment the host closes the sheet. */}
          <ChannelFreshness channels={zones.map((z) => ({ hasSeat: Boolean(z.camera) }))} />

          {/* THE CUT THAT DID NOT REACH AIR — stated on the controller, in plain
              words, rather than left for the host to discover from their own
              stream. A free host's program output is pinned to their ★ default
              channel: the cut is real rehearsal and the monitor follows it, but the
              encoder keeps seeing the one channel they may broadcast.
              Only ever rendered when there is a genuine difference to report. */}
          {air.withheld ? (
            <p className="flex flex-wrap items-baseline gap-x-1.5 rounded-xl border border-terracotta/35 bg-terracotta/[0.06] px-3.5 py-2.5 text-[11.5px] leading-snug text-ink/70">
              <MonitorPlay
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-terracotta"
                strokeWidth={1.9}
              />
              <span className="min-w-0">
                <span className="font-semibold text-ink">
                  That cut is rehearsal — your broadcast is still on {airLabel}.
                </span>{' '}
                {/* WAVE 7 · the copy forks on `entitled`, not on the capability. Telling
                    a couple who ALREADY BOUGHT Live Studio that switching "is what the
                    unlock buys" would be false — they bought it; their event-day ran
                    out. The honest sentence names the day, and the window strip beside
                    the transport carries the button. */}
                {entitled ? (
                  <>
                    Your broadcast day has ended, so live switching is paused. Add another day
                    {priceLabel ? ` (${priceLabel})` : ''} to cut between cameras on air again —
                    until then, choose which single camera goes out with the ★ default control in
                    Setup.
                  </>
                ) : (
                  <>
                    Switching cameras on air is what the unlock
                    {priceLabel ? ` (${priceLabel})` : ''} buys. Choose which single camera your
                    free broadcast carries with the ★ default control in Setup.
                  </>
                )}
              </span>
            </p>
          ) : null}

          {/* ── THE PAYWALL, AT THE GO-LIVE MOMENT (Wave 3 · § 4d) ────────────
              Not a padlock over the tiles — a sentence beside the cameras it is
              about, and only once the host has more than one camera to broadcast.
              Their single-camera stream stays free and is not blocked. */}
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

          {/* WHAT ACTUALLY GOES OUT (Wave 3). The monitor is a placement rehearsal;
              this is the entitlement-derived truth beside it, so the preview is
              never mistaken for a promise. Only shown when the two differ — a paid
              host needs no disclaimer. */}
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
        </div>
      </div>
      </CameraFeedsProvider>

      {/* ═══ UNLOCK BAR — the pitch, price from the catalog ════════════════════
          Wave 3 wording: what the ₱3,000 buys is BROADCASTING the cameras, because
          using them is already free. This is the sales surface, not a gate.

          ⭐ WAVE 8: the prototype's fixed bottom `.unlock` bar. `shrink-0`, so it is
          the last fixed row of the viewport and can never be scrolled away from —
          and the copy is clamped to two lines so a long catalog price string cannot
          grow the bar into the grid's space. */}
      {!lock.multiCamUnlocked ? (
        <Link
          href={detailHref}
          className="m-2 flex shrink-0 items-center gap-2 rounded-2xl border border-terracotta/40 bg-gradient-to-r from-terracotta/10 to-terracotta/[0.04] p-2.5 transition-colors hover:from-terracotta/15 sm:m-2.5 sm:gap-3 sm:p-3 lg:mx-3"
        >
          <span className="min-w-0 flex-1 text-xs leading-snug text-ink/65">
            <span className="line-clamp-2 block text-[12.5px] font-semibold text-ink">
              Rehearse free — unlock to broadcast all your cameras
              {priceLabel ? ` · ${priceLabel} · one event` : ' · one event'}
            </span>
            {/* ⭐ WAVE 8 · MEASURED, not guessed. At 360×640 this paragraph plus a
                wrapping CTA made the bar 193px — 30% of the viewport — and squeezed
                the camera grid to 52px, roughly a third of one tile. The headline
                already carries the offer AND the price, so the phone keeps that and
                the elaboration returns at sm+. */}
            <span className="hidden line-clamp-2 text-ink/65 sm:block">
              Set up every camera, name them and practise your cuts as often as you like. The
              unlock is what puts more than one of them on air for your guests — with guest-pick
              and your own monogram and lower third.
            </span>
          </span>
          {/* `shrink-0` + no wrap on the parent: the CTA must never drop onto its own
              line, which is what doubled the bar's height on a small phone. */}
          <span className="shrink-0 rounded-lg bg-mulberry px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.04em] text-cream sm:px-3.5">
            {lock.unlockCtaLabel}
          </span>
        </Link>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECONDARY · SETUP — ⭐ WAVE 8: off the fixed surface, into a sheet.

          It used to stack under the operating loop, which is why the page scrolled.
          None of it is deleted and none of it is gated differently; it is the same
          server-rendered markup, handed to <SetupSheet> as children so it can be
          reached from the Setup chip in the icon row (and from the existing
          `#connect` / `#add-camera` anchors, which now open the sheet instead of
          scrolling a page that no longer scrolls).
          ═══════════════════════════════════════════════════════════════════════ */}
      <SetupSheet>

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
        ) : liveStudioPoolOnly() ? (
          /* ⭐ POOL-ONLY: the server refuses this door too (409), so a button here
             would dead-end either way. Only an event that bought the hosted-channel
             add-on has "nothing to connect" as the whole truth — everyone else
             still has their own route to air (the "Watch link" section below). */
          <p className="inline-flex items-start gap-2 rounded-lg border border-ink/15 bg-ink/5 px-3 py-2.5 text-sm text-ink/70">
            {poolOnlyConnectNotice(ownsHostedChannel)}
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
            {/* ⭐ Deliberately the same sentence as the setup card's encoder block: an
                operator who only ever opens the controller must not be the one couple who
                never hears it. A watch link is not a file — lib/live-studio-recordings.ts. */}
            <p className="max-w-prose rounded-lg border border-terracotta/25 bg-terracotta/5 p-3 text-xs text-ink/75">
              <strong className="font-semibold text-ink/85">Press “Start Recording” too.</strong>{' '}
              OBS saves a full-quality copy to your own computer while it streams. You keep that
              file even if the broadcast drops, and if Setnayan supplied the channel it is the
              only copy you can download.
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

        {/* ── THE PRINTABLE HAND-OUT ────────────────────────────────────────
            The sheet has existed for months with NO doorway a host could reach:
            its only link sat on the cameras page, whose own links live on the
            retired control room — which redirects away on sight once this
            controller is switched on. So the one artefact you carry to a venue
            was reachable only by typing its URL.

            It goes HERE, on the surface that survives the flag flip, directly
            under the join QRs it prints — the same reasoning the recording
            handoff records a few hundred lines up.

            Shown only when there is genuinely something to print: a link onto
            "nothing to print yet" is a fake door, and the collapsed QR blocks
            above are where a host makes the codes in the first place. */}
        {printableCards > 0 ? (
          <Link
            href={`/dashboard/${eventId}/studio/panood/cameras/print`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink/70 transition-colors hover:border-terracotta/50 hover:text-terracotta"
          >
            <Printer aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Print {printableCards === 1 ? 'the join card' : `${printableCards} join cards`}
          </Link>
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
          The icon row on the controller is the operating loop (on/off in one tap,
          mid-show). The text and corner choices live here, because typing is setup. */}
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

        {/* 🎞 EVERY FILM OF THEIR DAY — free, and the promise the ₱2,500 description
            already makes. Sits under the watch link because it is the same gesture
            (paste a link) for the same reason (so guests find it in one place), and
            because a couple thinking about their live stream is exactly who is also
            holding their videographer's link. */}
        <div className="mt-6 border-t border-ink/10 pt-5">
          <p className="sn-eye">Films of your day</p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-semibold tracking-tight">
            <MonitorPlay aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            Add your other videos
          </h3>
          <p className="mt-1 max-w-prose text-sm text-ink/65">
            Your same-day edit, prenup, or your videographer&rsquo;s finished film — paste a
            YouTube or Vimeo link and it joins your story, beside the photos, for good. Free,
            and there is no limit.
          </p>

          {film_error ? (
            <p role="alert" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/10 px-2.5 py-1 text-xs text-terracotta-700">
              <AlertCircle aria-hidden className="h-3.5 w-3.5" /> That link isn&rsquo;t a YouTube
              or Vimeo video. Those are the two we can play.
            </p>
          ) : null}
          {film_saved ? (
            <p role="status" className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-success-300/70 bg-success-50 px-2.5 py-1 text-xs font-medium text-success-800">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Added to your story.
            </p>
          ) : null}

          {films.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {films.map((film) => (
                <li key={film.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white/60 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {film.label ?? (film.provider === 'youtube' ? 'YouTube video' : 'Vimeo video')}
                    </span>
                    <span className="font-mono text-[11px] text-ink/50">{film.provider}</span>
                  </span>
                  <form action={removeEventFilm}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="film_id" value={String(film.id)} />
                    <SubmitButton
                      pendingLabel="Removing…"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
                    >
                      <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}

          <form action={addEventFilm} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="text"
              name="film_label"
              placeholder="What is it? e.g. Same-Day Edit"
              className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none sm:w-56"
            />
            <input
              type="text"
              name="film_url"
              required
              placeholder="Paste a YouTube or Vimeo link"
              className="min-h-[44px] flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
            />
            <SubmitButton
              pendingLabel="Adding…"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90"
            >
              Add film
            </SubmitButton>
          </form>
        </div>

        {/* DUAL-STREAM (owner-approved 2026-07-26) — the optional second door.
            Same section as the YouTube link because it is the same question
            ("how do guests watch?"), and because the 30-day warning inside the
            card has to sit next to the permanent copy it is contrasting with. */}
        <FacebookDualStreamCard
          eventId={eventId}
          facebookUrl={facebookWatchUrl}
          saveAction={saveControlFacebookUrl}
          clearAction={clearControlFacebookUrl}
          saved={Boolean(facebook_url_saved)}
          error={Boolean(facebook_url_error)}
        />
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

      {/* AFTER the "On the day" note, deliberately: the sheet reads in event order
          — set up, go live on the day, then collect the recording. Compact because
          Wave 8 made vertical space the scarce resource in this sheet. */}
      <LiveStudioRecordingsCard recordings={recordings} compact />
      </SetupSheet>
    </div>
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
        <span className={`absolute ${overlayPositionClass(overlays.monogram.position)}`}>
          {overlays.monogram.markDataUri ? (
            // Inert data URI, already sanitized by safeMonogramSvg (SEC-3) — no optimizer benefit.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={overlays.monogram.markDataUri}
              alt=""
              className="h-9 w-9 object-contain drop-shadow"
            />
          ) : (
            <span className="rounded-full border border-cream/35 bg-ink/40 px-3 py-1 font-serif text-[13px] italic text-cream backdrop-blur-sm">
              {overlays.monogram.text}
            </span>
          )}
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
          Joined
        </span>
        {/* 🔴 THIS SAID "A phone holds CH 3" ON EVERY CHANNEL. During the
         *  ceremony the host is reading this list to decide which camera to cut
         *  to, and eight identical sentences answer none of that. The claim has
         *  always recorded WHO — `panood_camera_operators.claimer_user_id` —
         *  and nothing ever joined it to a name for display.
         *  ⚠ NAMING THE HOLDER DOES NOT MAKE REISSUING SAFER, so the warning
         *  keeps its own sentence rather than being folded into the name. */}
        <span className="min-w-0 flex-1">
          <strong className="text-ink/80">{camera.holderName ?? 'Someone'}</strong> holds
          CH {channel}. Reissuing makes a new QR and disconnects them — the old
          link stops working immediately.
        </span>
        <form action={reissueChannelJoinLink}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="zone_id" value={zone.id} />
          <SubmitButton
            pendingLabel="…"
            overlay={false}
            title={`Disconnect ${camera.holderName ?? 'the phone'} on CH ${channel} and make a new QR`}
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
