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

/**
 * HOW MANY CHALLENGES A GUEST IS GIVEN.
 *
 * Owner, 2026-08-21: *"we keep the 600+ challenges but the user only picks 10."*
 * The LIBRARY is 631 and stays 631 — that is what the couple chooses FROM. This
 * is what any one guest is handed on the night, and it went 20 → 10.
 *
 * 🔑 THE TWO NUMBERS ARE NOT THE SAME THING, AND CONFLATING THEM IS THE ERROR
 * THIS COMMENT EXISTS TO PREVENT. A big library makes the picking good; a small
 * board makes the doing good. Twenty asks reads as a chore list, spends twice as
 * much of the shared shot pool per guest, and — now that answers become part of
 * the couple's story — produces twice as much for somebody to sit through.
 */
export const BOARD_SIZE = 10;

/**
 * HOW MANY OF THOSE A SUPPLIER MAY HOLD.
 *
 * ⚠ DERIVED, NOT RE-CHOSEN. This was a flat 5 while the board was 20 — a
 * quarter of it. Halving the board and leaving this at 5 would have silently
 * sold HALF of every guest's challenges: a commercial change nobody made, and
 * five booth missions out of ten is an advertisement with a party attached.
 *
 * `floor(BOARD_SIZE / 4)` reproduces the shipped 5 exactly at 20 and gives 2 at
 * 10 — the same one-quarter share the board has always had. A proportion that
 * was already agreed, not a new decision taken quietly while nobody looked.
 * ⏭ If the owner wants a different share, this is the single line to change.
 */
export const VENDOR_SLOTS = Math.floor(BOARD_SIZE / 4);

/**
 * THE COUPLE MAY TAKE THE WHOLE BOARD, MINUS WHATEVER IS ALREADY SOLD.
 *
 * Owner, 2026-08-21: *"the need to have a real screen to pick their challenges
 * up to 20 challenges"* — then, the same day, *"we keep the 600+ challenges but
 * the user only picks 10."* The ceiling is therefore the BOARD, whatever the
 * board currently is, rather than any number typed here: it followed 20 down to
 * 10 without this function changing at all, which is the point of deriving it.
 *
 * ⚠ IT IS A FUNCTION, NOT A CONSTANT, AND THE VENDOR COUNT COMES FIRST. A booth
 * mission is something a supplier PAID for. A flat 20 makes the Setnayan
 * target go NEGATIVE the moment one exists (20 - 20 - 5 = -5), and — worse than
 * the arithmetic — it would delete a paid placement the instant the couple added
 * a twentieth of their own, silently. Today this returns exactly 20, because
 * production holds zero sponsorships.
 *
 * Mirrors `LEAST(COUNT(*), 10 - v_vendor_used)` in `ensure_papic_board`
 * (migration 20271155952591, narrowed to 10 by the migration that follows it).
 * The SQL is authoritative; this is the preview.
 */
export function coupleSlots(vendorUsed: number): number {
  return Math.max(0, BOARD_SIZE - Math.min(vendorUsed, VENDOR_SLOTS));
}

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

  // 1) Vendor lane is SIZED FIRST now, because the couple's ceiling depends on
  // it — a paid booth mission keeps its slot and the couple's twenty is
  // "everything not already sold". Its MEMBERS are still chosen in step 2.
  const vendorEligible = input.vendorMissions.length;

  // 2) Couple lane — up to the whole board minus what is sold (input already
  // ordered created_at,id).
  const coupleUsedList = input.couplePicks.slice(0, coupleSlots(vendorEligible));

  // Taken = EVERY live couple pick's library id (even off-board ones), mirroring
  // the SQL NOT EXISTS over all couple rows — a Setnayan fill never duplicates a
  // couple pick.
  const taken = new Set<number>();
  for (const p of input.couplePicks) if (p.libraryId != null) taken.add(p.libraryId);

  // 2b) Vendor lane members — PAID (source='vendor') before FREE booth (source='auto'),
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

// ── The {who} side token ───────────────────────────────────────────────────
// The story challenges (library 41–44, owner 2026-08-10) store their prompt
// with a `{who}` placeholder so the same board row can ask a bride-side guest
// about THE BRIDE and a groom-side guest about THE GROOM. The substitution that
// matters is done in SQL, per guest, by papic_guest_missions — that reader is
// the only place that knows which guest is asking, because the board itself is
// per EVENT and one row serves the whole wedding.
//
// 🔑 THIS HELPER IS FOR EVERY OTHER SCREEN. The couple's manager, the vendor
// approval list and the vendor's delivered-photos page all read
// papic_missions.prompt DIRECTLY out of the table, never through that reader —
// so without this they render a literal "{who}" at the couple. None of those
// readers has a side to resolve (the couple is not a side), so they get the
// neutral wording, which is the one phrasing that is never wrong.
//
// A prompt with no token is returned unchanged, so this is a safe no-op on all
// 40 shipped challenges and on every couple- or vendor-authored prompt. Call it
// at the RENDER site rather than filtering on "is this a story challenge" — the
// token is the only thing that decides, and a new tokenised prompt then needs
// no second edit here.
export const CHALLENGE_SIDE_TOKEN = '{who}';
export const CHALLENGE_SIDE_NEUTRAL = 'the couple';

// ── The {host} / {hosts} / {event} tokens (2026-08-21) ─────────────────────
// The 500-challenge pool is written for every event type, so most of it names
// whoever is throwing this one rather than a bride and groom. Resolved per
// EVENT from `event_type_profiles.terminology` — the same block the guest tree's
// own vocabulary reads, so a birthday's Papic board and a birthday's seating
// page finally say "the celebrant" together.
//
// ⚠ THE NEUTRAL FALLBACKS ARE NOT A CONVENIENCE, THEY ARE THE FAILURE MODE.
// Every caller of this helper may not have the event's words to hand — a vendor
// looking at a challenge they sponsored is three tables away from the event
// type. "the host" and "event" are plain, and plain is never WRONG; a raw
// "{host}" on a screen is a visible defect and a bride-and-groom guess at a
// graduation is worse than either.
export const CHALLENGE_HOST_TOKEN = '{host}';
export const CHALLENGE_HOST_POSSESSIVE_TOKEN = '{hosts}';
export const CHALLENGE_EVENT_TOKEN = '{event}';
export const CHALLENGE_HOST_NEUTRAL = 'the host';
export const CHALLENGE_EVENT_NEUTRAL = 'event';

/** The words a caller can supply. Anything missing falls back to neutral. */
export type ChallengeWords = {
  /** Bare noun — 'couple' · 'celebrant' · 'graduate' · 'host'. */
  organizer?: string | null;
  /** 'wedding' · 'birthday' · 'graduation' · 'event'. */
  eventWord?: string | null;
};

/** The typographic apostrophe the product writes everywhere. Never `'`. */
const APOSTROPHE = '\u2019';

export function displayChallengePrompt(prompt: string, words?: ChallengeWords): string {
  const organizer = words?.organizer?.trim();
  const host = organizer ? `the ${organizer}` : CHALLENGE_HOST_NEUTRAL;
  // A noun already ending in s takes the bare mark ("parents’", never
  // "parents’s"). No seeded value ends in s today; one added later would
  // otherwise read wrong on every prompt at once.
  const hosts = host.endsWith('s') ? `${host}${APOSTROPHE}` : `${host}${APOSTROPHE}s`;
  const eventWord = words?.eventWord?.trim() || CHALLENGE_EVENT_NEUTRAL;

  // 🔑 {hosts} IS REPLACED BEFORE {host}. The other order turns "{hosts}" into
  // "the couple}s" — the shorter needle matches inside the longer token and
  // eats its opening brace. The SQL reader replaces them in the same order for
  // the same reason; a test pins both.
  return prompt
    .split(CHALLENGE_SIDE_TOKEN)
    .join(CHALLENGE_SIDE_NEUTRAL)
    .split(CHALLENGE_HOST_POSSESSIVE_TOKEN)
    .join(hosts)
    .split(CHALLENGE_HOST_TOKEN)
    .join(host)
    .split(CHALLENGE_EVENT_TOKEN)
    .join(eventWord);
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
