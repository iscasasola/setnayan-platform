import type { SupabaseClient } from '@supabase/supabase-js';

// ── Papic ONE-POOL capture gate (guest-camera route boundary) ────────────────
//
// The pool pre-check the guest-capture route (app/api/papic/guest-capture/
// route.ts) makes against the ONE shared event pool before it uploads — kept
// here so it is unit-testable without importing the route's `server-only`
// chain (R2 / Drive). The AUTHORITATIVE booking is not here: it happens inside
// `papic_record_guest_capture_and_spend`, in the same transaction as the row.
//
// Free / Papic One / Papic Pool all draw this same pool (papic_event_point_grants
// → papic_reserve_event_points); a non-applies event (no grant / no pass) is a
// no-op here (remaining = MAXINT).

/**
 * Fail-OPEN orphan-byte pre-check: returns true iff the shared event pool is
 * ALREADY definitively exhausted for a capture of `cost` points, so the caller
 * can 409 before any R2 PUT (keeps R2 free of orphans for the common exhausted
 * case). Fails OPEN by design — a non-applies event returns MAXINT (no-op) and
 * ANY RPC error skips the optimization; the booking inside the record is the
 * real gate, so a false-negative here never over-books.
 */
export async function papicEventPoolPreCheckExhausted(
  admin: SupabaseClient,
  eventId: string,
  cost: number,
): Promise<boolean> {
  const { data: remaining, error } = await admin.rpc('papic_event_points_remaining', {
    p_event_id: eventId,
  });
  return !error && typeof remaining === 'number' && remaining < cost;
}

// ⛔ `papicReserveEventPoolForCapture` LIVED HERE until 2026-10-18. The guest
// route's pool booking now happens inside `papic_record_guest_capture_and_spend`
// (20271276810836), in the same transaction as the row. The pre-check above
// stays: it only keeps R2 free of objects the booking would refuse.
