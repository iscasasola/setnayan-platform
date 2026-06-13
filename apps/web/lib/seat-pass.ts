import type { SupabaseClient } from '@supabase/supabase-js';
import { checkOrderOwnership } from '@/lib/entitlements';

/**
 * apps/web/lib/seat-pass.ts
 *
 * Entitlement + service-key constants for the personalized Seat Pass + public
 * QR resolver (seat-finding PR 4/6 · /[slug]/seat). The Seat Pass is the paid
 * surface the Custom-QR Guest SKU's per-guest / per-table branded QR codes
 * point at: scan a personal QR → your exact seat + arrival bloom; scan a table
 * QR → that table's public view. Both branches gate on CUSTOM_QR_GUEST
 * ownership before any seating read.
 *
 * Gating reuses the SAME refund-aware, graceful-degrade reader every couple SKU
 * gate uses (checkOrderOwnership · lib/entitlements.ts) — NO new ownership
 * mechanic, NO migration. This file only centralizes the bare 'CUSTOM_QR_GUEST'
 * literal (previously inline as SKU_CODE in the add-on page) and adds an inert
 * Pakanta stub so the arrival bloom's song branch is wired but harmless.
 *
 * SCOPE — strictly additive. find-my-table + its INDOOR_BLUEPRINT gate are NOT
 * touched; no live SKU is retired. The IB↔Custom-QR reconciliation is flagged
 * for owner sign-off in the PR description, not built here.
 */

/**
 * Canonical Custom-QR Guest service_key (₱1,499 · 'live' · v2-catalog.ts).
 * Was a bare inline literal (`SKU_CODE`) in the add-on page; promoted here so
 * the gate, the resolver, and the activation hook all read ONE source.
 */
export const CUSTOM_QR_GUEST_SERVICE_KEY = 'CUSTOM_QR_GUEST';

/**
 * Does this event own the paid Custom-QR Guest SKU (gates the seat pass)?
 *
 * Delegates to the shared checkOrderOwnership() reader (lib/entitlements.ts) —
 * refund-aware, graceful-degrade on a missing/legacy orders table (42P01 /
 * 42703 → false) so the gated surface shows the friendly "ask the couple"
 * prompt rather than throwing. Mirrors eventOwnsIndoorBlueprint /
 * eventOwnsAnimatedMonogram exactly.
 */
export async function eventOwnsCustomQrGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return checkOrderOwnership(supabase, eventId, CUSTOM_QR_GUEST_SERVICE_KEY);
}

/**
 * Pakanta ownership — STUB. Pakanta is `not_built` (v2-catalog.ts:102): no
 * table, no migration, no order path yet. Returns false so the arrival bloom's
 * song branch is wired but inert. Replace with a real checkOrderOwnership call
 * when PAKANTA ships. Do NOT add a Pakanta migration in PR4.
 */
export async function eventOwnsPakanta(
  _supabase: SupabaseClient,
  _eventId: string,
): Promise<boolean> {
  return false;
}

/**
 * Has the couple PUBLISHED the seating pack for this event?
 * (event_floor_plan.published_at IS NOT NULL).
 *
 * The publication gate is the privacy boundary on the seat pass: a DRAFT plan
 * must never leak the table label + occupant roster (public table QR) or a
 * guest's room/seat (personal QR) before the couple posts it. Mirrors the
 * publication gate the PR1 free finder uses.
 *
 * Read via the admin client (these are public, RLS-less routes). Graceful-
 * degrade on a missing/legacy floor-plan table or column (42P01 / 42703) →
 * treat as NOT published (fail closed: no roster, friendly "not posted yet"
 * card) — the same posture as fetchFloorPlan + checkOrderOwnership.
 */
export async function eventSeatingPublished(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_floor_plan')
    .select('published_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    // Any other read error: fail closed rather than leaking a draft roster.
    return false;
  }
  return Boolean((data as { published_at?: string | null } | null)?.published_at);
}
