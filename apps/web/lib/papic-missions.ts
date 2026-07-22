// lib/papic-missions.ts
//
// Pure types + helpers for Papic Games missions (no DB). The DB wrappers live in
// lib/papic-games.ts; the schema is in the papic_games migrations.

export type PapicMissionType =
  | 'prompt'
  | 'roster'
  | 'video_greeting'
  | 'toast_or_dance'
  | 'vendor_booth'
  | 'face_verified';

export type PapicMissionSource = 'auto' | 'couple' | 'vendor';

export type PapicMissionRow = {
  mission_id: string;
  event_id: string;
  mission_type: PapicMissionType;
  source: PapicMissionSource;
  vendor_id: string | null;
  prompt: string;
  target_guest_id: string | null;
  target_role: string | null;
  approved: boolean;
  is_active: boolean;
  created_at: string;
};

// The guest-facing mission view (from the papic_guest_missions RPC): the live
// mission fields + whether THIS guest has completed it.
export type GuestMissionRow = {
  mission_id: string;
  mission_type: PapicMissionType;
  prompt: string;
  vendor_id: string | null;
  target_guest_id: string | null;
  target_role: string | null;
  completed: boolean;
};

export const MISSION_TYPE_LABELS: Record<PapicMissionType, string> = {
  prompt: 'Prompt',
  roster: 'Roster mission',
  video_greeting: 'Video greeting',
  toast_or_dance: 'Toast or dance',
  vendor_booth: 'Booth mission',
  face_verified: 'Face-verified',
};

// The auto booth-mission prompt (§3.1). Mirrors the SQL in
// ensure_papic_auto_missions so generation + any display read identically.
export function boothMissionPrompt(vendorName: string): string {
  // slice(0, 256) mirrors the SQL's left(vendor_name, 256) so the prompt stays
  // within the papic_missions length(prompt) <= 280 CHECK (identical for the common case).
  return `Get a photo at ${vendorName.slice(0, 256)}'s booth`;
}

// A mission a guest can act on: active AND couple-approved (§3.6 — vendor custom
// copy stays hidden until the couple approves). Pure predicate.
export function isMissionLive(m: Pick<PapicMissionRow, 'is_active' | 'approved'>): boolean {
  return m.is_active && m.approved;
}
