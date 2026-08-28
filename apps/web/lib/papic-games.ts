// lib/papic-games.ts
//
// DB wrappers for Papic Games. Flag-gated (papicGamesEnabled) — no-ops when off,
// so nothing runs until NEXT_PUBLIC_PAPIC_GAMES_V1 is set. The RPC + tables live
// in the papic_games migrations.

import type { SupabaseClient } from '@supabase/supabase-js';
import { papicGamesEnabled } from './papic-games-flag';
import type {
  GuestMissionRow,
  VendorChallengeRow,
  VendorChallengePhotoRow,
} from './papic-missions';

// Idempotently generate the FREE booth missions for an event's booked vendors
// (spec §3.1). Returns the number created. No-op (0) when the flag is off.
// NOTE: on the guest path this is now called INTERNALLY by ensure_papic_board;
// couple/coordinator surfaces may still call it directly.
export async function ensureAutoMissions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  if (!papicGamesEnabled()) return 0;
  // The RPC isn't in the generated Supabase types yet — `as never` escape hatch (repo pattern).
  const { data, error } = await supabase.rpc('ensure_papic_auto_missions' as never, {
    p_event_id: eventId,
  } as never);
  if (error) return 0; // fail-soft: a missing mission must never break the capture surface
  return typeof data === 'number' ? data : 0;
}

// Idempotently materialize + rank the §9 20-slot board (couple ≤10 + vendor ≤5 +
// Setnayan backfill). Supersedes ensureAutoMissions on the guest path —
// ensure_papic_board calls ensure_papic_auto_missions internally, then fills the
// Setnayan lane and assigns board_slot. Returns the number of live slots.
// No-op (0) when the flag is off.
//
// ⚠ ONE ARGUMENT, AND IT USED TO TAKE TWO. The retired Pabati SKU gated library
// row #5; the same migration that retired it re-created this function with a
// single parameter. PostgREST resolves an RPC by its EXACT set of named
// arguments, so passing the old `p_pabati_active` here matches nothing and the
// call is REFUSED, not thrown — the board would silently never materialize.
//
// 🚨 AND THE SAME MIGRATION TOOK THE `authenticated` EXECUTE GRANT WITH IT —
// an unpaired REVOKE, restored by 20271173829027. For the whole planning period
// this call was refused on every render of the couple's own challenge screen.
// Nothing threw and nothing logged, because of the line below.
//
// 🔑 THAT IS WHY THIS NO LONGER RETURNS A BARE NUMBER. `0` was doing two jobs —
// "the board is empty" and "I could not build the board" — and the caller had no
// way to tell them apart, so the screen went on to describe an unbuilt board as
// a FULL one. A refusal now says so, and the caller must decide what to do with
// it. Fail-soft is preserved: nothing here throws, and the capture surface still
// renders on a refusal.
export type PapicBoardBuild = {
  /**
   * TRUE only when the resolver actually ran and answered. FALSE when the RPC
   * was refused, and FALSE when the feature flag is off — in both cases nobody
   * has worked out which challenges reach a guest, which is the only thing a
   * caller may conclude from it.
   */
  resolved: boolean;
  /** Live slots on the board. Meaningless unless `resolved` is true. */
  slots: number;
};

/** A refusal, and the reason it is never a number. Shared so the two failure
 *  paths cannot drift into disagreeing about what "no board" means. */
const BOARD_UNRESOLVED: PapicBoardBuild = { resolved: false, slots: 0 };

export async function ensurePapicBoard(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicBoardBuild> {
  if (!papicGamesEnabled()) return BOARD_UNRESOLVED;
  const { data, error } = await supabase.rpc('ensure_papic_board' as never, {
    p_event_id: eventId,
  } as never);
  // ⚠ SUPABASE DOES NOT THROW — it resolves with `{ error }`. A try/catch around
  // this call is decoration; reading `error` is the only way to know. The board
  // is best-effort by design, so this must not throw either — but a silent
  // return is what hid a permission failure for days, so it is logged.
  if (error) {
    console.warn(
      `[papic-games] board build refused — event=${eventId}: ` +
        `${error.message}${error.code ? ` (${error.code})` : ''}. ` +
        'Guests keep whatever board they already have; the couple is told we ' +
        'could not work it out, never that their board is full.',
    );
    return BOARD_UNRESOLVED;
  }
  return { resolved: true, slots: typeof data === 'number' ? data : 0 };
}

// A guest reads their OWN event's live missions + own completion flags (anon RPC,
// zero-account). Returns [] when the flag is off / on failure.
export async function fetchGuestMissions(
  supabase: SupabaseClient,
  guestId: string,
): Promise<GuestMissionRow[]> {
  if (!papicGamesEnabled()) return [];
  const { data, error } = await supabase.rpc('papic_guest_missions' as never, {
    p_guest_id: guestId,
  } as never);
  if (error || !data) return [];
  return data as unknown as GuestMissionRow[];
}

// A guest records completing a mission + the §4 per-photo share consent. Returns the
// completion id, or null when the flag is off / on failure.
export async function completeMission(
  supabase: SupabaseClient,
  input: { guestId: string; missionId: string; captureId?: string | null; consentToShare?: boolean },
): Promise<string | null> {
  if (!papicGamesEnabled()) return null;
  const { data, error } = await supabase.rpc('papic_complete_mission' as never, {
    p_guest_id: input.guestId,
    p_mission_id: input.missionId,
    p_capture_id: input.captureId ?? null,
    p_consent_to_share: input.consentToShare ?? false,
  } as never);
  if (error) return null;
  return typeof data === 'string' ? data : null;
}

// A guest grants OR withdraws the §4.1 per-vendor share consent on a completed
// mission (the RA 10173 §16 withdrawal path). Returns the effective share state
// (always false for a vendorless mission / on failure / flag off).
export async function setCompletionConsent(
  supabase: SupabaseClient,
  input: { guestId: string; missionId: string; consent: boolean },
): Promise<boolean> {
  if (!papicGamesEnabled()) return false;
  const { data, error } = await supabase.rpc('papic_set_completion_consent' as never, {
    p_guest_id: input.guestId,
    p_mission_id: input.missionId,
    p_consent: input.consent,
  } as never);
  if (error) return false;
  return data === true;
}

// A booked Pro/Enterprise vendor authors a custom challenge (§3.4). Returns a
// tagged result so the caller can distinguish the RPC's RAISE reasons (needs
// Pro / not booked / bad copy) and drive an upsell vs a plain error. `unavailable`
// = the flag is off.
export async function createVendorChallenge(
  supabase: SupabaseClient,
  input: { eventId: string; prompt: string },
): Promise<{ ok: true; missionId: string } | { ok: false; error: string }> {
  if (!papicGamesEnabled()) return { ok: false, error: 'unavailable' };
  const { data, error } = await supabase.rpc('papic_create_vendor_challenge' as never, {
    p_event_id: input.eventId,
    p_prompt: input.prompt,
  } as never);
  if (error) return { ok: false, error: error.message ?? 'failed' };
  if (typeof data !== 'string') return { ok: false, error: 'failed' };
  return { ok: true, missionId: data };
}

// The couple/coordinator approves (true) or rejects (false) a pending vendor
// challenge (§3.6). Returns whether a pending row was actioned.
export async function reviewVendorChallenge(
  supabase: SupabaseClient,
  input: { missionId: string; approve: boolean },
): Promise<boolean> {
  if (!papicGamesEnabled()) return false;
  const { data, error } = await supabase.rpc('papic_review_vendor_challenge' as never, {
    p_mission_id: input.missionId,
    p_approve: input.approve,
  } as never);
  if (error) return false;
  return data === true;
}

// A booked vendor reads their OWN custom challenges for an event + status +
// completion count. Returns [] when the flag is off / on failure.
export async function fetchVendorChallenges(
  supabase: SupabaseClient,
  eventId: string,
): Promise<VendorChallengeRow[]> {
  if (!papicGamesEnabled()) return [];
  const { data, error } = await supabase.rpc('papic_vendor_challenges' as never, {
    p_event_id: eventId,
  } as never);
  if (error || !data) return [];
  return data as unknown as VendorChallengeRow[];
}

// A booked, SPONSORED vendor collects the CONSENTED guest photos from their
// challenges (Phase 5). The RPC applies the consent + strict-moderation gates and
// returns web-copy refs only. Returns [] when the flag is off / on failure.
export async function fetchVendorChallengePhotos(
  supabase: SupabaseClient,
  eventId: string,
): Promise<VendorChallengePhotoRow[]> {
  if (!papicGamesEnabled()) return [];
  const { data, error } = await supabase.rpc('papic_vendor_challenge_photos' as never, {
    p_event_id: eventId,
  } as never);
  if (error || !data) return [];
  return data as unknown as VendorChallengePhotoRow[];
}
