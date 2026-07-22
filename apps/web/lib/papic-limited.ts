import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PAPIC_CAMERA_ROLL_SKU,
  PAPIC_CAMERA_UNLIMITED_SKU,
  PAPIC_CAMERA_ROLL_FALLBACK_PHP,
  PAPIC_LTD_CAP_FALLBACK_PHP,
} from '@/lib/papic-cameras';
import { generateSeatClaimToken } from '@/lib/papic-seats';
import { resolveStoredWindow, type StoredWindow } from '@/lib/papic-window';

/**
 * The event's Papic capture WINDOW (owner 2026-06-26), graceful pre-migration.
 * Returns the validity bounds (paparazzi_seats.valid_from/valid_until) + the
 * DAYS multiplier the pricing paths use. Falls back to legacy single-day
 * (anchored to event_date) when no window is set OR the columns don't exist yet.
 */
export async function fetchEventPapicWindow(
  admin: SupabaseClient,
  eventId: string,
): Promise<StoredWindow> {
  const sel = await admin
    .from('events')
    .select('papic_window_start, papic_window_end, event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (sel.error?.code === '42703') {
    // Pre-migration: window columns absent — read just the anchor date.
    const fb = await admin
      .from('events')
      .select('event_date')
      .eq('event_id', eventId)
      .maybeSingle();
    return resolveStoredWindow({
      windowStart: null,
      windowEnd: null,
      eventDate: (fb.data?.event_date as string | null) ?? null,
    });
  }
  return resolveStoredWindow({
    windowStart: (sel.data?.papic_window_start as string | null) ?? null,
    windowEnd: (sel.data?.papic_window_end as string | null) ?? null,
    eventDate: (sel.data?.event_date as string | null) ?? null,
  });
}

/** The tier the guest-list cameras run at (owner 2026-06-26 — "upgrade to
 *  Unlimited"). roll = Limited (capped per-day shots) · unlimited = Unlimited
 *  (no shot cap, Drive-archived). Stored on the snapshot + each guest seat. */
export type LimitedTier = 'roll' | 'unlimited';

/** The per-camera catalog SKU for a guest-camera tier. */
export function papicTierSku(tier: LimitedTier): string {
  return tier === 'unlimited' ? PAPIC_CAMERA_UNLIMITED_SKU : PAPIC_CAMERA_ROLL_SKU;
}

/**
 * apps/web/lib/papic-limited.ts
 *
 * Papic LIMITED = the guest list (owner-locked 2026-06-26).
 *
 * The per-camera model splits cleanly:
 *   • LIMITED (roll) cameras come FROM the guest list. Every guest who has NOT
 *     declined becomes a Limited camera — their existing personal QR
 *     (guests.qr_token) is the credential, so the couple does nothing per guest.
 *     Sold once via a reversible SNAPSHOT (papic_limited_snapshots): "Ready for
 *     Papic" freezes the count + bill, but late "yes" RSVPs still get a camera
 *     within the cost cap at no surprise charge (syncGuestCameras, below).
 *   • UNLIMITED cameras are the ONLY way to add a shooter who is NOT on the guest
 *     list. Those stay anonymous paparazzi_seats with claim links — see
 *     lib/papic-cameras.ts (unchanged).
 *
 * "Everyone except declined" (owner pick): a guest counts as a Limited camera
 * when rsvp_status <> 'declined' (so attending + maybe + pending all count). The
 * couple sees the full number immediately rather than waiting on RSVPs.
 *
 * Prices are admin-managed — the roll rate + Ltd cap are read from the catalog /
 * event row by the caller and passed in; the constants here are last-resort
 * fallbacks only (mirrors lib/papic-cameras.ts).
 */

/** orders.service_key marker — reuse the per-camera key so the admin reconciliation queue treats Limited + Unlimited uniformly. */
export { PAPIC_CAMERAS_ORDER_KEY } from '@/lib/papic-cameras';

/** A guest counts as a Limited camera unless they explicitly declined. */
export const LIMITED_EXCLUDED_RSVP = 'declined' as const;

export type LimitedSnapshotStatus =
  | 'pending_payment'
  | 'active'
  | 'superseded'
  | 'cancelled';

export type LimitedSnapshotRow = {
  snapshot_id: string;
  event_id: string;
  order_id: string | null;
  guest_count: number;
  rate_php: number;
  cap_php: number;
  frozen_bill_php: number;
  camera_cap: number;
  days: number;
  status: LimitedSnapshotStatus;
  tier: LimitedTier;
  created_at: string;
  activated_at: string | null;
  superseded_at: string | null;
};

export type LimitedQuote = {
  guestCount: number;
  ratePhp: number;
  capPhp: number;
  days: number;
  rawBillPhp: number; // guestCount · rate (flat, no days), before the cap
  frozenBillPhp: number; // after the cost cap
  cameraCap: number; // max guest cameras one Limited purchase covers (cap / rate)
  capped: boolean; // raw bill exceeded the cap (price locked)
  overflow: number; // guests beyond cameraCap (need Unlimited / free tier)
};

/** Clamp to a non-negative integer. */
function intOf(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Count this event's Limited-eligible guests (rsvp_status <> 'declined'). Runs
 * behind the couple's RLS session (the buy page) OR an admin client (the sync).
 * Graceful-degrade to 0 on a missing/legacy guests table.
 */
export async function countLimitedGuests(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('rsvp_status', LIMITED_EXCLUDED_RSVP);
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return 0;
    throw new Error(`countLimitedGuests failed: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Quote a Limited (guest-list) activation. PURE + unit-testable. The bill is
 * guestCount · rate (FLAT per camera), clamped to the cost cap — so even 300
 * guests on Limited never pays more than the cap. cameraCap = how many guest
 * cameras that one capped purchase covers (so late RSVPs beyond it are flagged,
 * not billed).
 *
 * ⚠ FLAT per camera (2026-07-22 naming lock · migration 20270830568357). A
 * guest camera at the roll tier IS a Papic One (roll == mini), so it must price
 * exactly like /pricing's flat per-camera promise. `days` is the capture-WINDOW
 * length — kept for the snapshot + display, but NEVER a price multiplier (the
 * old `× days` engine was retired with the flat rename).
 */
export function computeLimitedQuote(
  guestCount: number,
  ratePhp: number,
  capPhp: number,
  days = 1,
): LimitedQuote {
  const n = intOf(guestCount);
  const rate = Number(ratePhp) > 0 ? Number(ratePhp) : PAPIC_CAMERA_ROLL_FALLBACK_PHP;
  const cap = Number(capPhp) > 0 ? Number(capPhp) : PAPIC_LTD_CAP_FALLBACK_PHP;
  // Window length — surfaced (snapshot.days + display) but not billed.
  const d = Math.max(1, Math.floor(Number(days)) || 1);

  const rawBillPhp = n * rate;
  const frozenBillPhp = Math.min(rawBillPhp, cap);
  // How many cameras the cap covers at the flat per-camera rate.
  const cameraCap = Math.max(0, Math.floor(cap / rate));
  const overflow = Math.max(0, n - cameraCap);

  return {
    guestCount: n,
    ratePhp: rate,
    capPhp: cap,
    days: d,
    rawBillPhp,
    frozenBillPhp,
    cameraCap,
    capped: rawBillPhp > cap,
    overflow,
  };
}

const SNAPSHOT_COLS =
  'snapshot_id, event_id, order_id, guest_count, rate_php, cap_php, frozen_bill_php, camera_cap, days, status, tier, created_at, activated_at, superseded_at';

/**
 * The current LIVE Limited snapshot for an event (status pending_payment or
 * active), or null. The partial unique index guarantees at most one. Graceful-
 * degrade to null on a missing/legacy table.
 */
export async function fetchActiveLimitedSnapshot(
  supabase: SupabaseClient,
  eventId: string,
): Promise<LimitedSnapshotRow | null> {
  const { data, error } = await supabase
    .from('papic_limited_snapshots')
    .select(SNAPSHOT_COLS)
    .eq('event_id', eventId)
    .in('status', ['pending_payment', 'active'])
    .maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return null;
    throw new Error(`fetchActiveLimitedSnapshot failed: ${error.message}`);
  }
  return (data as LimitedSnapshotRow | null) ?? null;
}

/**
 * Lazy reconcile (cron-free): if a snapshot is still 'pending_payment' but its
 * apply-then-pay order has reached paid/fulfilled, flip it to 'active'. Called on
 * page render with the admin client (after the app-level couple check). No-op for
 * a free/already-active snapshot. Best-effort — a reconcile hiccup never throws.
 */
export async function reconcileLimitedSnapshot(
  admin: SupabaseClient,
  snapshot: LimitedSnapshotRow,
): Promise<LimitedSnapshotStatus> {
  if (snapshot.status !== 'pending_payment' || !snapshot.order_id) {
    return snapshot.status;
  }
  try {
    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('order_id', snapshot.order_id)
      .maybeSingle();
    const ordStatus = (order as { status?: string } | null)?.status ?? '';
    if (ordStatus === 'paid' || ordStatus === 'fulfilled') {
      await admin
        .from('papic_limited_snapshots')
        .update({ status: 'active', activated_at: new Date().toISOString() })
        .eq('snapshot_id', snapshot.snapshot_id);
      return 'active';
    }
  } catch {
    // best-effort; keep the stored status.
  }
  return snapshot.status;
}

/**
 * A guest's Limited (roll) camera, resolved from their personal QR. The seat's
 * own claim_qr_token is the credential the capture surface (/papic/seat/[token])
 * already understands — so the guest-QR bridge resolves to it and reuses the
 * whole claim → capture pipeline (no duplicated camera UI).
 */
export type GuestRollSeat = {
  seatId: string;
  /** The seat's claim token — the key /papic/seat/[token] + /papic/claim/[token] use. */
  claimToken: string;
  /** The Limited snapshot's order — the per-camera paid gate reads this. */
  paidOrderId: string | null;
};

/**
 * This guest's ACTIVE Limited (roll) camera seat, or null. The partial unique
 * index (event_id, guest_id) WHERE revoked_at IS NULL guarantees at most one.
 * Admin client (a guest holding their QR is not an event member, so an RLS read
 * sees nothing). Graceful-degrade to null on a missing/legacy table/column.
 */
export async function fetchGuestRollSeat(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestRollSeat | null> {
  const { data, error } = await admin
    .from('paparazzi_seats')
    .select('seat_id, claim_qr_token, paid_order_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return null;
    throw new Error(`fetchGuestRollSeat failed: ${error.message}`);
  }
  if (!data) return null;
  return {
    seatId: data.seat_id as string,
    claimToken: data.claim_qr_token as string,
    paidOrderId: (data.paid_order_id as string | null) ?? null,
  };
}

/**
 * The state of a guest's Limited camera, resolved from their personal QR:
 *   • 'none'    — Limited isn't activated for this event, OR this guest has no
 *                 camera (declined / over the cost cap / not yet synced).
 *   • 'pending' — the camera exists but the Limited order is still awaiting the
 *                 Setnayan team's payment reconciliation → "payment under review",
 *                 capture stays blocked (mirrors the per-camera presign gate).
 *   • 'ready'   — the Limited snapshot is active (paid) AND this guest has a live
 *                 camera → route into capture at /papic/seat/[claimToken].
 */
export type GuestCameraResolution =
  | { status: 'none' }
  | { status: 'pending'; claimToken: string; snapshot: LimitedSnapshotRow }
  | { status: 'ready'; claimToken: string; snapshot: LimitedSnapshotRow };

/**
 * Resolve a guest's Limited camera from (eventId, guestId) — the single source
 * of truth shared by the guest-QR bridge (/papic/me/[token]) and the guest
 * landing page CTA. Admin client only (the guest is not an event member).
 *
 * Gate (task-locked): capture is allowed ONLY under an ACTIVE
 * papic_limited_snapshots row (the snapshot flips pending_payment → active once
 * its apply-then-pay order is paid/fulfilled — reconciled lazily here). A
 * still-pending snapshot returns 'pending' so the surface shows "payment under
 * review" instead of a working camera. The record layer (recordSeatCapture)
 * independently re-checks papicCameraOrderPaid — this is the page-level half of
 * that same gate, defense-in-depth.
 *
 * opts.sync (default false): when set, best-effort re-provision the event's
 * guest cameras before resolving this guest's seat — so a late "yes" RSVP whose
 * camera hasn't been materialized yet (the couple hasn't reopened the studio
 * page) still gets one the instant they scan their QR, within the cost cap.
 */
export async function resolveGuestCamera(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
  opts: { sync?: boolean } = {},
): Promise<GuestCameraResolution> {
  const snapshot = await fetchActiveLimitedSnapshot(admin, eventId);
  if (!snapshot) return { status: 'none' };

  let seat = await fetchGuestRollSeat(admin, eventId, guestId);
  if (!seat && opts.sync) {
    // Self-heal a late RSVP: provision the missing guest cameras, then re-read.
    try {
      await syncGuestCameras(admin, eventId, snapshot);
      seat = await fetchGuestRollSeat(admin, eventId, guestId);
    } catch {
      // best-effort — fall through to 'none' if provisioning hiccups.
    }
  }
  if (!seat) return { status: 'none' };

  const status = await reconcileLimitedSnapshot(admin, snapshot);
  return {
    status: status === 'active' ? 'ready' : 'pending',
    claimToken: seat.claimToken,
    snapshot,
  };
}

export type GuestCameraSyncResult = {
  added: number;
  revoked: number;
  retiered: number;
};

/**
 * The single provisioning path for Limited (guest) cameras — idempotent + self-
 * healing. Brings the event's roll seats into line with its guest list under an
 * active snapshot:
 *   • provisions a roll seat (tier='roll', guest_id bound, paid_order_id = the
 *     snapshot's order) for every non-declined guest who has no active camera,
 *     up to the snapshot's camera_cap (so an over-cap list isn't silently
 *     over-provisioned — the page flags the overflow);
 *   • REVOKES (sets revoked_at — never deletes, photos are kept) any active guest
 *     camera whose guest has since declined, AND any orphaned roll seat whose
 *     guest_id went NULL (the guest was deleted → ON DELETE SET NULL).
 *
 * Admin client only (bypasses RLS — call after verifying the caller is a couple
 * on the event, OR from a server action that already did). Seats use the per-
 * camera index range (>= 200) shared with anonymous Unlimited extras; indexes
 * are allocated past the current max so they never collide. Returns the counts.
 */
export async function syncGuestCameras(
  admin: SupabaseClient,
  eventId: string,
  snapshot: LimitedSnapshotRow,
): Promise<GuestCameraSyncResult> {
  const EMPTY = { added: 0, revoked: 0, retiered: 0 };
  if (!eventId || !snapshot) return EMPTY;

  const snapshotTier = (snapshot.tier ?? 'roll') as LimitedTier;
  const snapshotSku = papicTierSku(snapshotTier);

  // Non-declined guests, oldest first (deterministic cap application).
  const { data: guestRows, error: guestErr } = await admin
    .from('guests')
    .select('guest_id, rsvp_status, created_at')
    .eq('event_id', eventId)
    .neq('rsvp_status', LIMITED_EXCLUDED_RSVP)
    .order('created_at', { ascending: true });
  if (guestErr) {
    if (guestErr.code === '42P01' || guestErr.code === '42703') return EMPTY;
    throw new Error(`syncGuestCameras read guests failed: ${guestErr.message}`);
  }
  const eligibleGuestIds = (guestRows ?? []).map((g) => g.guest_id as string);
  const eligibleSet = new Set(eligibleGuestIds);

  // Existing ACTIVE guest cameras — guest_id bound, ANY tier (a guest camera can
  // be Limited(roll) or Unlimited per the snapshot tier). Anonymous Unlimited
  // EXTRAS (guest_id NULL) are a different surface and untouched here.
  const { data: seatRows, error: seatErr } = await admin
    .from('paparazzi_seats')
    .select('seat_id, guest_id, tier')
    .eq('event_id', eventId)
    .not('guest_id', 'is', null)
    .is('revoked_at', null);
  if (seatErr) {
    if (seatErr.code === '42P01' || seatErr.code === '42703') return EMPTY;
    throw new Error(`syncGuestCameras read seats failed: ${seatErr.message}`);
  }
  const activeSeats = seatRows ?? [];
  const haveCameraForGuest = new Set(activeSeats.map((s) => s.guest_id as string));

  const nowIso = new Date().toISOString();

  // 1) REVOKE cameras whose guest is no longer eligible (declined). Never delete
  //    — photos stay in the gallery.
  const toRevoke = activeSeats
    .filter((s) => !eligibleSet.has(s.guest_id as string))
    .map((s) => s.seat_id as string);
  let revoked = 0;
  if (toRevoke.length > 0) {
    const { error: revErr } = await admin
      .from('paparazzi_seats')
      .update({ revoked_at: nowIso, updated_at: nowIso })
      .in('seat_id', toRevoke);
    if (!revErr) revoked = toRevoke.length;
  }
  const revokeSet = new Set(toRevoke);

  // 1b) RE-TIER still-eligible cameras whose tier != the snapshot tier — an
  //     upgrade to Unlimited (or a switch back to Limited). Re-point them at the
  //     snapshot's order so the per-camera paid gate reads the right charge.
  const toRetier = activeSeats
    .filter(
      (s) =>
        !revokeSet.has(s.seat_id as string) &&
        eligibleSet.has(s.guest_id as string) &&
        (s.tier as string) !== snapshotTier,
    )
    .map((s) => s.seat_id as string);
  let retiered = 0;
  if (toRetier.length > 0) {
    const { error: retErr } = await admin
      .from('paparazzi_seats')
      .update({
        tier: snapshotTier,
        sku_code: snapshotSku,
        paid_order_id: snapshot.order_id,
        updated_at: nowIso,
      })
      .in('seat_id', toRetier);
    if (!retErr) retiered = toRetier.length;
  }

  // 2) PROVISION missing cameras at the snapshot tier, up to camera_cap. Headroom
  //    counts only ELIGIBLE guests who already have a camera (revoked ones free
  //    their slots).
  const missing = eligibleGuestIds.filter((id) => !haveCameraForGuest.has(id));
  const eligibleWithCamera = eligibleGuestIds.length - missing.length;
  const room = Math.max(0, snapshot.camera_cap - eligibleWithCamera);
  const toAdd = missing.slice(0, room);
  let added = 0;
  if (toAdd.length > 0) {
    // Next free index in the per-camera range (>= 200), shared with extras.
    const { data: maxRow } = await admin
      .from('paparazzi_seats')
      .select('seat_index')
      .eq('event_id', eventId)
      .gte('seat_index', 200)
      .order('seat_index', { ascending: false })
      .limit(1);
    let next = ((maxRow?.[0]?.seat_index as number | undefined) ?? 199) + 1;

    // Validity window = the event's chosen Papic capture window (owner
    // 2026-06-26). Both Limited guest cameras and Unlimited extras share it, so
    // every camera on the event opens + closes together. Legacy single-day
    // events fall back inside fetchEventPapicWindow.
    const win = await fetchEventPapicWindow(admin, eventId);

    const inserts = toAdd.map((guestId) => {
      const row = {
        event_id: eventId,
        seat_index: next,
        sku_code: snapshotSku,
        tier: snapshotTier,
        guest_id: guestId,
        claim_qr_token: generateSeatClaimToken(),
        paid_order_id: snapshot.order_id,
        valid_from: win.startIso,
        valid_until: win.endIso,
      };
      next += 1;
      return row;
    });
    const { error: insErr } = await admin
      .from('paparazzi_seats')
      .upsert(inserts, {
        onConflict: 'event_id,seat_index',
        ignoreDuplicates: true,
      });
    if (!insErr) added = inserts.length;
  }

  return { added, revoked, retiered };
}
