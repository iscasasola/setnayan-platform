import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';
import { fetchEventPapicWindow } from '@/lib/papic-limited';
import { resolvePointsGate, type PointsGateVerdict } from '@/lib/papic-cameras';
import { dedicatedShotsStanding, type DedicatedShotsStanding } from '@/lib/papic-guest-buy';

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
 *   • `papic_reserve_capture_split` spends what the guest BOUGHT first and asks
 *     the host's pot only for the remainder, so the host is never billed for a
 *     shot the guest paid for — and the guest is never stopped while the host
 *     still has credits.
 *
 * ⚠ THE TWO BULLETS ABOVE USED TO DESCRIBE A DIFFERENT MECHANISM and describing
 * it is all they did: a pair of calls where the pool "stood down" for any camera
 * holding dedicated points. That pair is what capped a guest at what they had
 * bought (owner 2026-08-11). Corrected here rather than left standing, because a
 * comment that outlives its behaviour is how the last gate on this codebase
 * stayed shut for seven weeks.
 *
 * ── THE TIER, AND THE REGRESSION IT AVOIDS ────────────────────────────────
 * Minted as `tier = 'unlimited'` — the ONLY tier whose `points_per_day` is NULL.
 * Every other tier caps at 20/day (70 for ltd), and the event-site camera has
 * never had a daily cap, so minting at any other tier would leave a guest who
 * PAID more limited than one who did not. The split reserve never touches the
 * per-day ledger, but the tier is still what a future path would read.
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
 * What one camera holds and has spent — the read behind spec § 7b's "give the
 * unused ones to the room". Same two reads `resolveGuestOwnCamera` already
 * makes for `dedicated` (papic_seat_dedicated_points — grants + hand-outs,
 * already GRANTed to service_role since 20271019231590), plus
 * `papic_seat_point_usage.points_used` for what is gone for good.
 *
 * DISPLAY ONLY. The release action re-derives the target itself at the moment
 * it writes, under papic_dedicate_shots' own row lock — this read is what a
 * guest sees on the button before she taps it, not what the RPC trusts.
 *
 * Returns null on anything unexpected, same degrade-to-nothing posture as
 * resolveGuestOwnCamera: a guest who cannot be shown her standing sees no
 * release offer, never a broken one.
 */
export async function resolveSeatDedicatedStanding(
  admin: SupabaseClient,
  seatId: string,
): Promise<DedicatedShotsStanding | null> {
  if (!seatId) return null;
  try {
    const [dedRes, spentRes] = await Promise.all([
      admin.rpc('papic_seat_dedicated_points', { p_seat_id: seatId }),
      admin
        .from('papic_seat_point_usage')
        .select('points_used')
        .eq('seat_id', seatId)
        .maybeSingle(),
    ]);
    if (dedRes.error) return null;
    return dedicatedShotsStanding(
      Number(dedRes.data ?? 0),
      Number((spentRes.data as { points_used?: number } | null)?.points_used ?? 0),
    );
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
  /**
   * Credits taken from the camera's OWN balance, and from the SHARED pot.
   *
   * ⚠ TWO FIGURES, NOT TWO BOOLEANS. A capture can be paid from both at once
   * (owner 2026-08-11: "spend 2 and take 6"), so an abort must put each half
   * back where it came from. Booleans could only say "release the whole cost
   * to this side", which would move credits between the guest's paid balance
   * and the host's pot.
   */
  dedicatedSpent: number;
  poolSpent: number;
};

/**
 * Reserve one capture for a guest who has a camera of their own.
 *
 * ⚠ THIS USED TO ORCHESTRATE TWO RPCs AND UNWIND THEM BY HAND — eighty lines of
 * "book the camera, book the pool, and if the second refuses release the first".
 * All of that is now one call, because the pair had a defect no amount of
 * careful sequencing could fix (owner 2026-08-11).
 *
 * The pool stood down for any camera that had EVER held bought credits rather
 * than one that had any LEFT, so a guest who spent what they paid for stopped
 * dead even with the host's pot full behind them. And the split could not be
 * decided in sequence: the first call MUTATES, so by the time the second ran, a
 * camera that had just spent its last credit was indistinguishable from one that
 * never had any.
 *
 * `papic_reserve_capture_split` does both under one row lock in one transaction:
 * the camera's own credits first, the pot for the remainder, all-or-nothing.
 * The hand-written unwind is gone with the state it existed to clean up.
 *
 * Safe to call for a camera with NO dedicated balance — it simply spends the
 * pot, which is what that guest was doing anyway. (The old version had to be
 * gated on `dedicated > 0` because its first call would otherwise fall through
 * to a per-day tier cap this surface never had.)
 *
 * Fail-CLOSED on any RPC error except function-not-found: metering is money
 * logic, so an outage must block rather than un-meter.
 */
export async function reserveGuestOwnCameraCapture(
  admin: SupabaseClient,
  eventId: string,
  seatId: string,
  cost: number,
): Promise<GuestCaptureReserve> {
  try {
    const { data, error } = await admin.rpc('papic_reserve_capture_split', {
      p_seat_id: seatId,
      p_event_id: eventId,
      p_cost: cost,
    });
    // A set-returning function arrives as an array of one row.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { ok?: unknown; dedicated_spent?: unknown; pool_spent?: unknown }
      | null
      | undefined;
    const outcome = resolvePointsGate(
      error ? (error.code ?? 'unknown') : null,
      // An indeterminate shape is fail-CLOSED, never "allowed".
      row == null ? null : row.ok === true ? true : row.ok === false ? false : null,
    );
    if (outcome !== 'allow' || row?.ok !== true) {
      return { outcome, dedicatedSpent: 0, poolSpent: 0 };
    }
    return {
      outcome,
      dedicatedSpent: Number(row.dedicated_spent) || 0,
      poolSpent: Number(row.pool_spent) || 0,
    };
  } catch {
    // thrown ≠ identifiable fn-not-found → fail-CLOSED
    return { outcome: 'blocked', dedicatedSpent: 0, poolSpent: 0 };
  }
}
