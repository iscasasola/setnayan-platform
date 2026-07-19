import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Tv, Lock, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchPanoodCameras } from '@/lib/panood-camera-seats';
import { fetchPanoodScreens } from '@/lib/panood-screens';
import {
  fetchPanoodMoments,
  provisionPanoodMomentsAdmin,
} from '@/lib/panood-moments';
import { fetchOrInitControlStateAdmin } from '@/lib/panood-control';
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

const PANOOD_SKU_CODE = 'PANOOD_SYSTEM';

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
  const isMember = await requireControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  // PAID multicam controller gate. eventSkuActive degrades to false on a missing
  // orders table (42P01/42703), so a pre-bootstrap env safely shows the upsell.
  let owned = false;
  try {
    owned = await eventSkuActive(supabase, eventId, PANOOD_SKU_CODE);
  } catch {
    owned = false;
  }

  if (!owned) {
    return <UpsellState eventId={eventId} eventName={event.display_name} />;
  }

  // Owner path. Seed defaults + get-or-create control state through the
  // service-role admin client (the control-plane tables are couple-RLS / secret;
  // these helpers bypass RLS and the gate above is the authorization boundary).
  const admin = createAdminClient();
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

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio/panood/setup`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood setup
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

      <PanoodControlRoom
        eventId={eventId}
        cameras={cameras}
        screens={screens}
        moments={moments}
        controlState={controlState}
      />
    </section>
  );
}

/**
 * Read-side control-room membership check (mirrors the action-side
 * requireControlRoomMembership): a moderator (accepted, not removed — covers the
 * couple AND a coordinator added as a moderator) OR legacy couple membership.
 */
async function requireControlRoomMember(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return true;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return legacy?.member_type === 'couple';
}

/**
 * Honest upsell for an event that doesn't own the paid multicam controller. The
 * FREE single-cam livestream stays on ./setup — we point there, not at a dead
 * end. No fake controls.
 */
function UpsellState({ eventId, eventName }: { eventId: string; eventName: string }) {
  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio/panood`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Panood
      </Link>

      <div className="sn-tile p-6 text-center sm:p-8">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10">
          <Lock aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          The multicam control room is a premium upgrade
        </h1>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
          {eventName} can already go live for free with a single camera straight to
          YouTube. The multicam control room adds the part that makes it feel like a
          real broadcast: switch between several cameras, fire one-tap moments (the
          Kiss, First Dance, Speeches), and route what plays on every screen at the
          venue.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link
            href={`/dashboard/${eventId}/studio/panood`}
            className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream hover:opacity-90"
          >
            <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
            See the upgrade
          </Link>
          <Link
            href={`/dashboard/${eventId}/studio/panood/setup`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 hover:bg-ink/5"
          >
            Use the free single-camera livestream
          </Link>
        </div>
      </div>
    </section>
  );
}
