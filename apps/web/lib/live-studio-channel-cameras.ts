import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCameraClaimToken, panoodCameraClaimUrl } from '@/lib/panood-camera-seats-pure';
import type { RoamZoneStatus } from '@/lib/live-studio-roam';

/**
 * apps/web/lib/live-studio-channel-cameras.ts
 *
 * ⭐ WAVE 4 — THE QR CAMERA-JOIN, wired to Live Studio CHANNELS.
 * (Live_Studio_Unified_Spec_2026-07-25.md §§ 4b/4c/4d · migration
 * 20271003100000_live_studio_channel_camera_join.sql.)
 *
 * ── THE GAP ────────────────────────────────────────────────────────────────
 * `live_studio_roam_zones.camera_operator_id` had ZERO writers and
 * `live_studio_roam_zones.status` never left its `'planned'` insert default, so a
 * host could name channels all day and no phone could ever join one. Wave 3 wrote
 * the honest UI for that (`channelReadyCaption` → "Waiting for a camera"); this
 * module is what makes those captions true.
 *
 * ── REUSE, NOT REINVENTION ─────────────────────────────────────────────────
 * There is no new auth mechanism here. A channel gets joined by binding it to a
 * SEAT in the already-shipped, already-proven claim stack:
 *
 *   panood_camera_operators  · one row per seat, unguessable UNIQUE claim token
 *   panood_claim_camera()    · SECURITY DEFINER claim RPC (race-safe, idempotent)
 *   /panood/cam/[token]      · the login-free, install-free join page
 *   publishPanoodCamera()    · the phone's WebRTC publisher (lib/panood-webrtc.ts)
 *   panood_rtc_can_access()  · the private signaling channel's RLS predicate
 *
 * This module allocates + binds the seat, reads the joined state back for the
 * controller, and resolves the channel's honest status. Everything else already
 * existed.
 *
 * ── WHY THE ADMIN CLIENT ───────────────────────────────────────────────────
 * `panood_camera_operators` RLS is control-room-only via
 * `event_members.member_type IN ('couple','coordinator')` — which does NOT cover a
 * moderator, and moderators are legitimate Live Studio hosts. The shipped
 * `/studio/panood/cameras` page already resolves this the same way: verify the
 * caller is a control-room member FIRST, then use the service-role client for the
 * seat rows. Every function here that takes an `admin` client assumes that
 * verification has already happened in the caller.
 *
 * ⚠ `claim_qr_token` IS A SEAT-HIJACK CREDENTIAL. It must never cross a
 * `'use client'` boundary or land in an RSC payload. `ChannelCameraView` therefore
 * carries the fully-built claim URL (what the QR encodes, what the host copies)
 * and NOT the raw token — the same posture the shipped cameras page states in its
 * own header comment.
 */

/**
 * How often a joined phone stamps its heartbeat. 20s is frequent enough that a
 * host sees a camera drop inside the staleness window below, and cheap enough
 * that eight phones cost eight requests a minute.
 */
export const CHANNEL_HEARTBEAT_MS = 20_000;

/**
 * How long a channel may go without a heartbeat before it reads as "dropped out".
 *
 * 60 seconds — deliberately 3× the beat. One missed beat on a church's bad wifi
 * must not blink a working camera to "dropped out" (an operator who runs to fix a
 * camera that was never broken is a real cost on the day), and a genuinely dead
 * camera must not stay green for minutes. MUST match the `INTERVAL '60 seconds'`
 * in the heartbeat RPC's sweep — the two are the same rule seen from the read side
 * and the write side.
 */
export const CHANNEL_STALE_MS = 60_000;

/**
 * The WebRTC slot key a camera publishes on.
 *
 * ONE definition, shared by the phone (panood-camera-publish.tsx) and the host's
 * viewer (the controller's feed provider). It used to be an inline template
 * literal on the phone side only, which was fine while nothing else needed to
 * name a slot — the moment the controller has to map a slot back to a channel,
 * two independent spellings of the same key is a silent black tile.
 */
export function cameraSlotForIndex(cameraIndex: number): string {
  return `cam${cameraIndex}`;
}

/**
 * THE HONEST STATUS of a channel, resolved at READ time.
 *
 * The stored `live_studio_roam_zones.status` records the last transition anyone
 * OBSERVED. This applies the timeout to it, because the one transition nobody can
 * observe is a phone leaving: a browser that is closed, backgrounded past the
 * point of execution, or carried out of signal sends no goodbye. Waiting for a
 * write that will never arrive is exactly how a controller ends up showing "Camera
 * connected" over a camera that left ten minutes ago.
 *
 * So: a stored 'live' whose last heartbeat is older than CHANNEL_STALE_MS reads as
 * 'offline'. Nothing else is second-guessed — 'disabled' is the host's own
 * decision and 'planned' is the honest state of a channel nobody has joined.
 *
 * Pure, so the controller, the RPC's sweep and the unit tests cannot drift.
 */
export function resolveChannelStatus(input: {
  /** The stored live_studio_roam_zones.status. */
  status: string | null;
  /** The bound seat's last heartbeat (ISO string), or null if it never beat. */
  lastSeenAt: string | null;
  /** Is a seat bound to this channel at all? An unbound channel is always 'planned'. */
  bound?: boolean;
  /**
   * Has a phone actually CLAIMED the bound seat?
   *
   * Not redundant with `bound`, and the gap between them is a real leak path: the
   * LEGACY Cast cameras page (/studio/panood/cameras) lists the same seats and has
   * its own Reissue control, which clears `claimer_user_id` WITHOUT knowing this
   * channel exists. That leaves a zone row saying 'live' with a recent
   * `last_seen_at` and nobody holding the camera. Without this input the controller
   * would read "Camera connected" over an empty seat — the exact class of lie this
   * module exists to prevent.
   */
  claimed?: boolean;
  /** Injected for tests; defaults to now. */
  now?: Date;
}): RoamZoneStatus {
  const { status, lastSeenAt, bound = true, claimed = true } = input;

  // The host turned this channel off. Their decision outranks every signal below.
  if (status === 'disabled') return 'disabled';

  // No seat bound, or a seat nobody holds → nothing has joined, whatever the
  // column says. 'planned' ("Waiting for a camera") is the honest read of both.
  if (!bound || !claimed) return 'planned';

  if (status !== 'live') {
    // 'planned' (never joined) and 'offline' (already known dropped) are both
    // already honest — there is no timeout that could make them more true.
    return status === 'offline' ? 'offline' : 'planned';
  }

  // Stored 'live'. Believe it only while the heartbeat is fresh.
  const now = input.now ?? new Date();
  if (!lastSeenAt) return 'offline';
  const seen = Date.parse(lastSeenAt);
  if (!Number.isFinite(seen)) return 'offline';
  return now.getTime() - seen > CHANNEL_STALE_MS ? 'offline' : 'live';
}

/**
 * A channel's camera binding, as the controller needs to render it.
 *
 * Deliberately token-free — see the header note. `claimUrl` is the finished,
 * shareable link (which of course embeds the token); it is built server-side and
 * only ever handed to the QR renderer and the copy control, exactly as the shipped
 * `/studio/panood/cameras` page does.
 */
export type ChannelCameraView = {
  zoneId: number;
  cameraId: number;
  cameraIndex: number;
  /** The WebRTC slot this camera publishes on — the controller's map key. */
  slot: string;
  /** The join link the QR encodes. Null when the seat is claimed OR revoked. */
  claimUrl: string | null;
  /** A phone has claimed this seat and it has not been revoked. */
  claimed: boolean;
  /**
   * The seat was retired (its token is dead to both the claim RPC and the
   * heartbeat). Surfaced rather than hidden so the controller offers "make a new
   * QR" instead of printing a code that silently cannot work.
   */
  revoked: boolean;
  /** The seat's own last heartbeat, feeding resolveChannelStatus. */
  lastSeenAt: string | null;
};

type SeatRow = {
  id: number;
  event_id: string;
  camera_index: number;
  claim_qr_token: string;
  claimer_user_id: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  status: string;
};

/** Missing/legacy table (42P01) or column (42703) → treat as "not bootstrapped yet". */
function isPreBootstrap(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === '42703';
}

/**
 * Read every channel's camera binding for an event.
 *
 * Two queries rather than a PostgREST embed on purpose: the zones live under the
 * host's own RLS while the seats need the service role (see the header), so they
 * cannot be one joined select without leaking the seat table into a session that
 * is not allowed to read it.
 *
 * Graceful-degrade to an empty map on a pre-bootstrap database, so a controller on
 * an un-migrated environment shows "Waiting for a camera" instead of crashing —
 * the same posture as fetchPanoodCameras.
 */
export async function fetchChannelCameras(
  admin: SupabaseClient,
  eventId: string,
  zones: ReadonlyArray<{ id: number; camera_operator_id: number | null }>,
  appUrl: string,
): Promise<Map<number, ChannelCameraView>> {
  const out = new Map<number, ChannelCameraView>();
  const wanted = zones.filter((z) => z.camera_operator_id !== null);
  if (wanted.length === 0) return out;

  const { data, error } = await admin
    .from('panood_camera_operators')
    .select('id, event_id, camera_index, claim_qr_token, claimer_user_id, last_seen_at, revoked_at, status')
    .eq('event_id', eventId)
    .in('id', wanted.map((z) => z.camera_operator_id as number));
  if (error) {
    if (isPreBootstrap(error)) return out;
    throw new Error(`Failed to read Live Studio channel cameras: ${error.message}`);
  }

  const seats = new Map<number, SeatRow>();
  for (const row of (data ?? []) as SeatRow[]) seats.set(row.id, row);

  for (const zone of wanted) {
    const seat = seats.get(zone.camera_operator_id as number);
    // A binding whose seat is not on THIS event cannot happen (composite FK), and
    // the `.eq('event_id', …)` above means such a row would simply be absent here.
    // Skipping is the safe read of "no camera", never a silent cross-event render.
    if (!seat) continue;
    const revoked = Boolean(seat.revoked_at) || seat.status === 'revoked';
    const claimed = Boolean(seat.claimer_user_id) && !revoked;
    out.set(zone.id, {
      zoneId: zone.id,
      cameraId: seat.id,
      cameraIndex: seat.camera_index,
      slot: cameraSlotForIndex(seat.camera_index),
      // Two reasons to withhold the URL, and both are decided HERE rather than in
      // the view so neither can be rendered by accident:
      //   • CLAIMED — the link is a live credential that would let a second phone
      //     try the same camera. Same rule the shipped cameras page applies.
      //   • REVOKED — the token is already dead to both RPCs, so printing it would
      //     be a QR that silently cannot work. A fake door, pointed inward.
      claimUrl: claimed || revoked ? null : panoodCameraClaimUrl(appUrl, seat.claim_qr_token),
      claimed,
      revoked,
      lastSeenAt: seat.last_seen_at,
    });
  }

  return out;
}

export type BindChannelResult =
  | { ok: true; cameraId: number; created: boolean }
  | { ok: false; reason: 'already_bound' | 'zone_missing' | 'save_failed' };

/**
 * Give a channel its own camera seat — the write that creates the join QR.
 *
 * Allocates a fresh seat on this event (dense-ish `camera_index` = max + 1, the
 * same allocator shape as the zone index) with a fresh unguessable token, then
 * binds it to the zone. Idempotent by refusal, not by overwrite: a channel that
 * already has a seat returns `already_bound` rather than minting a second token,
 * because minting one would silently orphan a QR the host may already have printed
 * and handed to somebody.
 *
 * The two writes are not one transaction (PostgREST has no multi-statement txn).
 * The failure mode is chosen to be the harmless one: if the bind fails after the
 * seat insert, the result is an unbound spare seat — invisible, costless, and
 * re-used by nothing — rather than a channel pointing at a row that does not
 * exist. The composite FK guarantees the bind can only ever succeed against a seat
 * on this same event.
 */
export async function bindChannelCamera(
  admin: SupabaseClient,
  eventId: string,
  zoneId: number,
): Promise<BindChannelResult> {
  const { data: zoneRow, error: zoneError } = await admin
    .from('live_studio_roam_zones')
    .select('id, camera_operator_id')
    .eq('event_id', eventId)
    .eq('id', zoneId)
    .maybeSingle();
  if (zoneError || !zoneRow) return { ok: false, reason: 'zone_missing' };
  if ((zoneRow as { camera_operator_id: number | null }).camera_operator_id !== null) {
    return { ok: false, reason: 'already_bound' };
  }

  // Next camera_index on this event. UNIQUE (event_id, camera_index) is the hard
  // backstop if two channels are created at the same instant — the loser's insert
  // fails and the host simply taps again, which is better than a silent collision.
  const { data: existing, error: readError } = await admin
    .from('panood_camera_operators')
    .select('camera_index')
    .eq('event_id', eventId)
    .order('camera_index', { ascending: false })
    .limit(1);
  if (readError && !isPreBootstrap(readError)) return { ok: false, reason: 'save_failed' };
  const nextIndex = ((existing?.[0]?.camera_index as number | undefined) ?? 0) + 1;

  const { data: seat, error: insertError } = await admin
    .from('panood_camera_operators')
    .insert({
      event_id: eventId,
      camera_index: nextIndex,
      claim_qr_token: generateCameraClaimToken(),
    })
    .select('id')
    .maybeSingle();
  if (insertError || !seat) return { ok: false, reason: 'save_failed' };

  const cameraId = (seat as { id: number }).id;
  const { error: bindError } = await admin
    .from('live_studio_roam_zones')
    .update({ camera_operator_id: cameraId, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('id', zoneId)
    // Re-assert "still unbound" so two concurrent taps cannot both bind: the loser
    // matches zero rows and leaves the winner's seat in place.
    .is('camera_operator_id', null);
  if (bindError) return { ok: false, reason: 'save_failed' };

  return { ok: true, cameraId, created: true };
}

/**
 * Recycle a channel's camera — mint a new token, drop whoever holds the old one.
 *
 * The host's remedy when the wrong person scanned, a phone is lost, or an operator
 * has to be swapped mid-reception. Reuses the shipped `reissuePanoodCameraToken`
 * semantics (new token · clear the binding · back to 'open') and additionally
 * resets the CHANNEL to 'planned', because the truthful state of a channel whose
 * operator was just cut loose is "waiting for a camera", not "connected".
 *
 * The old QR dies instantly: `panood_claim_camera` and `panood_camera_heartbeat`
 * both resolve a token to a row, and the row no longer carries that token.
 */
export async function reissueChannelCamera(
  admin: SupabaseClient,
  eventId: string,
  zoneId: number,
): Promise<boolean> {
  const { data: zoneRow } = await admin
    .from('live_studio_roam_zones')
    .select('camera_operator_id')
    .eq('event_id', eventId)
    .eq('id', zoneId)
    .maybeSingle();
  const cameraId = (zoneRow as { camera_operator_id: number | null } | null)?.camera_operator_id;
  if (!cameraId) return false;

  const { error } = await admin
    .from('panood_camera_operators')
    .update({
      claim_qr_token: generateCameraClaimToken(),
      claimer_user_id: null,
      claimed_at: null,
      last_seen_at: null,
      revoked_at: null,
      status: 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cameraId)
    // Event-scoped: a zone id from this event can only reach a seat on this event.
    .eq('event_id', eventId);
  if (error) return false;

  await admin
    .from('live_studio_roam_zones')
    .update({ status: 'planned', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('id', zoneId);

  return true;
}

/**
 * Kill a channel's join link for good — used when the CHANNEL itself is deleted.
 *
 * Deleting a channel must not leave its QR alive: a printed card in somebody's
 * pocket would still mint an anonymous session and claim a seat that now feeds
 * nothing. Revoking (rather than deleting the seat) matches how the rest of this
 * stack retires a credential, and `panood_claim_camera` already reads a revoked
 * seat as 'invalid'.
 *
 * Best-effort: a failure here must never block the delete the host asked for.
 */
export async function revokeChannelCamera(
  admin: SupabaseClient,
  eventId: string,
  cameraId: number | null,
): Promise<void> {
  if (!cameraId) return;
  try {
    await admin
      .from('panood_camera_operators')
      .update({
        revoked_at: new Date().toISOString(),
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cameraId)
      .eq('event_id', eventId);
  } catch {
    /* best-effort — the channel delete is what the host asked for */
  }
}
