import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSeatClaimToken } from '@/lib/papic-seats';

/**
 * papic-pool-join.ts — the POSTER QR.
 *
 * One QR per event. Anyone scans it, gets a camera, shoots from the shared
 * pool. Owner-locked 2026-08-01, verbatim: **"No limit — first come, first
 * served."** No per-scanner allowance, no camera cap, no host approval.
 *
 * ── WHAT BOUNDS IT, THEN ─────────────────────────────────────────────────────
 * The pool's own fence, and only that. `papic_reserve_event_points_for_seat`
 * fails CLOSED — it refuses the shot that would overshoot the remaining points
 * and returns 0 without touching the ledger. So an unbounded number of cameras
 * can exist and still cannot spend more than the event has. Verified against
 * prod: 50 → 41 after a photo and a clip, an over-spend refused, an exact fit
 * allowed, then the next shot refused.
 *
 * That is the whole safety argument, and it is worth stating plainly because
 * "no limit" sounds like there is no limit. The limit is the purse, not the
 * door.
 *
 * ── WHY THE CAMERA IS MINTED ON POST, NEVER ON GET ───────────────────────────
 * Chat apps, link previewers and search bots fetch a URL the moment it is
 * pasted. If a GET minted the camera, sharing the poster link in a group chat
 * would silently burn cameras (and anonymous auth rows) before a single guest
 * scanned it. The claim path already learned this — `claimPapicSeat` mints its
 * anonymous session only inside the form action — and this follows it exactly.
 */

/**
 * Seat index range for poster-QR cameras.
 *
 * Deliberately clear of every existing range so a poster camera can never be
 * mistaken for one of the others, in a query or by eye:
 *   100–102  free shared-pool cameras (PAPIC_FREE_CAMERA_INDEX_BASE)
 *   110      the free Papic One       (PAPIC_FREE_ONE_CAMERA_INDEX)
 *   200+     paid per-camera extras   (PAPIC_CAMERA_INDEX_BASE)
 *   300+     poster-QR cameras        ← this
 */
export const PAPIC_POOL_JOIN_INDEX_BASE = 300;

/** A poster camera draws the SHARED pool, so it carries the free tier. */
export const PAPIC_POOL_JOIN_TIER = 'free' as const;

/**
 * Mint the event's poster token if it has none, and return it.
 *
 * LAZY on purpose — the migration deliberately backfills nothing. The token is
 * a capability, so it should exist from the moment a host decides to show a
 * poster and never for an event that does not use one.
 *
 * Returns null if the event is missing or the write fails; callers render no QR
 * rather than a broken one.
 */
export async function ensurePapicPoolToken(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!eventId) return null;
  try {
    const { data: row } = await admin
      .from('events')
      .select('papic_pool_token')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!row) return null;

    const existing = (row as { papic_pool_token?: string | null }).papic_pool_token;
    if (typeof existing === 'string' && existing.length > 0) return existing;

    const token = generateSeatClaimToken();
    const { error } = await admin
      .from('events')
      .update({ papic_pool_token: token, papic_pool_token_rotated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      // Only fill an EMPTY token. Two hosts opening the QR page at once would
      // otherwise race and the loser would invalidate a poster the winner may
      // already have printed.
      .is('papic_pool_token', null);
    if (error) return null;

    // Re-read rather than trusting our own write: if the guard above matched
    // nothing (someone else minted first), the token to return is THEIRS.
    const { data: after } = await admin
      .from('events')
      .select('papic_pool_token')
      .eq('event_id', eventId)
      .maybeSingle();
    return (after as { papic_pool_token?: string | null } | null)?.papic_pool_token ?? null;
  } catch {
    return null;
  }
}

/** Rotate the poster token — invalidates every printed copy. Returns the new one. */
export async function rotatePapicPoolToken(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!eventId) return null;
  const token = generateSeatClaimToken();
  const { error } = await admin
    .from('events')
    .update({ papic_pool_token: token, papic_pool_token_rotated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  return error ? null : token;
}

/**
 * Resolve a poster token to its event. SERVICE ROLE only — the scanner is
 * anonymous and has no read on `events`.
 *
 * Rejects a blank/short token before querying so an empty string can never
 * match a row where the column is somehow empty too.
 */
export async function resolvePapicPoolToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ eventId: string; eventName: string | null } | null> {
  const clean = typeof token === 'string' ? token.trim() : '';
  if (clean.length < 16) return null;
  try {
    const { data } = await admin
      .from('events')
      .select('event_id, display_name')
      .eq('papic_pool_token', clean)
      .maybeSingle();
    if (!data) return null;
    return {
      eventId: String((data as { event_id: string }).event_id),
      eventName: (data as { display_name?: string | null }).display_name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Create one poster camera and return its claim token.
 *
 * Each scanner gets their OWN seat — not a shared one — so the per-seat usage
 * ledger, the moderation tools and the "block this camera" control all keep
 * working exactly as they do for a hand-shared claim link. The only thing
 * unbounded is how many seats exist.
 *
 * Picks the next index above the poster base. A race between two simultaneous
 * scanners can collide on that index; the caller retries, and the unique
 * (event_id, seat_index) constraint is what makes the retry correct rather than
 * hopeful.
 */
export async function provisionPoolJoinSeatAdmin(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: highest } = await admin
      .from('paparazzi_seats')
      .select('seat_index')
      .eq('event_id', eventId)
      .gte('seat_index', PAPIC_POOL_JOIN_INDEX_BASE)
      .order('seat_index', { ascending: false })
      .limit(1);

    const next =
      ((highest?.[0] as { seat_index?: number } | undefined)?.seat_index ??
        PAPIC_POOL_JOIN_INDEX_BASE - 1) + 1;

    const claimToken = generateSeatClaimToken();
    const { error } = await admin.from('paparazzi_seats').insert({
      event_id: eventId,
      seat_index: next,
      tier: PAPIC_POOL_JOIN_TIER,
      claim_qr_token: claimToken,
    });
    if (!error) return claimToken;
    // 23505 = unique violation → another scanner took this index. Recompute.
    if ((error as { code?: string }).code !== '23505') return null;
  }
  return null;
}
