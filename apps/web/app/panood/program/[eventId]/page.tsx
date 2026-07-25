import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  fetchOverlaySettings,
  resolveOverlays,
  type ResolvedOverlays,
} from '@/lib/live-studio-overlays';
import { deriveMonogram } from '@/lib/monogram';
import { PanoodProgramSurface } from './program-surface';

export const metadata = {
  title: 'Program output · Setnayan',
  // A capture surface, never a page anyone should reach from search.
  robots: { index: false, follow: false },
};

// Live Studio — the chrome-less PROGRAM OUTPUT pop-out that OBS window-captures.
//
// ── WHY THIS LIVES OUTSIDE /dashboard ───────────────────────────────────────────────────────
// It used to sit at /dashboard/[eventId]/studio/panood/broadcast/program and render a
// `fixed inset-0` layer to cover the dashboard chrome. That silently rendered NOTHING.
//
// The shell's content `<main>` carries `.sn-vt-page` → `view-transition-name: sn-page`. A named
// view-transition element establishes containment, which makes it the CONTAINING BLOCK for
// `position: fixed` descendants. Since this page returned only the fixed layer, that <main> had
// no content height — so `inset-0` resolved against a zero-height box and the surface collapsed.
// The operator saw the dashboard with an empty middle.
//
// Covering chrome with a z-index was the wrong instinct anyway: OBS captures the WINDOW, so any
// chrome in the tree is one layout change away from leaking into the couple's broadcast. A
// top-level route under /panood inherits only the root layout — no sidebar, no top bar, no view
// transitions, nothing to escape from.
//
// Gating is unchanged and matches the control room: signed in → control-room member. There is
// deliberately NO paid gate: the free tier needs the pop-out too, to confirm the OBS capture
// works before the day. It renders WITH the SETNAYAN overlay, like every other surface, so it
// never becomes a softer door to a clean feed.

type Props = { params: Promise<{ eventId: string }> };

export default async function PanoodProgramOutputPage({ params }: Props) {
  const { eventId } = await params;
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

  const isMember = await requirePanoodControlRoomMember(eventId, user.id);
  if (!isMember) redirect(`/dashboard/${eventId}`);

  // ── WAVE 2 · broadcast overlays (Live Studio · owner-locked 2026-07-25).
  //
  // THIS is the real compositing point: OBS captures this window, so a DOM layer
  // here is genuinely in the couple's broadcast — the same route the SETNAYAN
  // paywall overlay already takes. Resolved HERE, server-side, and handed down
  // already-decided so the client surface can never re-derive a paid decision.
  //
  // Flag-dark: nothing is drawn until NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is on,
  // so today's Cast broadcasts are byte-for-byte unchanged.
  let overlays: ResolvedOverlays | null = null;
  let qrSrc: string | null = null;
  const monogramText = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  if (liveStudioRoamEnabled()) {
    // `owned` decides free-vs-paid: a free stream gets the permanent
    // "POWERED BY SETNAYAN" lower third, a paid one gets the couple's own. Any
    // lookup failure resolves to the free branch — branded, never a paid leak.
    const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU).catch(() => false);
    const settings = await fetchOverlaySettings(supabase, eventId);
    overlays = resolveOverlays({ owned, settings, monogramText });
    qrSrc = event.slug ? `/api/website/qr/${encodeURIComponent(event.slug)}` : null;
  }

  return (
    <PanoodProgramSurface
      overlays={overlays}
      qrSrc={qrSrc}
      lowerThirdFallback={monogramText}
    />
  );
}
