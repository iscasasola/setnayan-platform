// lib/papic-games.ts
//
// DB wrappers for Papic Games. Flag-gated (papicGamesEnabled) — no-ops when off,
// so nothing runs until NEXT_PUBLIC_PAPIC_GAMES_V1 is set. The RPC + tables live
// in the papic_games migrations.

import type { SupabaseClient } from '@supabase/supabase-js';
import { papicGamesEnabled } from './papic-games-flag';
import type { GuestMissionRow, PapicMissionRow } from './papic-missions';

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
