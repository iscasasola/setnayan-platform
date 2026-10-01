import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';

/**
 * apps/web/lib/seat-pass.ts
 *
 * Entitlement + service-key constants for the personalized Seat Pass + public
 * QR resolver (seat-finding PR 4/6 · /[slug]/seat). The Seat Pass is the paid
 * surface the Custom-QR Guest SKU's per-guest / per-table branded QR codes
 * point at: scan a personal QR → your exact seat + arrival bloom; scan a table
 * QR → that table's public view. Both branches gate on CUSTOM_QR_GUEST
 * entitlement before any seating read.
 *
 * Gating reuses the SAME bundle-aware, admin-approved, refund-aware reader every
 * paid couple-feature surface uses (eventSkuActive · lib/entitlements.ts) — NO
 * new ownership mechanic, NO migration. CUSTOM_QR_GUEST is a child of BOTH
 * bundles (GUIDED_PACK / MEDIA_PACK), so the gate MUST be bundle-aware: a couple
 * who got Custom-QR via Essentials/Complete owns no per-child order, yet must
 * still get the seat pass. eventSkuActive() resolves both purchase shapes and
 * requires the order (direct or bundle) to be admin-approved — the same paid-
 * feature handshake as eventAnimatedMonogramActive / eventPapicGuestActive.
 *
 * SCOPE — strictly additive. find-my-table + its INDOOR_BLUEPRINT gate are NOT
 * touched; no live SKU is retired. The IB↔Custom-QR reconciliation is flagged
 * for owner sign-off in the PR description, not built here.
 */

/**
 * Canonical Custom-QR Guest service_key. Promoted from an inline literal so the
 * gate, the resolver, and the activation hook all read ONE source.
 */
export const CUSTOM_QR_GUEST_SERVICE_KEY = 'CUSTOM_QR_GUEST';

/**
 * Is the paid Custom-QR Guest SKU ACTIVE for this event (gates the seat pass)?
 *
 * Delegates to the bundle-aware, admin-approved eventSkuActive() reader
 * (lib/entitlements.ts) — true when the event holds an approved CUSTOM_QR_GUEST
 * order directly OR an approved GUIDED_PACK/MEDIA_PACK bundle that grants it.
 * Refund-aware + graceful-degrade on a missing/legacy orders table (42P01 /
 * 42703 → false) so the gated surface shows the friendly "ask the couple" prompt
 * rather than throwing. Mirrors eventAnimatedMonogramActive / eventPapicGuestActive
 * — the canonical paid-feature gate doctrine (FEATURE gates require approval).
 */
export async function eventOwnsCustomQrGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventSkuActive(supabase, eventId, CUSTOM_QR_GUEST_SERVICE_KEY);
}

/**
 * Pakanta ownership — STUB. Pakanta is `not_built`: no table, no migration, no
 * order path yet. Returns false so the arrival bloom's song branch is wired but
 * inert. Replace with a real eventSkuActive() call when PAKANTA ships. Do NOT
 * add a Pakanta migration in PR4.
 */
export async function eventOwnsPakanta(
  _supabase: SupabaseClient,
  _eventId: string,
): Promise<boolean> {
  return false;
}

// 🪑 "May guests see their seats?" moved to `lib/guests-may-see-seats.ts`
// (`guestsMaySeeSeatsFor`) on 2026-09-30 — owner: "seatplan will show on the
// date of the event". It is no longer the published flag alone: on the event's
// day seats show with no action from the couple, and before it only the
// couple's "Show guests their seats early" switch opens them.
