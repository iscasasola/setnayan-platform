import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';
import { fetchEventPapicWindow } from '@/lib/papic-limited';
import { resolvePointsGate, type PointsGateVerdict } from '@/lib/papic-cameras';

/**
 * apps/web/lib/papic-guest-own-camera.ts
 *
 * A GUEST WHO ARRIVED THROUGH THE EVENT SITE BUYING THEIR OWN SHOTS.
 *
 * PR #4054 let a guest buy shots for the camera they hold — but only a SEAT can
 * hold a dedicated balance (`papic_event_point_grants.seat_id`), and the event
 * site's camera (/papic/guest) identifies its shooter by a signed cookie
 * (`guest_id`), often with no auth user at all. So the guest the owner actually
 * asked about — the one on the free shared pool — still could not buy.
 *
 * ── WHY THERE IS NO NEW SCHEMA HERE ────────────────────────────────────────
 * `paparazzi_seats.guest_id` ALREADY EXISTS (migration 20270305788856, the
 * Limited guest-camera work), with a unique index enforcing at most one active
 * camera per guest, and roll seats already run with `claimer_user_id` NULL —
 * a guest's camera is credentialed by their personal QR, not by an auth uid.
 * So "give this guest a camera of their own" is an INSERT into a shape the
 * product already has, and every downstream part then works untouched:
 *
 *   • `papic_one_orders.seat_id` → `grantPapicCameraPoints` grants seat-scoped
 *     points on approval. No activation change at all.
 *   • `papic_event_pool_status` sums only `seat_id IS NULL`, so what the guest
 *     bought never inflates the host's visible pool.
 *   • `papic_reserve_event_points_for_seat` returns -1 while the seat has
 *     dedicated points, so the pool stands down and the host is never billed
 *     for a shot the guest paid for.
 *
 * ── THE TIER, AND THE REGRESSION IT AVOIDS ────────────────────────────────
 * Minted as `tier = 'unlimited'` — the ONLY tier whose `points_per_day` is NULL.
 * `papic_reserve_camera_points` spends a dedicated balance first and falls
 * through to the tier's DAILY budget once it is gone; every other tier caps at
 * 20/day (70 for ltd). The event-site camera has no daily cap today, so minting
 * at any other tier would mean a guest who PAID ended up more limited than one
 * who did not, starting the day their bought shots ran out.
 */

/** A guest's own camera, and what it still holds. */
export type GuestOwnCamera = {
  seatId: string;
  /** Points bought for this camera and not yet spent-out. 0 = draws the pool. */
  dedicated: number;
};

/**
 * This guest's active camera, if they have one — plus its dedicated balance.
 *
 * Reads, never writes: the capture path calls this on EVERY shot, and a read
 * that could mint would turn a hot path into a writer. Minting happens once, at
 * purchase.
 *
 * Returns null on anything unexpected. A guest whose camera cannot be read
 * falls back to the shared pool, which is exactly where they were before they
 * bought anything — degraded, never broken.
 */
export async function resolveGuestOwnCamera(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestOwnCamera | null> {
  if (!eventId || !guestId) return null;
  try {
    const { data, error } = await admin
      .from('paparazzi_seats')
      .select('seat_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('revoked_at', null)
      .maybeSingle();
    if (error || !data?.seat_id) return null;
    const seatId = String(data.seat_id);

    const { data: ded, error: dedErr } = await admin.rpc('papic_seat_dedicated_points', {
      p_seat_id: seatId,
    });
    if (dedErr) return null;
    const n = Number(ded);
    return { seatId, dedicated: Number.isFinite(n) && n > 0 ? n : 0 };
  } catch {
    return null;
  }
}

/**
 * Resolve-or-mint this guest's own camera, for a purchase to attach points to.
 *
 * REUSES an existing active camera rather than minting a second — the guest may
 * already have one from a host-bought Limited purchase, and
 * `paparazzi_seats_one_active_camera_per_guest` would reject the duplicate
 * anyway. Reusing is also what the buyer means: "more shots for MY camera".
 *
 * ⚠ Admin client (bypasses RLS). The caller must have resolved `guestId` from
 * the buyer's OWN credential — never from a form field — before calling.
 */
export async function ensureGuestOwnCameraAdmin(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
  skuCode: string,
): Promise<string | null> {
  if (!eventId || !guestId || !skuCode) return null;
  try {
    const existing = await resolveGuestOwnCamera(admin, eventId, guestId);
    if (existing) return existing.seatId;

    // Next free index in the per-camera range (>= 200) — the same range and the
    // same allocation the Limited sync uses, so the two cannot collide.
    const { data: maxRow } = await admin
      .from('paparazzi_seats')
      .select('seat_index')
      .eq('event_id', eventId)
      .gte('seat_index', 200)
      .order('seat_index', { ascending: false })
      .limit(1);
    const nextIndex = ((maxRow?.[0]?.seat_index as number | undefined) ?? 199) + 1;

    // Same capture window as every other camera on the event, so the guest's
    // own camera opens and closes with the party rather than outliving it.
    const win = await fetchEventPapicWindow(admin, eventId);

    const { data, error } = await admin
      .from('paparazzi_seats')
      .insert({
        event_id: eventId,
        seat_index: nextIndex,
        sku_code: skuCode,
        // See the docblock: the ONLY tier with a NULL daily budget. Any other
        // tier would cap a paying guest at 20/day the moment their bought
        // shots ran out — worse than never having bought.
        tier: 'unlimited',
        guest_id: guestId,
        claim_qr_token: generateSeatClaimToken(),
        valid_from: win.startIso,
        valid_until: win.endIso,
      })
      .select('seat_id')
      .maybeSingle();
    // A unique-index conflict means somebody else minted it between the read
    // and the insert — re-read rather than fail, so a double-tap buys once.
    if (error || !data?.seat_id) {
      const raced = await resolveGuestOwnCamera(admin, eventId, guestId);
      return raced?.seatId ?? null;
    }
    return String(data.seat_id);
  } catch {
    return null;
  }
}

export type GuestCaptureReserve = {
  outcome: PointsGateVerdict;
  /** Points booked against the camera's OWN balance — release on abort. */
  seatBooked: boolean;
  /** Points booked against the SHARED pool — release on abort. */
  poolBooked: boolean;
};

/**
 * Reserve one capture against the guest's OWN camera, then the shared pool.
 *
 * Mirrors the seat path (app/papic/actions.ts) exactly, and for the same reason:
 * the two ledgers must be booked and unwound as a pair or a refused capture
 * leaves points spent.
 *
 *   1. `papic_reserve_camera_points` spends the bought balance.
 *   2. `papic_reserve_event_points_for_seat` returns -1 while that balance
 *      lasts — the pool stands down, so one photo is never paid for twice.
 *
 * ⚠ ONLY call this for a camera that HOLDS a dedicated balance. On a camera
 * with none, step 1 falls through to the tier's daily budget — a cap the
 * event-site camera has never had. Callers gate on `dedicated > 0`, which also
 * makes this whole path invisible to every guest who has not bought anything.
 *
 * Fail-CLOSED on any RPC error except function-not-found, matching both sibling
 * paths: metering is money logic, so an outage must block rather than un-meter.
 */
export async function reserveGuestOwnCameraCapture(
  admin: SupabaseClient,
  eventId: string,
  seatId: string,
  cost: number,
): Promise<GuestCaptureReserve> {
  let seatOutcome: PointsGateVerdict = 'allow';
  let seatBooked = false;
  try {
    const { data, error } = await admin.rpc('papic_reserve_camera_points', {
      p_seat_id: seatId,
      p_event_id: eventId,
      p_cost: cost,
    });
    seatOutcome = resolvePointsGate(
      error ? (error.code ?? 'unknown') : null,
      data === true ? true : data === false ? false : null,
    );
    seatBooked = data === true;
  } catch {
    seatOutcome = 'blocked'; // thrown ≠ identifiable fn-not-found → fail-CLOSED
  }
  if (seatOutcome !== 'allow') {
    return { outcome: seatOutcome, seatBooked, poolBooked: false };
  }

  let poolOutcome: PointsGateVerdict = 'allow';
  let poolBooked = false;
  try {
    const { data, error } = await admin.rpc('papic_reserve_event_points_for_seat', {
      p_event_id: eventId,
      p_seat_id: seatId,
      p_cost: cost,
    });
    // TRI-STATE, and the distinction is load-bearing: 1 = booked · 0 = refused ·
    // -1 = dedicated, nothing booked. Collapsing -1 into "booked" would refund
    // the host's pool on every aborted upload from a camera that never charged
    // it. See the RPC's own comment in migration 20271019231590.
    const n = Number(data);
    poolOutcome = resolvePointsGate(
      error ? (error.code ?? 'unknown') : null,
      n === 1 || n === -1 ? true : n === 0 ? false : null,
    );
    poolBooked = n === 1;
  } catch {
    poolOutcome = 'blocked';
  }

  // ── ALL-OR-NOTHING (the leak this closes) ────────────────────────────────
  // The seat leg can succeed and the pool leg then fail — a dedicated camera
  // normally gets -1 back, but an RPC error is 'blocked', and a balance that
  // hit zero between the two calls gets a real refusal. The caller returns 409
  // or 503 on that and never reaches its unwind, so the guest's PAID shot would
  // burn for a photo that was refused. Release it here and report nothing
  // booked, so this function's contract is "both ledgers or neither".
  if (poolOutcome !== 'allow' && seatBooked) {
    try {
      await admin.rpc('papic_release_camera_points', {
        p_seat_id: seatId,
        p_cost: cost,
      });
    } catch {
      // Best-effort, never fatal: a failed unwind costs the guest points, a
      // throw here costs them the camera.
    }
    return { outcome: poolOutcome, seatBooked: false, poolBooked: false };
  }

  return { outcome: poolOutcome, seatBooked, poolBooked };
}
