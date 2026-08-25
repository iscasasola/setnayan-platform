import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventOwnsSku, eventSkuActive, eventHasPapicUnlock } from '@/lib/entitlements';
import { readEventPoolStatus } from '@/lib/papic-event-pool';

/**
 * apps/web/lib/papic-guest.ts
 *
 * Closes the partial PAPIC_GUEST SKU (₱2,999 · "Every guest's phone, a candid
 * camera" — the Premium Guest Camera Pack · v2.1 brief § 5 + the iteration-0012
 * Papic spec § 8 "150 captured-photo credits, bundled free in the Premium Guest
 * Camera Pack"). The Papic web-capture surface is scaffolded; v2-catalog.ts
 * marks PAPIC_GUEST 'partial' because "quota enforcement not wired" — there was
 * no guest-camera surface and no per-guest capture limit.
 *
 * THIS adds the missing half: when the event owns a paid PAPIC_GUEST order,
 * every signed-in guest gets a browser camera with a per-guest capture quota of
 * GUEST_CAPTURE_CREDITS (150), enforced SERVER-SIDE. Captures land in a new
 * papic_guest_captures table keyed by guest_id; a SECURITY DEFINER RPC counts
 * the guest's existing captures and rejects the insert once the credit pool is
 * exhausted. The guest surface shows "N captures left" from the same count.
 *
 * WHY a separate captures table (not the existing papic_photos) — papic_photos
 * (migration 20260520015000) is SEAT-bound: every row has a NOT NULL FK to
 * paparazzi_seats and is governed by PAPIC_SEATS. Guest cameras are a different
 * actor (the guest, identified by guest_id from the guest-session cookie, not a
 * claimed seat) and a different SKU (PAPIC_GUEST). Keeping guest captures in
 * their own table keeps the per-guest 150-credit quota cleanly separate from
 * the seat-pack pooled-credit model and avoids overloading the seat FK.
 *
 * Gating — same owned-orders pattern eventOwnsProWebsite() / eventOwnsIndoor-
 * Blueprint() use: an `orders` row with service_key = 'PAPIC_GUEST' whose status
 * is NOT cancelled / refunded / lapsed. A still-in-reconciliation 'submitted'
 * order counts as owned so the couple can't double-buy mid-reconciliation.
 *
 * SAFETY — every helper here that touches papic_guest_captures runs ONLY behind
 * a gate (the couple's add-on page is auth-bound; the guest camera route checks
 * the guest session + ownership BEFORE any captures query). NOTHING here runs on
 * the always-rendered public landing page. Graceful-degrade on a missing/legacy
 * table (42P01 undefined_table · 42703 undefined_column) so a pre-bootstrap
 * database surfaces the upgrade CTA / no-cameras state rather than crashing —
 * matches the PR #380/#390 + website/page.tsx + indoor-blueprint hotfix pattern.
 */

export const PAPIC_GUEST_SERVICE_KEY = 'PAPIC_GUEST';
export const PAPIC_GUEST_PRICE_PHP = 2999; // v2.1 brief § 5 · ₱2,999

/**
 * Per-guest captured-photo credits bundled in the Premium Guest Camera Pack.
 * Iteration 0012 Papic spec § 8: "Each guest receives 150 captured-photo
 * credits, bundled free in the Premium Guest Camera Pack."
 */
export const GUEST_CAPTURE_CREDITS = 150;

/**
 * Does this event own the paid Premium Guest Camera Pack?
 *
 * Delegates to the bundle-aware eventOwnsSku() reader (lib/entitlements.ts) —
 * refund-aware, graceful-degrade on a missing orders table, AND counts a
 * GUIDED_PACK or MEDIA_PACK bundle (both include PAPIC_GUEST) as owning the
 * guest-camera pack. Kept in lockstep with the DB RPC papic_event_owns_service
 * (migration 20270103010000) so the gate and the provisioning RPC agree.
 */
export async function eventOwnsPapicGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, PAPIC_GUEST_SERVICE_KEY);
}

/**
 * Is Papic Guest ACTIVE (admin-approved)? The handshake FEATURE GATE — the
 * guest camera unlocks only after the Setnayan team verifies the payment
 * (owner 2026-06-18). The buy surface keeps eventOwnsPapicGuest.
 */
export async function eventPapicGuestActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  // ── A LIVE POOL OPENS THE CAMERA, PAID OR FREE (owner-locked 2026-08-02) ──
  //
  // This used to require a PURCHASE. The free 50-point pool did not count, so on
  // a free event the guest site showed "Show my QR" and "Photos of you" and NO
  // camera — the only people who could shoot were whoever was handed one of the
  // three claim links. The free tier therefore had shots nobody could spend.
  //
  // Owner's call: "free guests can shoot." Paying buys MORE SHOTS, not more
  // PEOPLE. That costs nothing to give away, because the bound was never the
  // number of cameras — it is the purse, and the purse is already fenced:
  // papic_reserve_event_points_for_seat fails CLOSED at zero.
  //
  // ⚠ `applies`, deliberately NOT `remaining > 0`. An empty pool must still open
  // the camera: the capture screen explains "out of shots" far better than a
  // missing button does, and closing the door at zero would strand a guest who
  // scanned seconds earlier. Same reasoning as the poster join action.
  return (await eventPapicGuestAccess(supabase, eventId)) === 'on';
}

/**
 * The same question, answered in THREE states instead of two.
 *
 * 🔴 WHY. `eventPapicGuestActive` collapses "we could not find out" into
 * "false", and two guest-facing pages then print that as a sentence about the
 * HOST: "the host hasn't turned on guest cameras for this event yet."
 * `fetchEventPoolStatus` returns its ABSENT sentinel on any RPC error, and the
 * call below used to wrap it in a second `.catch(() => null)` — so a metering
 * outage, a missing grant or a renamed function all arrived at a guest's phone
 * as a decision their host had made. This repo's own rule: a rejected query is
 * not a thrown error, and the only symptom is an absence.
 *
 * 'unknown' is NOT a third permission. Every gate keeps failing closed — the
 * boolean above still returns false for it, so all ten existing callers behave
 * exactly as before. It exists so a screen can tell a person the truth about
 * WHY the camera is not opening.
 */
export type PapicGuestAccess = 'on' | 'off' | 'unknown';

export async function eventPapicGuestAccess(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicGuestAccess> {
  const [owned, pool] = await Promise.all([
    Promise.all(PAPIC_PASS_SERVICE_KEYS.map((key) => eventSkuActive(supabase, eventId, key))),
    readEventPoolStatus(supabase, eventId).catch(() => ({ ok: false, status: null })),
  ]);
  if (owned.some(Boolean)) return 'on';
  if (!pool.ok) return 'unknown';
  return pool.status?.applies === true ? 'on' : 'off';
}

/**
 * Every SKU that grants the guest-camera pass.
 *
 * ── WHY THERE IS NO DATE HERE (owner 2026-07-21) ─────────────────────────
 * The pass runs until the POINTS are depleted, not until a date passes. Points
 * are already the bound — the fail-closed pool RPC refuses at zero — so a date
 * gate would be a second fence around something already fenced, and the worst
 * case is bounded by construction: N unused points is at most N more captures,
 * whenever they happen.
 *
 * It is also the only model that survives a MULTI-DAY event. `travel` is
 * multi_day = TRUE by definition, and a ten-day trip must not need ten
 * purchases. Per-day scoping breaks there; points do not.
 *
 * A service_date column + date-aware gate were built and REMOVED before merge
 * for exactly this reason (PR #3430). Do not reintroduce one without a concrete
 * need — and if the pass ever does need to close, tie it to the RETENTION
 * WINDOW (it shuts when the gallery does), not to a per-day picker.
 */
export const PAPIC_PASS_SERVICE_KEYS: readonly string[] = Object.freeze([
  PAPIC_GUEST_SERVICE_KEY,
  'PAPIC_GUEST_6K',
  'PAPIC_GUEST_10K',
  'PAPIC_GUEST_TOPUP',
]);

// ─────────────────────────────────────────────────────────────────────────
// Quota — count a guest's captures + derive credits remaining. The
// authoritative enforcement is the SECURITY DEFINER RPC (papic_guest_capture)
// which re-checks the count under the same transaction as the insert; these
// helpers are the read side that drives the "N captures left" display.
// ─────────────────────────────────────────────────────────────────────────

export type GuestQuota = {
  /** How many credits the guest started with (150). */
  total: number;
  /** How many captures the guest has already recorded. */
  used: number;
  /** total − used, floored at 0. When `unlimited`, a large sentinel so the
   *  remaining-based gate (route pre-check + client `exhausted`) never trips. */
  remaining: number;
  /** True when "Unlock all of Papic" lifts the per-guest cap — every guest shoots
   *  unlimited; the UI shows "Unlimited" instead of a number. */
  unlimited: boolean;
};

/** Sentinel `remaining` for an unlimited (Unlock) guest — large enough that the
 *  `<= 0` pre-check + client `exhausted` never fire, but still a finite number
 *  so it serializes cleanly to the client and survives a decrement. */
const UNLIMITED_REMAINING = Number.MAX_SAFE_INTEGER;

/**
 * Resolve a single guest's quota from papic_guest_captures. `supabase` here is
 * an admin client (the guest camera route is a public surface with no RLS
 * session) constrained to this event_id + guest_id. Graceful-degrade to a
 * full-quota shape (used=0) on a missing/legacy table so the first capture can
 * still be attempted — the RPC is the real gate.
 */
export async function fetchGuestQuota(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestQuota> {
  // "Unlock all of Papic" lifts the per-guest 150-credit cap entirely. The
  // authoritative cap-skip is in the papic_record_guest_capture RPC; this read
  // mirrors it so the display shows "Unlimited" and the route's remaining-based
  // pre-check passes. Graceful: any read error → false (the normal cap applies).
  let unlimited = false;
  try {
    unlimited = await eventHasPapicUnlock(supabase, eventId);
  } catch {
    unlimited = false;
  }

  const { count, error } = await supabase
    .from('papic_guest_captures')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    // Pre-migration table or read error → assume nothing used yet. The RPC
    // enforces the real cap; this read only drives the display.
    return {
      total: GUEST_CAPTURE_CREDITS,
      used: 0,
      remaining: unlimited ? UNLIMITED_REMAINING : GUEST_CAPTURE_CREDITS,
      unlimited,
    };
  }

  const used = count ?? 0;
  return {
    total: GUEST_CAPTURE_CREDITS,
    used,
    remaining: unlimited
      ? UNLIMITED_REMAINING
      : Math.max(0, GUEST_CAPTURE_CREDITS - used),
    unlimited,
  };
}

/**
 * Total guest captures across the whole event — drives the couple-facing
 * "Guest cameras" card. Admin client, constrained to event_id.
 *
 * ⚠ RETURNS `null` WHEN THE COUNT COULD NOT BE READ, and that is the whole
 * point of the signature. It used to `return 0` on an error, which is the
 * SAME VALUE a real empty event produces — so a refusal, an RLS silent-zero or
 * a legacy/missing table all arrived at the gallery hub as "no photos yet", on
 * a page whose entire job is to reach photos that exist. This area has paid for
 * that exact mistake before: the home tile once told coordinators "0 cameras
 * out" mid-shoot, an RLS silent-zero.
 *
 * 🔑 Binding the error is not enough if you then throw it away — `if (error)
 * return 0` reads as careful code and states an absence nobody measured.
 * Callers that genuinely cannot show a caveat may still `?? 0`; they are then
 * choosing the zero, in the open, at the call site.
 */
export async function countEventGuestCaptures(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('papic_guest_captures')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) {
    logQueryError(
      'countEventGuestCaptures',
      error,
      { event_id: eventId },
      'graceful_degrade',
    );
    return null;
  }
  return count ?? 0;
}
