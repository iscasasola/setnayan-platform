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

// §9 adds the 'setnayan' lane (the 40-library auto-fill). Never rename/drop the
// existing three — the DB `source` CHECK was widened to a superset (never-rename lock).
export type PapicMissionSource = 'auto' | 'couple' | 'vendor' | 'setnayan';

export type CaptureKind = 'photo' | 'clip' | 'pabati';

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
// mission fields + whether THIS guest has completed it, and — for a vendor
// mission — the vendor's name (the "Share with <vendor>?" label) and this guest's
// current share state (§4.1). vendor_name is null for couple/generic missions.
export type GuestMissionRow = {
  mission_id: string;
  mission_type: PapicMissionType;
  prompt: string;
  vendor_id: string | null;
  vendor_name: string | null;
  target_guest_id: string | null;
  target_role: string | null;
  completed: boolean;
  consent_shared: boolean;
  // §9 board fields (from the papic_guest_missions v4 reader). source/capture_kind
  // drive the lane badge + the Pabati branch; board_slot is the materialized order
  // (null = off-board completed archive, or pre-board fail-soft).
  source: PapicMissionSource;
  capture_kind: CaptureKind | null;
  library_id: number | null;
  board_slot: number | null;
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

// The guest's own progress across their live missions (§5 — the guest-facing
// "leaderboard" in Phase 3b is a personal progress meter; a cross-guest ranked
// board needs an aggregate RPC and is deferred). Pure, so the panel and any
// server surface count identically.
export function missionProgress(
  missions: readonly Pick<GuestMissionRow, 'completed'>[],
): { done: number; total: number; allDone: boolean } {
  const total = missions.length;
  const done = missions.reduce((n, m) => n + (m.completed ? 1 : 0), 0);
  return { done, total, allDone: total > 0 && done === total };
}

// Order for the guest list: not-yet-done first (there's always something to do at
// the top), then completed. Within each group, by §9 board_slot (the order the
// resolver assigned; NULLS last for off-board completed rows and the pre-board
// fail-soft path). Stable + deterministic — mirrors the v4 reader's ORDER BY, so a
// client re-sort can't disagree with the server board.
export function sortGuestMissions(missions: readonly GuestMissionRow[]): GuestMissionRow[] {
  return [...missions].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    const as = a.board_slot ?? Number.POSITIVE_INFINITY;
    const bs = b.board_slot ?? Number.POSITIVE_INFINITY;
    return as - bs;
  });
}

// ---------------------------------------------------------------------------
// §9 — the 20-slot 3-lane board resolver (couple ≤10 + vendor ≤5 + Setnayan
// backfill to 20).
//
// ⚠ NON-AUTHORITATIVE. The DB function `ensure_papic_board` is the ONE source of
// truth (it writes board_slot; the guest reader is a dumb ORDER BY board_slot).
// This mirror exists ONLY for unit tests + the couple-side preview. It must model
// the SAME algorithm so a divergence is a test failure, but it MUST NOT become a
// second selector on a live path — the preview reads materialized board_slot rows.
// ---------------------------------------------------------------------------

export const BOARD_SIZE = 20;
export const COUPLE_SLOTS = 10;
export const VENDOR_SLOTS = 5;

// A library challenge as the resolver sees it (a papic_challenge_library row).
export type ChallengeLibraryItem = {
  libraryId: number;
  priorityRank: number | null; // §9.4 Top-10 (1..10); null = not a guaranteed hero.
  captureKind: CaptureKind;
  missionType: PapicMissionType;
  isActive: boolean;
};

// A live couple-lane pick (source='couple'). libraryId null = create-your-own.
// Caller pre-orders by created_at,id (mirrors the SQL couple-lane ordering).
export type CouplePick = { key: string; libraryId: number | null };

// A vendor-lane mission: paid=source'vendor' (approved) vs booth=source'auto'.
// Caller passes only LIVE + currently-BOOKED ones, pre-ordered by created_at,id.
export type VendorLaneMission = { key: string; paid: boolean };

export type BoardResolverInput = {
  couplePicks: readonly CouplePick[];
  vendorMissions: readonly VendorLaneMission[];
  library: readonly ChallengeLibraryItem[];
  vetoedLibraryIds?: readonly number[]; // couple-hidden Setnayan tombstones (veto wins → backfill).
  pabatiActive?: boolean; // server-computed; default false = fail-closed (skip Pabati, backfill).
};

export type BoardEntry =
  | { slot: number; lane: 'couple'; key: string; libraryId: number | null }
  | { slot: number; lane: 'vendor'; key: string }
  | { slot: number; lane: 'setnayan'; libraryId: number };

function rankKey(r: number | null): number {
  return r == null ? Number.POSITIVE_INFINITY : r; // NULLS LAST, mirroring the SQL ORDER BY.
}

export function resolveChallengeBoard(input: BoardResolverInput): BoardEntry[] {
  const pabatiActive = input.pabatiActive ?? false;
  const vetoed = new Set(input.vetoedLibraryIds ?? []);

  // 1) Couple lane — cap at COUPLE_SLOTS (input already ordered created_at,id).
  const coupleUsedList = input.couplePicks.slice(0, COUPLE_SLOTS);

  // Taken = EVERY live couple pick's library id (even off-board ones), mirroring
  // the SQL NOT EXISTS over all couple rows — a Setnayan fill never duplicates a
  // couple pick.
  const taken = new Set<number>();
  for (const p of input.couplePicks) if (p.libraryId != null) taken.add(p.libraryId);

  // 2) Vendor lane — PAID (source='vendor') before FREE booth (source='auto'),
  // stable within each group, cap at VENDOR_SLOTS. A free booth can never evict a
  // ₱400-paid slot.
  const paid = input.vendorMissions.filter((v) => v.paid);
  const booth = input.vendorMissions.filter((v) => !v.paid);
  const vendorUsedList = [...paid, ...booth].slice(0, VENDOR_SLOTS);

  // 3) Setnayan lane — backfill the remainder to BOARD_SIZE by priority_rank then
  // library order, skipping taken/vetoed/inactive, Pabati only when active.
  const target = BOARD_SIZE - coupleUsedList.length - vendorUsedList.length;
  const setnayanUsedList =
    target > 0
      ? input.library
          .filter(
            (l) =>
              l.isActive &&
              l.missionType !== 'face_verified' &&
              (l.captureKind !== 'pabati' || pabatiActive) &&
              !taken.has(l.libraryId) &&
              !vetoed.has(l.libraryId),
          )
          .slice()
          .sort((a, b) => rankKey(a.priorityRank) - rankKey(b.priorityRank) || a.libraryId - b.libraryId)
          .slice(0, target)
      : [];

  // Assign sequential slots: couple → vendor → Setnayan.
  const board: BoardEntry[] = [];
  let slot = 0;
  for (const p of coupleUsedList) board.push({ slot: ++slot, lane: 'couple', key: p.key, libraryId: p.libraryId });
  for (const v of vendorUsedList) board.push({ slot: ++slot, lane: 'vendor', key: v.key });
  for (const l of setnayanUsedList) board.push({ slot: ++slot, lane: 'setnayan', libraryId: l.libraryId });
  return board;
}

// §2.2 minor-safety UX pre-check — mirrors the authoritative DB trigger
// (papic_missions_prompt_guard). Returns true if the free-text prompt is BLOCKED
// (drinking dares / unsafe prompts). Defense-in-depth: the DB trigger is the real
// gate; this only spares the couple a round-trip. Not a complete solution (owner
// accepted the residual 2026-07-23).
const BLOCKED_PROMPT_RE =
  /\b(alcohol|tequila|vodka|whiskey|whisky|rum|gin|brandy|beer|liquor|shots?|chug|booze|drunk|strip)\b|get\s+drunk|body\s+shot|down\s+your\s+drink|take\s+(it|them)\s+off|remove\s+your\s+(clothes|top|shirt)|kiss\s+a\s+stranger/i;

export function isChallengePromptBlocked(prompt: string): boolean {
  return BLOCKED_PROMPT_RE.test(prompt);
}

// A vendor's own custom challenge for an event (from the papic_vendor_challenges
// RPC): the copy + its approval/active status + a completion count (a non-PII
// aggregate — the photos themselves stay DPO-gated in a later phase).
export type VendorChallengeRow = {
  mission_id: string;
  prompt: string;
  approved: boolean;
  is_active: boolean;
  created_at: string;
  completions: number;
};

// A consented guest capture delivered to a sponsoring vendor (from the
// papic_vendor_challenge_photos RPC, Phase 5). WEB-COPY refs only — never the
// geo-bearing original; the caller presigns them.
export type VendorChallengePhotoRow = {
  capture_id: string;
  mission_id: string;
  prompt: string;
  media_type: 'photo' | 'clip';
  display_r2_key: string | null;
  thumb_r2_key: string | null;
  poster_r2_key: string | null;
  clip_web_r2_key: string | null;
  captured_at: string;
};

// The lifecycle a vendor sees for their custom challenge (§3.6): pending the
// couple's tap → live once approved → rejected if the couple declined it (the
// review RPC deactivates a rejected row, leaving approved=false). Pure.
export type VendorChallengeStatus = 'pending' | 'live' | 'rejected';
export function vendorChallengeStatus(
  c: Pick<VendorChallengeRow, 'approved' | 'is_active'>,
): VendorChallengeStatus {
  if (!c.is_active) return 'rejected';
  return c.approved ? 'live' : 'pending';
}
