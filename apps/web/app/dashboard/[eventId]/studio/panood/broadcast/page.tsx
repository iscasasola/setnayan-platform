import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Tv, Lock, Sparkles, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import {
  fetchPanoodCameras,
  panoodCameraCapForTier,
  provisionPanoodCamerasAdmin,
  resolvePanoodTier,
} from '@/lib/panood-camera-seats';
import { fetchPanoodScreens } from '@/lib/panood-screens';
import {
  fetchPanoodMoments,
  provisionPanoodMomentsAdmin,
} from '@/lib/panood-moments';
import { fetchOrInitControlStateAdmin } from '@/lib/panood-control';
import { requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import { decideWatermark } from '@/lib/panood-watermark';
import { PanoodControlRoom } from './control-room';

export const metadata = { title: 'Panood control room · Setnayan' };

// Iteration 0011 — Panood multicam CONTROL ROOM (PR4).
//
// Replaces the prior static MOCK broadcaster preview with the REAL,
// persisting control room wired to the PR1-PR3 foundation
// (lib/panood-camera-seats · panood-screens · panood-moments ·
// panood-control). This is the PAID multicam controller: it gates on
// eventSkuActive(PANOOD_SYSTEM). The FREE single-cam YouTube go-live stays on
// ./setup (owner model 2026-06-26 — "the tool is free; the premium layer is
// paid"); PANOOD_SYSTEM is the premium multi-camera control room + moment
// director + venue-screen routing.
//
// On load (owner only): seed the default moment rail if empty + get-or-create
// the single control-state row, then fetch cameras/screens/moments/control-state
// and hand them to the client console. Every console control persists through a
// server action in ./actions.ts.


type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodControlRoomPage({ params }: Props) {
  const { eventId } = await params;
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

  // Control-room membership: a moderator (couple OR coordinator added as one) or
  // legacy couple membership. Non-members are bounced to the dashboard — this is
  // a day-of operator surface, not a viewer page.
  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  // Tier resolution — NOT a paid gate any more.
  //
  // The control room is now reachable on the FREE tier: the couple pairs every camera, checks
  // multiview and framing, and proves the rig works before paying. What they DON'T get for free
  // is a clean feed — every video surface carries the SETNAYAN overlay until they press Go live
  // on a paid event (lib/panood-watermark). The overlay is the paywall, so this page no longer
  // needs one.
  //
  // ⚠️ This also fixes a LIVE defect: the old check was `eventSkuActive(…, 'PANOOD_SYSTEM')`
  // alone, so a couple who paid ₱1,500 for the MOBILE Controller was shown an upsell wall on the
  // control room they had just bought. resolvePanoodTier checks both SKUs.
  const tier = await resolvePanoodTier(supabase, eventId);
  const owned = tier !== 'free';

  // Seed defaults + get-or-create control state through the service-role admin client (the
  // control-plane tables are couple-RLS / secret; the membership gate above is the authorization
  // boundary).
  const admin = createAdminClient();

  // Provision this tier's camera seats BEFORE the fetch below, or a first free visit renders an
  // empty rail and only self-heals on reload. Idempotent top-up: free takes indexes 1..3, so a
  // later paid order tops up to 8 in place and never disturbs a claimed camera or its token.
  const cameraCap = panoodCameraCapForTier(tier);
  await provisionPanoodCamerasAdmin(admin, eventId, cameraCap).catch(() => 0);

  await provisionPanoodMomentsAdmin(admin, eventId); // idempotent seed-when-empty
  const controlState = await fetchOrInitControlStateAdmin(admin, eventId);

  // Fetch the foundation data via the ADMIN client. The membership gate above is
  // the authorization boundary; reading under the host RLS session would BLANK the
  // console for a coordinator added via event_moderators (the control-plane RLS
  // keys off event_members.member_type, a different membership notion). All degrade
  // to []/null on a pre-bootstrap DB.
  const [camerasRaw, screensRaw, moments] = await Promise.all([
    fetchPanoodCameras(admin, eventId).catch(() => []),
    fetchPanoodScreens(admin, eventId).catch(() => []),
    fetchPanoodMoments(admin, eventId).catch(() => []),
  ]);

  // STRIP server-only secrets before crossing into the 'use client' console — the
  // camera claim_qr_token (a per-camera seat-hijack credential) and the screen
  // pairing_code must NEVER reach the browser / RSC Flight payload. The console
  // only needs id/index/label/status/current_source.
  const cameras = camerasRaw.map((c) => ({
    id: c.id,
    camera_index: c.camera_index,
    label: c.label,
    status: c.status,
  }));
  const screens = screensRaw.map((s) => ({
    id: s.id,
    screen_index: s.screen_index,
    name: s.name,
    current_source: s.current_source,
    status: s.status,
  }));

  // The SETNAYAN overlay decision — made HERE, on the server, and handed to the client as a
  // rendered fact. `owned` is the paid unlock; `first_live_at` is the write-once window anchor.
  // Never computed client-side: a paywall the browser decides is one devtools edit from free.
  const watermark = decideWatermark({
    paid: owned,
    firstLiveAt: controlState?.first_live_at ?? null,
    isLive: controlState?.is_live ?? false,
    now: new Date(),
  });

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio/panood/setup`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood setup
      </Link>

      {/* Doorway to camera pairing. Without this the Cameras page was ORPHANED — an operator
          standing in the control room had no way to reach the links that put a phone on air,
          which is the first thing anyone needs here. (Wayfinding rule: a page ships with its
          doorway.) */}
      <Link
        href={`/dashboard/${eventId}/studio/panood/cameras`}
        className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-terracotta/10 px-3 py-1.5 text-xs font-semibold text-terracotta hover:bg-terracotta/15"
      >
        <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Connect cameras
      </Link>

      <header className="sn-reveal space-y-2">
        <p className="sn-eye">Broadcast</p>
        <h1 className="sn-h1 flex items-center gap-3">
          <Tv aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          {event.display_name}
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          Run the show from here. Tap a source to put it on air, fire a moment to
          recompose the whole shot in one tap, and route each venue screen — every tap
          is saved live.
        </p>
      </header>

      {!owned && <UpgradeBanner eventId={eventId} />}

      <PanoodControlRoom
        eventId={eventId}
        cameras={cameras}
        screens={screens}
        moments={moments}
        controlState={controlState}
        watermark={watermark}
      />
    </section>
  );
}

/**
 * Read-side control-room membership check (mirrors the action-side
 * requireControlRoomMembership): a moderator (accepted, not removed — covers the
 * couple AND a coordinator added as a moderator) OR legacy couple membership.
 */
/**
 * Free-tier upgrade banner.
 *
 * Replaces the full-page upsell wall that used to BLOCK this route. The control room is now
 * reachable for free — the couple pairs cameras, verifies framing and proves their rig works —
 * so a wall here would defeat the whole model. What's withheld is the clean feed, and the
 * SETNAYAN overlay says that on every surface. This banner just names the price of removing it.
 */
function UpgradeBanner({ eventId }: { eventId: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-terracotta/25 bg-terracotta/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
        <p className="text-sm text-ink/75">
          <span className="font-semibold text-ink">Preview mode.</span> Connect every camera and
          test your whole setup free — the Setnayan mark stays on screen until you unlock Live
          Studio, then clears the moment you press Go live.
        </p>
      </div>
      <Link
        href={`/dashboard/${eventId}/studio/panood`}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-terracotta px-4 py-2 text-xs font-semibold text-cream hover:opacity-90 sm:self-auto"
      >
        <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Unlock Live Studio
      </Link>
    </div>
  );

}
