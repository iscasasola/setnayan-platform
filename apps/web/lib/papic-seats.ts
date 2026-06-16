import type { SupabaseClient } from '@supabase/supabase-js';
import { checkOrderOwnership } from '@/lib/entitlements';

/**
 * apps/web/lib/papic-seats.ts
 *
 * Closes the partial PAPIC_SEATS SKU (₱2,999 · "Turn five friends into your
 * photo crew" · v2.1 brief § 5 + the iteration-0012 Papic spec). The Papic
 * web-capture surface is scaffolded; v2-catalog.ts marks PAPIC_SEATS 'partial'
 * because "seat provisioning not wired" — the couple could see a MOCK list of
 * five seats but nothing materialized real seat rows or let a friend claim one.
 *
 * THIS adds the missing half:
 *   • Provisioning — when the event owns a paid PAPIC_SEATS order, the couple
 *     materializes 5 paparazzi seats (rows in the existing public.paparazzi_seats
 *     table, shipped by migration 20260520015000) each with a fresh claim token.
 *   • Claim — each seat carries a per-seat claim link the couple shares; a
 *     friend opens /papic/claim/[token], signs in, and the seat binds to their
 *     device so they can shoot through the Papic crew surface.
 *
 * SEAT COUNT — the V2 PAPIC_SEATS pass merges the V1 3-seat + 5-seat distinction
 * into a single ₱2,999 five-seat pass (v2.1 brief § 5 · lib/v2/sku-catalog-v2.ts
 * V1_TO_V2_SKU_MAP maps both paparazzi_3_seats + paparazzi_5_seats → PAPIC_SEATS).
 * So one owned PAPIC_SEATS order provisions exactly 5 seats.
 *
 * Gating — same owned-orders pattern eventOwnsProWebsite() / eventOwnsIndoor-
 * Blueprint() use: an `orders` row with service_key = 'PAPIC_SEATS' whose status
 * is NOT cancelled / refunded / lapsed. A still-in-reconciliation 'submitted'
 * order counts as owned so the couple can't double-buy mid-reconciliation.
 *
 * SAFETY — every helper here that reads paparazzi_seats runs ONLY behind a gate
 * (the couple's add-on page is auth-bound; the guest claim route validates the
 * token via a SECURITY DEFINER RPC before any read). NOTHING here runs on the
 * always-rendered public landing page. Graceful-degrade on a missing/legacy
 * table (42P01 undefined_table · 42703 undefined_column) so a pre-bootstrap
 * database surfaces the upgrade CTA / no-seats state rather than crashing —
 * matches the PR #380/#390 + website/page.tsx + indoor-blueprint hotfix pattern.
 */

export const PAPIC_SEATS_SERVICE_KEY = 'PAPIC_SEATS';
export const PAPIC_SEATS_PRICE_PHP = 2999; // v2.1 brief § 5 · ₱2,999

/**
 * One owned PAPIC_SEATS order provisions this many paparazzi seats. The V2
 * pass is the five-seat pass (the V1 3-seat tier was dropped in the merge).
 */
export const PAPIC_SEAT_COUNT = 5;

/**
 * Does this event own the paid Papic Seats pass?
 *
 * Delegates to the shared checkOrderOwnership() reader (lib/entitlements.ts) —
 * refund-aware, graceful-degrade on a missing orders table so the gated surface
 * shows the upgrade CTA rather than throwing.
 */
export async function eventOwnsPapicSeats(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return checkOrderOwnership(supabase, eventId, PAPIC_SEATS_SERVICE_KEY);
}

// ── Free Papic sampler (owner-locked 2026-06-16) ─────────────────────────────
// A couple can TRY Papic free so they experience the tag→gallery loop: 3 seats,
// 8 photos + 2 clips EACH (the 5-sec clip cap still applies), kept 30 days unless
// they connect Drive (their own copy) or upgrade to paid Papic. Reuses the whole
// seat→claim→capture→tag pipeline; sampler seats carry is_free_sampler = TRUE and
// live in their own seat_index range (101..103) so they never collide with the
// paid pass's 1..5. Provisioned by papic_provision_sampler() (migration
// 20270103000000). FREE entitlement — never zeroes the paid PAPIC_SEATS ₱2,999.
export const PAPIC_SAMPLER_SERVICE_KEY = 'PAPIC_SEATS_FREE';
export const PAPIC_SAMPLER_SEAT_COUNT = 3;
export const PAPIC_SAMPLER_PHOTO_CAP = 8; // per seat
export const PAPIC_SAMPLER_CLIP_CAP = 2; // per seat
export const PAPIC_SAMPLER_RETENTION_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────
// Seat rows — the read shape + provisioning helpers. The paparazzi_seats
// table (migration 20260520015000) is RLS couple-only for direct reads, so
// these run behind the couple's auth on the add-on page (the RLS client) OR
// behind the admin client in a server action that has already verified the
// caller is a couple on the event.
// ─────────────────────────────────────────────────────────────────────────

export type PapicSeatRow = {
  seat_id: string;
  seat_index: number;
  claim_qr_token: string;
  claimer_user_id: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
  is_free_sampler: boolean;
};

/**
 * Fetch this event's paparazzi seats, ordered by seat_index. Runs behind the
 * couple's RLS session (the add-on page). Graceful-degrade to [] on a
 * missing/legacy table so the page shows the provisioning prompt rather than
 * crashing.
 */
export async function fetchPapicSeats(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicSeatRow[]> {
  return fetchSeatRows(supabase, eventId, false);
}

/**
 * Fetch this event's FREE SAMPLER seats (is_free_sampler = TRUE). Same graceful-
 * degrade as fetchPapicSeats so a pre-migration DB shows the "start sampler"
 * prompt instead of crashing.
 */
export async function fetchPapicSamplerSeats(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicSeatRow[]> {
  return fetchSeatRows(supabase, eventId, true);
}

async function fetchSeatRows(
  supabase: SupabaseClient,
  eventId: string,
  sampler: boolean,
): Promise<PapicSeatRow[]> {
  const { data, error } = await supabase
    .from('paparazzi_seats')
    .select('seat_id, seat_index, claim_qr_token, claimer_user_id, claimed_at, revoked_at, is_free_sampler')
    .eq('event_id', eventId)
    .eq('is_free_sampler', sampler)
    .order('seat_index', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return [];
    throw new Error(`Failed to read Papic seats: ${error.message}`);
  }

  return (data ?? []) as PapicSeatRow[];
}

/**
 * A short, URL-safe claim token. paparazzi_seats.claim_qr_token is the value
 * the per-seat claim link / QR carries; it must be unguessable and unique.
 * 24 bytes of crypto-random base64url (≈ 32 chars) is plenty of entropy and
 * stays well inside a single QR module budget. Mirrors the entropy posture of
 * the guest qr_token (32-hex) but uses base64url for a shorter string.
 */
export function generateSeatClaimToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa → base64, then make it URL-safe and strip padding.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build the public claim URL for a seat token. The friend opens this on their
 * phone; the route validates the token, asks them to sign in, and binds the
 * seat to their account.
 */
export function papicSeatClaimUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/papic/claim/${encodeURIComponent(token)}`;
}
