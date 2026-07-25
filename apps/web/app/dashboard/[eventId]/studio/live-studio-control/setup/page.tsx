import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Trash2,
  Plus,
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
  ExternalLink,
  Unlink2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { eventSkuActive } from '@/lib/entitlements';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  LIVE_STUDIO_SKU,
  liveStudioDetailPath,
  liveStudioControlLock,
} from '@/lib/live-studio-control';
import { MAX_ROAM_ZONES, canAddZone } from '@/lib/live-studio-roam-zones';
import { getYoutubeOAuthConfig } from '@/lib/panood-youtube';
import {
  getActivePanoodBroadcast,
  getActivePanoodStreamKey,
} from '@/lib/panood-broadcast';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { PageMasthead } from '@/app/_components/page-masthead';
import { SubmitButton } from '@/app/_components/submit-button';
import { GoLiveCard } from '../../panood/setup/go-live-card';
import {
  addRoamZone,
  deleteRoamZone,
  setFeaturedRoamZone,
  cutToMainStage,
  clearMainStage,
  saveControlWatchUrl,
  clearControlWatchUrl,
} from './actions';

export const metadata = { title: 'Live Studio controller · Setnayan' };

// UNIFIED Live Studio CONTROL — ONE controller shared by the FREE single-camera
// livestreamer AND the PAID multi-camera (LIVE_STUDIO) host (owner 2026-07-25 refined
// design). Single screen, minimal navigation:
//
//   • FREE, always available: the single-camera livestream — connect YouTube, go
//     live / take off air, publish the watch link. Reuses the exact, already-live
//     panood GoLiveCard (the proven one-tap go-live path) and mirrors its watch-url
//     save into this route's own actions so free stays free and the single screen
//     never bounces to the old panood page.
//   • LOCKED until LIVE_STUDIO is purchased: the multi-camera extras — the camera
//     strip (add-via-QR + one-tap "Cut to Main Stage" + set-default) and guest-pick.
//     These are ALWAYS VISIBLE but greyed/disabled with an inline "Unlock · <price>"
//     CTA that routes to the buy. Purchasing unlocks them in place; the server
//     actions carry the same ownership backstop (setup/actions.ts).
//
// The whole surface is behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED (dark until the
// owner flips it). Live YouTube streaming is a further, separate owner-OAuth gate.

type ZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  is_main_stage: boolean;
  status: string;
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

  // ── Entitlement — the multi-camera LOCK. Unlike the old Roam controller, a free
  // (un-owned) host is NOT bounced away: they open the SAME controller and use the
  // free single-camera livestream, with the multi-camera extras shown locked.
  const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  const sku = await formatV2Sku(LIVE_STUDIO_SKU).catch(() => null);
  const priceLabel = sku ? formatPhp(sku.price_php) : null;
  const lock = liveStudioControlLock(owned, priceLabel);
  const detailHref = liveStudioDetailPath(eventId);

  // ── Multi-camera channels (control-plane; RLS scopes to the host's own event).
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

  return (
    <section className="space-y-6">
      <Link
        href={detailHref}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Live Studio
      </Link>

      <PageMasthead
        title="Live Studio controller"
        lede="One screen to run your livestream. Go live with a single camera for free — then unlock multiple cameras, cut whichever one you want onto the Main Stage with a tap, and let remote guests pick their own view."
      />

      {/* status banners */}
      {zone_added ? <Banner tone="success" Icon={CheckCircle2}>Camera added to your picker.</Banner> : null}
      {zone_deleted ? <Banner tone="muted" Icon={Trash2}>Camera removed.</Banner> : null}
      {featured_set ? <Banner tone="success" Icon={Star}>Default camera updated.</Banner> : null}
      {main_stage_cut ? <Banner tone="success" Icon={Scissors}>Cut to Main Stage.</Banner> : null}
      {main_stage_cleared ? <Banner tone="muted" Icon={PowerOff}>Main Stage is off air.</Banner> : null}
      {watch_url_saved ? <Banner tone="success" Icon={CheckCircle2}>Watch link saved — guests see “Watch Live”.</Banner> : null}
      {watch_url_error ? <Banner tone="error" Icon={AlertCircle}>That doesn’t look like a YouTube link — paste the watch or share URL.</Banner> : null}
      {zone_error === 'label' ? <Banner tone="error" Icon={AlertCircle}>Give the camera a name before adding it.</Banner> : null}
      {zone_error === 'cap' ? (
        <Banner tone="error" Icon={AlertCircle}>You’ve reached the limit of {MAX_ROAM_ZONES} cameras for one event.</Banner>
      ) : null}
      {zone_error === 'save' ? <Banner tone="error" Icon={AlertCircle}>Couldn’t save that camera — please try again.</Banner> : null}

      {/* ═══ THE CONTROLLER — single-screen core operating loop ═══════════════
          Live monitor · camera strip (cut to Main Stage) · guest-pick · go-live. */}
      <section aria-labelledby="control-heading" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Live monitor + Main Stage ──────────────────────────────────── */}
        <div className="sn-tile space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="control-heading"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <MonitorPlay aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Main Stage
            </h2>
            {owned && mainStageZone ? (
              <form action={clearMainStage}>
                <input type="hidden" name="event_id" value={eventId} />
                <SubmitButton
                  pendingLabel="Ending…"
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-burgundy/40 hover:text-burgundy"
                >
                  <PowerOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Take off air
                </SubmitButton>
              </form>
            ) : null}
          </div>

          {/* The live monitor — the camera currently on the Main Stage. Real video
              arrives with the streaming rollout (OAuth-gated); today it shows which
              source is on air (paid) or the single-cam livestream state (free). */}
          <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-ink/10 bg-ink text-center">
            {owned && mainStageZone ? (
              <p className="inline-flex flex-col items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-cream">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
                  On air
                </span>
                <span className="text-sm font-semibold tracking-normal normal-case text-cream">
                  {mainStageZone.label}
                </span>
              </p>
            ) : activeBroadcast ? (
              <p className="inline-flex flex-col items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-cream">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
                  Live — single camera
                </span>
              </p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
                {owned ? 'Main Stage off air — cut a camera' : 'Go live below to start your stream'}
              </p>
            )}
          </div>

          {/* Guest-pick — a PAID capability. Locked for a free host, "on" for a paid
              host (the picker exists whenever there are multiple cameras). */}
          <div
            className={[
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm',
              lock.multiCamUnlocked
                ? 'border-ink/10 bg-cream/60 text-ink/75'
                : 'border-ink/10 bg-ink/[0.03] text-ink/45',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Guests can pick their own view
            </span>
            {lock.multiCamUnlocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
                <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                On
              </span>
            ) : (
              <UnlockChip href={detailHref} label={lock.unlockCtaLabel} />
            )}
          </div>
        </div>

        {/* ── Camera strip (cut to Main Stage) ───────────────────────────── */}
        <div className="sn-tile relative space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Scissors aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              Cameras
            </h2>
            {lock.multiCamUnlocked ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                {zones.length} of {MAX_ROAM_ZONES}
              </span>
            ) : (
              <UnlockChip href={detailHref} label={lock.unlockCtaLabel} />
            )}
          </div>

          {!lock.multiCamUnlocked ? (
            <LockedCameraStrip href={detailHref} label={lock.unlockCtaLabel} />
          ) : zones.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ink/15 bg-cream/60 p-3 text-sm text-ink/60">
              No cameras yet. Add your first below — each is a phone your paparazzi join by
              scanning the event QR (no install).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                Tap a camera to cut it onto the Main Stage
              </p>
              <div className="flex flex-col gap-2">
                {zones.map((z) => (
                  <div
                    key={z.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream/60 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-ink/45">#{z.zone_index}</span>
                      <span className="truncate font-medium text-ink">{z.label}</span>
                      {z.is_featured ? (
                        <Star aria-hidden className="h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={2} />
                      ) : null}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!z.is_featured ? (
                        <form action={setFeaturedRoamZone}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="zone_id" value={z.id} />
                          <SubmitButton
                            pendingLabel="…"
                            title="Make default camera"
                            className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-white px-2 py-1 text-[11px] font-medium text-ink/60 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                          >
                            <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </SubmitButton>
                        </form>
                      ) : null}
                      <form action={cutToMainStage}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="zone_id" value={z.id} />
                        <SubmitButton
                          pendingLabel="Cutting…"
                          disabled={z.is_main_stage}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                            z.is_main_stage
                              ? 'cursor-default bg-terracotta text-cream'
                              : 'bg-mulberry text-cream hover:bg-mulberry-600',
                          ].join(' ')}
                        >
                          {z.is_main_stage ? (
                            <>
                              <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                              On air
                            </>
                          ) : (
                            <>
                              <Scissors aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Cut
                            </>
                          )}
                        </SubmitButton>
                      </form>
                      <form action={deleteRoamZone}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="zone_id" value={z.id} />
                        <SubmitButton
                          pendingLabel="…"
                          title="Remove camera"
                          className="inline-flex items-center rounded-md border border-ink/15 bg-white px-2 py-1 text-ink/50 transition-colors hover:border-burgundy/40 hover:text-burgundy"
                        >
                          <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ GO LIVE — FREE single-camera livestream (available to everyone) ═══ */}
      <GoLiveCard
        eventId={eventId}
        oauthReady={oauthReady}
        connected={!!youtubeGrant}
        // Single-cam go-live is FREE for any host (owner model 2026-06-26). The page
        // is already host-gated; pass true so the free base always works regardless
        // of LIVE_STUDIO ownership (that SKU gates the multi-camera extras only).
        ownsPanood={true}
        active={
          activeBroadcast
            ? {
                broadcastId: activeBroadcast.broadcast_id,
                ingestionUrl: activeBroadcast.ingestion_url,
                status: activeBroadcast.status,
                watchUrl: `https://www.youtube.com/watch?v=${activeBroadcast.broadcast_id}`,
              }
            : null
        }
        streamKey={activeStreamKey}
      />

      {/* ═══ Setup (secondary) — connect · add cameras · watch link · rollout ═══ */}
      {/* Connect YouTube (free single-cam prerequisite) */}
      <section aria-labelledby="connect-heading" className="sn-tile space-y-3 p-5 sm:p-6">
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

      {/* Add a camera — LOCKED for a free host (multi-camera extra). */}
      <section aria-labelledby="add-heading" className="sn-tile space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="sn-eye">Add a camera</p>
            <h2 id="add-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Plus aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              New channel
            </h2>
            <p className="max-w-prose text-sm text-ink/65">
              Each camera is a phone your paparazzi join by scanning the event QR — no install, no
              account. Only you (signed in here) run the controller.
            </p>
          </div>
          {!lock.multiCamUnlocked ? <UnlockChip href={detailHref} label={lock.unlockCtaLabel} /> : null}
        </div>

        {!lock.multiCamUnlocked ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/45">
            <Lock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Adding cameras is part of Live Studio.
            <Link href={detailHref} className="font-medium text-terracotta hover:underline">
              {lock.unlockCtaLabel}
            </Link>
          </p>
        ) : atCap ? (
          <p className="rounded-lg border border-ink/15 bg-ink/5 p-4 text-sm text-ink/60">
            You’ve reached the {MAX_ROAM_ZONES}-camera limit. Remove one to add another.
          </p>
        ) : (
          <form action={addRoamZone} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="event_id" value={eventId} />
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Camera name</span>
              <input
                type="text"
                name="label"
                required
                maxLength={60}
                placeholder="Ceremony, Reception Floor, Photo Booth…"
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
              Open the picker on this camera by default
            </label>
            <div className="sm:col-span-2">
              <SubmitButton
                pendingLabel="Adding…"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
              >
                <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
                Add camera
              </SubmitButton>
            </div>
          </form>
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
              Your single camera goes live free from your own phone or OBS. When you unlock Live
              Studio, each added camera goes live on a Setnayan channel and the picker on your event
              page lights up so guests can choose their view. That multi-camera streaming step is
              being wired now — we’ll email you the moment it’s ready. Nothing here needs redoing.
            </p>
          </div>
        </div>
      </section>
    </section>
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

/** The camera strip in its LOCKED state — a greyed preview + the unlock CTA. */
function LockedCameraStrip({ href, label }: { href: string; label: string }) {
  return (
    <div className="space-y-2">
      <div aria-hidden className="space-y-2 opacity-40">
        {['Ceremony', 'Reception Floor', 'Photo Booth'].map((name, i) => (
          <div
            key={name}
            className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream/60 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-ink/45">#{i + 1}</span>
              <span className="font-medium text-ink/70">{name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/10 px-2.5 py-1 text-xs font-semibold text-ink/50">
              <Scissors aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Cut
            </span>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-3 py-2.5 text-center text-sm font-semibold text-terracotta-700 transition-colors hover:bg-terracotta/10"
      >
        <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
        {label} — add cameras, cut to Main Stage, let guests pick
      </Link>
    </div>
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
