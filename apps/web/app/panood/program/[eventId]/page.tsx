import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isLiveStudioSetupHost,
  requirePanoodControlRoomMember,
} from '@/lib/panood-control-room-access';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  canPublishMultiCam,
  decideProgramAir,
  type ProgramAirDecision,
  type ProgramChannel,
} from '@/lib/live-studio-publish';
import {
  fetchChannelCameras,
  resolveChannelStatus,
  type ChannelCameraView,
} from '@/lib/live-studio-channel-cameras';
import {
  fetchOverlaySettings,
  resolveOverlays,
  type ResolvedOverlays,
} from '@/lib/live-studio-overlays';
import { deriveMonogram } from '@/lib/monogram';
import { PanoodProgramSurface } from './program-surface';

export const metadata = {
  title: 'Program output',
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
// deliberately NO paid gate on ACCESS: the free tier needs the pop-out too, to confirm the OBS
// capture works before the day.
//
// ── ⭐ WAVE 5 · WHAT IS GATED IS THE PICTURE, NOT THE DOOR ───────────────────────────────────
// This window is the one publication path Setnayan does not own: the host's encoder captures it
// and streams it to the host's own YouTube. Wave 3's paywall (lib/live-studio-publish.ts) reduces
// the SETNAYAN-HOSTED guest view — a manifest we write, on a page we render — and has no reach
// here at all. So without a second gate, "rehearse free" would mean "broadcast free via OBS": a
// free host cuts between eight cameras, OBS captures the result, and the ₱3,000 multi-cam product
// goes out for nothing.
//
// So the SOURCE is reduced instead of the manifest. `decideProgramAir` resolves, SERVER-SIDE and
// from `orders` (which a host cannot forge — orders_insert/update_status_guard, migration
// 20270920010000), which slots this event may put on air: every bound camera for an entitled host,
// exactly ONE — their ★ default channel, cut-blind — for a free one. The surface then refuses to
// paint anything else.
//
// This does NOT trust the opener. The controller applies the same decision when it chooses what to
// publish onto the bridge, but that half runs in the host's own browser holding their own cameras'
// streams, so it is advisory by nature; THIS is the enforcement point. Two points, one helper.
//
// Only under NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED. With the flag off `air` is null, the surface
// behaves byte-for-byte as today, and the live legacy Cast product is untouched.

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

  // WAVE 5: the unified controller opens this window, and its own host gate accepts
  // one membership shape more than the legacy control room's does — a legacy
  // `event_members.member_type = 'coordinator'`, who can already read and write the
  // channels under their own RLS. A pop-out stricter than the screen that opened it
  // would bounce a coordinator off the surface their own controller just launched, so
  // this accepts EITHER predicate, and the wider one only while the flag is on.
  const isMember =
    (await requirePanoodControlRoomMember(eventId, user.id)) ||
    (liveStudioRoamEnabled() && (await isLiveStudioSetupHost(eventId, user.id)));
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
  let air: ProgramAirDecision | null = null;
  const monogramText = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  if (liveStudioRoamEnabled()) {
    // ONE entitlement resolution, feeding BOTH the branding and the paywall, so the
    // two can never disagree about whether this event is paid.
    //
    // SERVICE-ROLE, deliberately: `orders` RLS is purchaser-scoped, so a coordinator
    // running the encoder for a couple who paid would read "not owned" under their own
    // session and be silently downgraded to one camera and a Setnayan bar — mid-wedding,
    // on a day that cannot be re-run. Membership was verified immediately above, and
    // canPublishMultiCam fails CLOSED on any error.
    const admin = createAdminClient();
    const owned = await canPublishMultiCam(admin, eventId);

    // `owned` decides free-vs-paid branding: a free stream gets the permanent
    // "POWERED BY SETNAYAN" lower third, a paid one gets the couple's own. Derived,
    // never stored — there is no setting a free host can flip.
    const settings = await fetchOverlaySettings(supabase, eventId);
    overlays = resolveOverlays({ owned, settings, monogramText });
    qrSrc = event.slug ? `/api/website/qr/${encodeURIComponent(event.slug)}` : null;

    // ── THE PROGRAM-OUTPUT PAYWALL. Channels + their bound cameras, read with the
    // service role (zones RLS is couple/coordinator and does not cover a moderator,
    // who is a legitimate operator here — the same reasoning the unified controller
    // states for this read), gated by the host check above.
    //
    // A pre-migration or channel-less event resolves to an empty channel list, which
    // makes `permittedSlots` empty and `enforced` true for a free host. That is the
    // right default for a Live Studio event — but it would also catch a pure LEGACY
    // Cast event that has no channels at all, whose control room is a different,
    // shipped product. So the gate is skipped entirely when this event has no Live
    // Studio channels: there is no unified broadcast to gate, and the legacy path
    // keeps its own paywall (lib/panood-watermark.ts) exactly as it is today.
    const channels = await fetchProgramChannels(admin, eventId).catch(() => []);
    if (channels.length > 0) {
      air = decideProgramAir({ owned, channels });
    }
  }

  return (
    <PanoodProgramSurface
      overlays={overlays}
      qrSrc={qrSrc}
      lowerThirdFallback={monogramText}
      air={air}
    />
  );
}

/**
 * The event's Live Studio channels, in the shape the program gate reads.
 *
 * Reuses Wave 4's binding + status resolution verbatim (`fetchChannelCameras`,
 * `resolveChannelStatus`) rather than re-deriving either: "which camera is on this
 * channel" and "is it actually alive" must have one answer across the controller and
 * this surface, or the pinned free channel here could be a camera the controller says
 * is dead.
 *
 * Returns [] on a pre-bootstrap database — the caller reads that as "no unified
 * broadcast to gate", which is the truth on such an environment.
 */
async function fetchProgramChannels(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<ProgramChannel[]> {
  const { data, error } = await admin
    .from('live_studio_roam_zones')
    .select('id, zone_index, is_featured, is_main_stage, status, camera_operator_id')
    .eq('event_id', eventId)
    .order('zone_index', { ascending: true });
  // Missing table/column (42P01/42703) → nothing to gate, same posture as the rest of
  // the Live Studio reads.
  if (error || !data) return [];

  const zones = data as {
    id: number;
    is_featured: boolean;
    is_main_stage: boolean;
    status: string | null;
    camera_operator_id: number | null;
  }[];
  if (zones.length === 0) return [];

  // `appUrl: ''` on purpose. That argument exists only to build the join link a QR
  // encodes, and this surface has no QR and no business holding one: the link embeds
  // `claim_qr_token`, a seat-hijack credential. Nothing below reads `claimUrl`, and
  // `ProgramChannel` has no field that could carry it toward the client.
  const cameras = await fetchChannelCameras(admin, eventId, zones, '').catch(
    () => new Map<number, ChannelCameraView>(),
  );

  return zones.map((z) => {
    const camera = cameras.get(z.id) ?? null;
    return {
      slot: camera?.slot ?? null,
      featured: Boolean(z.is_featured),
      mainStage: Boolean(z.is_main_stage),
      status: resolveChannelStatus({
        status: z.status,
        lastSeenAt: camera?.lastSeenAt ?? null,
        bound: Boolean(camera),
        claimed: camera?.claimed ?? false,
      }),
    };
  });
}
