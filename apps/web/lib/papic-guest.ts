import type { SupabaseClient } from '@supabase/supabase-js';
import { eventOwnsSku, eventSkuActive, eventHasPapicUnlock } from '@/lib/entitlements';

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
  // 1. OWNERSHIP — any of the four Papic One rungs, not just the entry SKU.
  //    (Migration 20270828140000 turned the flat pass into three purchased
  //    buckets + a top-up. Checking only PAPIC_GUEST would leave a couple who
  //    bought the 6,000- or 10,000-shot rung with granted points and NO cameras.)
  const owned = await Promise.all(
    PAPIC_PASS_SERVICE_KEYS.map((key) => eventSkuActive(supabase, eventId, key)),
  );
  if (!owned.some(Boolean)) return false;

  // 2. THE DATE WINDOW. A couple picks the service date at purchase; buying
  //    several passes covers several dates. NULL service_date = unscoped =
  //    always on, which is what every legacy grant and admin comp carries — so
  //    this can only ever ADD cameras relative to the old behaviour, never
  //    silently remove them from an event that already had them.
  return isPapicPassOpenOn(supabase, eventId, manilaToday());
}

/** Every SKU that grants the guest-camera pass (Papic One + the legacy pack). */
export const PAPIC_PASS_SERVICE_KEYS: readonly string[] = Object.freeze([
  PAPIC_GUEST_SERVICE_KEY,
  'PAPIC_GUEST_6K',
  'PAPIC_GUEST_10K',
  'PAPIC_GUEST_TOPUP',
]);

/**
 * Today in **Asia/Manila** as YYYY-MM-DD.
 *
 * NOT `CURRENT_DATE` and not `new Date().toISOString()`. PH is UTC+8, so a
 * wedding morning maps to the PREVIOUS UTC date — 7am Manila on the 21st is 11pm
 * UTC on the 20th. Gating on a UTC date would leave the cameras shut for the
 * first eight hours of the day the couple actually paid for.
 */
export function manilaToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

/**
 * Is the pass open on `isoDate` (YYYY-MM-DD)?
 *
 * TRUE when the event holds either an UNSCOPED grant (`service_date IS NULL` —
 * legacy or comp, always on) or one scoped to exactly this date.
 *
 * Fail-OPEN on a read error, deliberately and unlike the capture gate: this is a
 * DISPLAY/entry check that runs after ownership has already been confirmed, and
 * the authoritative spend guard is the fail-CLOSED points RPC. A transient DB
 * hiccup must not black out a paid couple's cameras mid-reception; it can only
 * ever let someone reach a surface where the real meter still refuses.
 */
export async function isPapicPassOpenOn(
  supabase: SupabaseClient,
  eventId: string,
  isoDate: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('papic_event_point_grants')
      .select('service_date')
      .eq('event_id', eventId)
      .or(`service_date.is.null,service_date.eq.${isoDate}`)
      .limit(1);
    if (error) return true;
    // No grants at all → nothing date-scoped exists yet (e.g. the legacy
    // PAPIC_GUEST order predates the grants ledger). Ownership already passed,
    // so keep the historical always-on behaviour.
    if (!Array.isArray(data)) return true;
    if (data.length > 0) return true;

    const { count, error: countErr } = await supabase
      .from('papic_event_point_grants')
      .select('grant_id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    if (countErr) return true;
    return (count ?? 0) === 0;
  } catch {
    return true;
  }
}

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
 * "Guest cameras" card. Admin client, constrained to event_id. Graceful-
 * degrade to 0 on a missing/legacy table.
 */
export async function countEventGuestCaptures(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('papic_guest_captures')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) return 0;
  return count ?? 0;
}
