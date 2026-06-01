import type { SupabaseClient } from '@supabase/supabase-js';

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

const RELINQUISHED_STATUSES = new Set(['cancelled', 'refunded', 'lapsed']);

/**
 * Does this event own the paid Premium Guest Camera Pack?
 *
 * Returns false on any DB shape error (missing table/column) so the gated
 * surface degrades to the upgrade CTA / "no guest cameras" state rather than
 * throwing. Mirrors eventOwnsProWebsite() / eventOwnsIndoorBlueprint() exactly.
 */
export async function eventOwnsPapicGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', PAPIC_GUEST_SERVICE_KEY)
    .not('status', 'in', '("cancelled","refunded","lapsed")');

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(`Failed to resolve Premium Guest Camera ownership: ${error.message}`);
  }

  return (data ?? []).some(
    (row) => !RELINQUISHED_STATUSES.has((row.status as string | null) ?? ''),
  );
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
  /** total − used, floored at 0. */
  remaining: number;
};

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
  const { count, error } = await supabase
    .from('papic_guest_captures')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    // Pre-migration table or read error → assume nothing used yet. The RPC
    // enforces the real cap; this read only drives the display.
    return { total: GUEST_CAPTURE_CREDITS, used: 0, remaining: GUEST_CAPTURE_CREDITS };
  }

  const used = count ?? 0;
  return {
    total: GUEST_CAPTURE_CREDITS,
    used,
    remaining: Math.max(0, GUEST_CAPTURE_CREDITS - used),
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
