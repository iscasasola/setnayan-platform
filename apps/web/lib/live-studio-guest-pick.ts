/**
 * Live Studio · GUEST-PICK AT ₱0 — the pure core (Wave 10, owner-decided 2026-07-26).
 *
 * THE MODEL. The director's cut (CH 1) goes OBS → YouTube: permanent archive,
 * unlimited viewers, ₱0. Side cameras are live-viewing only — nothing is archived —
 * so they never need a YouTube broadcast of their own (which would need a
 * WebRTC→RTMP relay, N stream keys and N OAuth grants). Instead a guest who taps a
 * side camera opens a plain peer-to-peer WebRTC connection **straight to that
 * operator's phone** — the same transport as the 1:1 chat call, which is free.
 *
 * ⚠ THE CONSTRAINT THAT SHAPES EVERYTHING: WebRTC does not fan out. The phone must
 * upload ONE COPY PER VIEWER, on top of the copy it already sends the host. So
 * unlike YouTube, guest-pick has a hard ceiling — and the ceiling is not politeness,
 * it is THE DIRECTOR'S CUT. See GUEST_PICK_MAX_VIEWERS_PER_CAMERA below.
 *
 * This module is deliberately DEPENDENCY-FREE of the browser (no RTCPeerConnection,
 * no Supabase browser client) so the admission arithmetic is unit-testable on its
 * own. The transport that uses it lives in `lib/panood-guest-webrtc.ts`.
 *
 * THE PAYWALL IS NOT HERE, ON PURPOSE. Whether an event may show guests any side
 * camera at all is decided by `canPublishMultiCam` in the public-page loader
 * (app/[slug]/_lib/loaders.ts) — the SAME single rule that reduces the YouTube
 * manifest. Enforced by omission: an un-entitled event's roster is [], so the
 * browser is never told a side camera exists and never opens a channel. Do NOT add
 * a second entitlement rule in here; Wave 3/5 deliberately keep one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { cameraSlotForIndex } from '@/lib/live-studio-channel-cameras';

/**
 * ⭐ THE CAP — how many guests may watch ONE side camera at the same time.
 *
 * WHY 3, and why this number is load-bearing rather than cosmetic:
 *
 * The operator's phone is already spending roughly **1.5 Mbps** publishing 1080p30
 * to the host's controller. That upload is the paid product — it is what the host
 * cuts onto CH 1 and what reaches YouTube. Every guest viewer costs the SAME phone
 * another ~0.6 Mbps (GUEST_PICK_MAX_BITRATE_BPS below), because WebRTC sends one
 * encoded copy per peer:
 *
 *     1 viewer  → ~2.1 Mbps      3 viewers → ~3.3 Mbps   ← the cap
 *     2 viewers → ~2.7 Mbps      5 viewers → ~4.5 Mbps   ← optimistic on PH mobile data
 *
 * A venue full of guests all sharing one cell is the WORST case for uplink, and
 * that is exactly when this runs. If the uplink saturates, WebRTC's congestion
 * control does not politely drop the guests — it degrades **every** sender on that
 * phone, including the host feed. So an uncapped guest-pick would let three
 * strangers soften the couple's actual broadcast on the one day that cannot be
 * re-run.
 *
 * 3 is therefore a deliberately conservative starting point, not a measured
 * optimum: it keeps the phone under ~3.3 Mbps, leaving headroom on a typical
 * Philippine LTE uplink. TUNE IT FROM REAL MEASUREMENTS at a real venue — raising
 * it is a money-free change, but it spends the director's cut's headroom, so raise
 * it only with data. Nobody is ever locked out of the wedding by this number: a
 * refused guest lands on the director's cut, which is on YouTube and unlimited.
 */
export const GUEST_PICK_MAX_VIEWERS_PER_CAMERA = 3;

/**
 * Per-viewer bitrate ceiling for a side camera, applied with
 * `RTCRtpSender.setParameters({ encodings: [{ maxBitrate }] })`.
 *
 * A side camera is a PEEK VIEW, not the broadcast — the broadcast is CH 1 on
 * YouTube. 600 kbps at roughly 540p is comfortably watchable on a phone and keeps
 * the arithmetic above honest. Without this cap WebRTC would happily negotiate the
 * full 1080p30 encode for each guest and a single viewer would cost as much as the
 * host feed.
 */
export const GUEST_PICK_MAX_BITRATE_BPS = 600_000;

/**
 * Resolution divisor for the guest copy (1080p → 540p). Paired with the bitrate cap:
 * capping bits alone at 1080p yields a smeared picture, because the encoder keeps
 * the pixel count and throws away quality. Halving the resolution first spends those
 * 600 kbps on a picture that actually looks fine on a phone.
 */
export const GUEST_PICK_SCALE_DOWN_BY = 2;

/**
 * How long a presence entry may go unrefreshed before other clients treat the slot
 * as abandoned.
 *
 * Supabase Realtime presence already reclaims a slot when the socket closes — the
 * normal case for "guest closed the tab". This timeout covers the case presence
 * cannot see: a phone that slept or lost signal without a clean disconnect, where
 * the server may hold the entry until its own timeout. Re-tracking on an interval
 * keeps `at` fresh; anything staler than this is ignored when counting occupancy,
 * so a leaked slot heals instead of permanently shrinking the cap.
 */
export const GUEST_PICK_PRESENCE_STALE_MS = 45_000;

/** How often a watching guest re-tracks its presence entry to keep `at` fresh. */
export const GUEST_PICK_PRESENCE_HEARTBEAT_MS = 15_000;

/** Realtime topic for the guest fan-out. DELIBERATELY NOT `panood-rtc:{eventId}`. */
export function guestPickChannelName(eventId: string): string {
  return `panood-guest:${eventId}`;
}

/**
 * ⭐ THE GATE — may this event show guests any side camera at all?
 *
 * Pure, and extracted from the loader specifically so the paywall is unit-pinned
 * rather than being three words buried in a 600-line data fetch. All three inputs
 * must be true:
 *
 *   • `flagEnabled`      — NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED. Off ⇒ zero behaviour
 *                          change anywhere on the public page.
 *   • `guestPickEnabled` — the host's own switch (Wave 2). Their consent to being
 *                          watched from angles they are not directing.
 *   • `multiCamOwned`    — THE PAYWALL. The result of `canPublishMultiCam`, which is
 *                          the SAME helper that reduces the YouTube manifest one line
 *                          away in the loader (§ 4d "rehearse free, pay to
 *                          broadcast"). This function takes the ANSWER, never re-derives
 *                          it, so there is exactly one rule and it cannot drift.
 *
 * Fails closed on all three: anything unknown means no side cameras, which costs a
 * guest nothing (they keep the unlimited director's cut) and cannot give away a paid
 * capability.
 */
export function shouldOfferGuestPick(input: {
  flagEnabled: boolean;
  guestPickEnabled: boolean;
  multiCamOwned: boolean;
}): boolean {
  return input.flagEnabled && input.guestPickEnabled && input.multiCamOwned;
}

/**
 * One side camera a guest may switch to. Mirrors a `live_studio_roam_zones` row that
 * currently has a camera on it — NOT a YouTube manifest entry (a side camera has no
 * videoId, which is the entire point of this wave).
 */
export type GuestPickCamera = {
  zoneIndex: number;
  /** The WebRTC slot key — `cam{index}`, same key the controller uses on air. */
  slot: string;
  label: string;
  venueLabel: string | null;
};

/** A presence entry as tracked by a watching guest. */
export type GuestPickPresence = {
  slot: string;
  viewerId: string;
  /** ms epoch, refreshed on the heartbeat. */
  at: number;
};

/**
 * Occupancy of one slot, from a flattened presence list.
 *
 * Stale entries (older than GUEST_PICK_PRESENCE_STALE_MS) are dropped so a phone that
 * died mid-connection cannot permanently consume a slot. `now` is injected to keep
 * this pure.
 */
export function viewersOnSlot(
  entries: readonly GuestPickPresence[],
  slot: string,
  now: number,
): GuestPickPresence[] {
  const seen = new Set<string>();
  const live: GuestPickPresence[] = [];
  for (const e of entries) {
    if (e.slot !== slot) continue;
    if (!Number.isFinite(e.at) || now - e.at > GUEST_PICK_PRESENCE_STALE_MS) continue;
    // A client that re-tracks can briefly appear twice in presenceState(); count a
    // viewer once, keeping its freshest beat.
    if (seen.has(e.viewerId)) continue;
    seen.add(e.viewerId);
    live.push(e);
  }
  // Deterministic order: oldest arrival wins the slot. Ties broken on viewerId so
  // EVERY client independently computes the same admission set and they agree
  // without a coordinator.
  live.sort((a, b) => (a.at !== b.at ? a.at - b.at : a.viewerId < b.viewerId ? -1 : 1));
  return live;
}

/**
 * May `viewerId` watch `slot`? Pure, and evaluated identically on every guest's
 * browser — first-come-first-served by presence timestamp, so two guests tapping at
 * once resolve without a race.
 *
 * This is the ADVISORY half (it makes the UI honest before a connection is even
 * attempted). The phone re-decides authoritatively in `panood-guest-webrtc.ts`,
 * because the phone is the one paying the uplink and is the only party that cannot
 * be lied to.
 */
export function resolveSlotAdmission(
  entries: readonly GuestPickPresence[],
  slot: string,
  viewerId: string,
  now: number,
  max: number = GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
): 'admitted' | 'full' {
  const live = viewersOnSlot(entries, slot, now);
  const idx = live.findIndex((e) => e.viewerId === viewerId);
  // Not tracked yet → would this viewer fit if it joined now?
  if (idx === -1) return live.length < max ? 'admitted' : 'full';
  return idx < max ? 'admitted' : 'full';
}

/**
 * Phone-side authoritative admission: may one more viewer be accepted?
 *
 * `current` is the set of viewerIds this phone is ALREADY serving. Idempotent — a
 * viewer that is already connected is re-admitted (its `guest-hello` retried), which
 * must not consume a second slot.
 */
export function admitViewer(
  current: readonly string[],
  viewerId: string,
  max: number = GUEST_PICK_MAX_VIEWERS_PER_CAMERA,
): boolean {
  if (current.includes(viewerId)) return true;
  return current.length < max;
}

/**
 * Flatten a Supabase `presenceState()` map into the entry list the helpers above
 * take. Tolerant by construction: presence payloads arrive from other browsers, so
 * anything malformed is dropped rather than trusted.
 */
export function flattenGuestPresence(state: Record<string, unknown[]>): GuestPickPresence[] {
  const out: GuestPickPresence[] = [];
  for (const list of Object.values(state ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const r = raw as Partial<GuestPickPresence> | null;
      if (!r || typeof r.slot !== 'string' || !r.slot) continue;
      if (typeof r.viewerId !== 'string' || !r.viewerId) continue;
      const at = typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0;
      out.push({ slot: r.slot, viewerId: r.viewerId, at });
    }
  }
  return out;
}

type ZoneRow = {
  zone_index: number | null;
  label: string | null;
  venue_label: string | null;
  sort_order: number | null;
  camera_operator_id: number | null;
};

type OperatorRow = {
  id: number;
  camera_index: number;
  claimer_user_id: string | null;
  revoked_at: string | null;
  status: string | null;
};

/**
 * The side cameras a guest may currently switch to: zones that are LIVE and have a
 * camera actually bound to them.
 *
 * ⚠ CALLERS MUST GATE THIS ON `canPublishMultiCam` — this function deliberately does
 * NOT ask. Guest-pick is a PAID capability (§ 4d "rehearse free, pay to broadcast"),
 * and the entitlement question is answered once, in the loader, by the same helper
 * that reduces the YouTube manifest. Two rules would be two rules to drift.
 *
 * Pass an ADMIN client: `live_studio_roam_zones` RLS is control-room-only, and the
 * reader here is an anonymous wedding guest. Only non-secret columns are projected.
 */
export async function fetchGuestPickCameras(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GuestPickCamera[]> {
  const { data: zoneData, error: zoneError } = await supabase
    .from('live_studio_roam_zones')
    .select('zone_index, label, venue_label, sort_order, camera_operator_id')
    .eq('event_id', eventId)
    .eq('status', 'live')
    .order('sort_order', { ascending: true })
    .order('zone_index', { ascending: true });

  // Pre-migration / transient failure → no side cameras, never a thrown page.
  if (zoneError || !zoneData) return [];

  const zones = (zoneData as ZoneRow[]).filter(
    (z) => z.camera_operator_id != null && typeof z.zone_index === 'number',
  );
  if (zones.length === 0) return [];

  // ⚠ THE SLOT KEYS OFF THE OPERATOR, NOT THE ZONE. The WebRTC slot is
  // `cam{camera_index}` of the bound SEAT (lib/live-studio-channel-cameras.ts —
  // `slot: cameraSlotForIndex(seat.camera_index)`), and a zone's `zone_index` is a
  // different number. Deriving the slot from zone_index would silently point guests
  // at the wrong camera, or at none. Same two-step read fetchChannelCameras does,
  // and for the same reason: the two tables have different RLS.
  const { data: opData, error: opError } = await supabase
    .from('panood_camera_operators')
    .select('id, camera_index, claimer_user_id, revoked_at, status')
    .eq('event_id', eventId)
    .in('id', zones.map((z) => z.camera_operator_id as number));
  if (opError || !opData) return [];

  const seats = new Map<number, OperatorRow>();
  for (const row of opData as OperatorRow[]) seats.set(row.id, row);

  const out: GuestPickCamera[] = [];
  for (const z of zones) {
    const seat = seats.get(z.camera_operator_id as number);
    // No seat on THIS event (composite FK makes cross-event impossible, so this is
    // simply "unbound"), or a seat nobody is holding, or one whose token was pulled
    // — none of those is a camera a guest can reach. Offering it would be a pill
    // that spins forever.
    if (!seat) continue;
    if (seat.revoked_at || seat.status === 'revoked') continue;
    if (!seat.claimer_user_id) continue;
    out.push({
      zoneIndex: z.zone_index as number,
      slot: cameraSlotForIndex(seat.camera_index),
      label: z.label?.trim() || `Camera ${z.zone_index}`,
      venueLabel: z.venue_label?.trim() || null,
    });
  }
  return out;
}
