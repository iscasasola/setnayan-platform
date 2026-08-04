'use server';

/**
 * Live Studio · guest-pick session + ICE (Wave 10, 2026-07-26).
 *
 * A wedding guest tapping a side camera needs two things the browser cannot mint for
 * itself:
 *
 *   1. A SUPABASE SESSION. The guest signaling topic (`panood-guest:{eventId}`) is a
 *      PRIVATE Realtime channel, so `auth.uid()` must be non-null. Most guests arrive
 *      at a public event page with no account at all, so — exactly as a camera
 *      operator does at claim time — we mint a NATIVE ANONYMOUS session, and only
 *      after confirming this event genuinely has guest-pick to offer.
 *   2. ICE SERVERS. Public STUN cannot traverse the symmetric NAT / CGNAT that is the
 *      norm on Philippine mobile data, so a short-lived Cloudflare TURN relay is
 *      minted server-side (the API token never reaches the browser).
 *
 * ⚠ THIS IS DELIBERATELY LAZY — it runs on TAP, never on page load. Anonymous
 * sign-in creates a real auth row, so minting one for every visitor who merely
 * *sees* the event page would be an unbounded footprint for no benefit. Only a guest
 * who actually chooses a side camera gets a session.
 *
 * ⚠ AND IT DELIBERATELY DOES NOT USE `allowAnonMint`. That throttle is 5 mints per IP
 * per 24 h, which is correct for onboarding-draft abuse and WRONG here: a wedding
 * reception shares one venue NAT, so the sixth guest to tap a camera would be
 * refused for no reason. The bound here is the viewer cap itself.
 *
 * ⚠ THE PAYWALL. `canPublishMultiCam` is re-asked here, with the admin client, on the
 * same footing as the public-page loader. It is the SAME single rule (§ 4d "rehearse
 * free, pay to broadcast"), not a second one — this call site exists so the TURN
 * mint and the session mint are not an open faucet for an un-entitled event that
 * hand-crafted a request.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mintTurnIceServers } from '@/lib/turn';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { panoodStreamingEnabled } from '@/lib/panood-camera-seats';
import { canPublishMultiCam } from '@/lib/live-studio-publish';

export type GuestPickSessionResult = {
  ok: boolean;
  iceServers: RTCIceServer[];
};

const REFUSED: GuestPickSessionResult = { ok: false, iceServers: [] };

export async function startGuestPickSession(
  eventId: string,
): Promise<GuestPickSessionResult> {
  // Flag-dark by construction: with either flag off this returns `ok:false` and the
  // guest player never mounts a connection, so the public page behaves exactly as it
  // does today.
  if (!liveStudioRoamEnabled() || !panoodStreamingEnabled()) return REFUSED;

  const clean = typeof eventId === 'string' ? eventId.trim() : '';
  if (!clean) return REFUSED;

  const admin = createAdminClient();

  // The event must exist, and its host must have guest-pick switched ON. Admin read:
  // `events` RLS is membership-scoped and the caller is a wedding guest.
  const { data: event } = await admin
    .from('events')
    .select('event_id, live_studio_guest_pick_enabled')
    .eq('event_id', clean)
    .maybeSingle();
  if (!event) return REFUSED;
  if ((event as { live_studio_guest_pick_enabled?: boolean }).live_studio_guest_pick_enabled !== true) {
    return REFUSED;
  }

  // ⭐ THE ONE PAYWALL RULE. Fail-closed inside canPublishMultiCam — any error is
  // `false`, so a lookup failure withholds a paid capability rather than granting it.
  const entitled = await canPublishMultiCam(admin, clean);
  if (!entitled) return REFUSED;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    // A project with captcha enforced on anonymous sign-in will refuse here. That is
    // a graceful degradation, not a bug: the guest simply stays on the director's
    // cut, which is on YouTube and unlimited.
    if (error || !anon.user) return REFUSED;
  }

  // STUN first, then any minted TURN — same shape as getPanoodIceServers. STUN alone
  // connects on most networks and costs nothing; TURN is the paid fallback that makes
  // a hard-NAT guest reachable at all. An unconfigured or erroring TURN returns [] and
  // this degrades to STUN-only rather than failing.
  const stun: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  return { ok: true, iceServers: [...stun, ...(await mintTurnIceServers())] };
}
