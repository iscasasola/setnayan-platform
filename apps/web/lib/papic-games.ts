// lib/papic-games.ts
//
// DB wrappers for Papic Games. Flag-gated (papicGamesEnabled) — no-ops when off,
// so nothing runs until NEXT_PUBLIC_PAPIC_GAMES_V1 is set. The RPC + tables live
// in the papic_games migrations.

import type { SupabaseClient } from '@supabase/supabase-js';
import { papicGamesEnabled } from './papic-games-flag';
import type {
  GuestMissionRow,
  PapicMissionRow,
  VendorChallengeRow,
} from './papic-missions';

// Idempotently generate the FREE booth missions for an event's booked vendors
// (spec §3.1). Returns the number created. No-op (0) when the flag is off.
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

// Read an event's LIVE missions (RLS-scoped to the caller). Returns [] when the flag is off.
export async function fetchEventMissions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicMissionRow[]> {
  if (!papicGamesEnabled()) return [];
  const { data, error } = await supabase
    .from('papic_missions')
    .select(
      'mission_id,event_id,mission_type,source,vendor_id,prompt,target_guest_id,target_role,approved,is_active,created_at',
    )
    .eq('event_id', eventId)
    .eq('is_active', true)
    .eq('approved', true)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as unknown as PapicMissionRow[];
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
