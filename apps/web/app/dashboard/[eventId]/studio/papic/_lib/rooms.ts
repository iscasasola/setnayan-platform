import { captureWindowState } from '@/lib/papic-window';

/**
 * ⚠ WHICH ROOM THE PAPIC PAGE OPENS ON.
 *
 * The couple's Papic page was twenty cards in one vertical scroll — set-up
 * choices they make once, the cameras they run on the day, and the gallery they
 * come back to for years, all interleaved in one column. The owner walked it on
 * 2026-08-10: *"not integrated and simplified… we want to avoid having to scroll
 * to access this."*
 *
 * It is now three rooms. This module decides which one a request lands on, and
 * it is PURE so the decision is unit-testable without rendering a page.
 *
 * 🔑 THE PHASE ALREADY SHIPPED — this invents nothing. `captureWindowState`
 * (lib/papic-window.ts) already returns exactly the three states the landing
 * rule needs, because it is the same question the capture path asks before
 * accepting a shot: has the window started, is it open, has it closed.
 */

export const PAPIC_ROOMS = ['photos', 'cameras', 'setup'] as const;
export type PapicRoom = (typeof PAPIC_ROOMS)[number];

function isRoom(value: unknown): value is PapicRoom {
  return typeof value === 'string' && (PAPIC_ROOMS as readonly string[]).includes(value);
}

/**
 * ⚠ THE ROOM AN OUTCOME BELONGS TO — read from the URL the action already built.
 *
 * Every server action on this page finishes by redirecting back with an outcome
 * in the query string (`?style_set=1`, `?papic_pool_error=…`). There are ~95
 * such redirects across four files, and not one of them carries a room.
 *
 * 🔑 SO THE ROOM IS DERIVED FROM THE OUTCOME, NOT ADDED TO 95 REDIRECTS. Editing
 * ninety-five call sites is ninety-five chances to miss one silently, and a
 * missed one lands the couple in a room where their confirmation is nowhere to
 * be seen. This function cannot be half-applied: it either maps an outcome or it
 * does not, and every outcome is listed in one place where a reader can check.
 *
 * Returns null when nothing in the query says anything about a room.
 */
export function roomForOutcome(params: Record<string, unknown>): PapicRoom | null {
  const has = (key: string) => params[key] !== undefined && params[key] !== null;

  // Set up — storage, the Drive connection, the capture window, and the
  // once-only choices.
  if (
    has('drive_connected') ||
    has('drive_disconnected') ||
    has('drive_error') ||
    has('papic_window_saved') ||
    has('papic_window_error') ||
    // ⚠ THIS COMMENT USED TO SAY THESE NINE "SAVE IN SILENCE". THAT IS NO
    // LONGER TRUE AND HAS NOT BEEN FOR SOME TIME — every one of them is in the
    // page's searchParams type and `StatusBanners` renders a plain-English
    // confirmation for each. The stale sentence outlived its defect and was
    // read as current on 2026-08-26, which cost a round trip with the owner.
    // 🔑 A COMMENT IS NOT EVIDENCE: check the reader before repeating it.
    //
    // `quality_*` and `storage_*` are gone from this map entirely — the two
    // questions they confirmed were deleted on 2026-08-26 (owner: photo
    // quality is already right by default, and "where your photos go" was a
    // choice no capture path ever read).
    has('style_set') ||
    has('style_error') ||
    // ⚠ NOT A STORAGE ERROR, AND NOT REALLY A ROOM. `papic_access_error` is the
    // SHARED couple-check refusal — every action in this tree redirects here
    // when the caller is not a couple on the event. It is mapped anyway because
    // the invariant is "every outcome an action emits has a room", and an
    // unmapped one is indistinguishable from a forgotten one. Set up is the
    // default landing, so a refusal lands where a stranger would have started.
    // The banner itself renders ABOVE the room branch, so which room resolves
    // does not change whether they see it.
    has('papic_access_error') ||
    has('faceTagging')
  ) {
    return 'setup';
  }

  // Photos — what the couple can see and who else can see it.
  if (
    has('showcase_set') ||
    has('showcase_error') ||
    has('vendorMedia') ||
    // Preservation is chosen from the gallery, so its answer belongs there.
    has('preserve_set') ||
    has('preserve_error')
  ) {
    return 'photos';
  }

  // Cameras & shots — anything about money, cameras or the pool.
  if (
    has('papic_purchased') ||
    has('papic_ref') ||
    has('papic_amount') ||
    has('papic_error') ||
    has('papic_one_error') ||
    has('papic_pool_error') ||
    // Handing shots to one camera's QR, and taking unspent ones back
    // (owner 2026-08-11). Lands in the same room as everything else about
    // shots — the card that reports these sits beside the one that sells them.
    has('shots_error') ||
    has('shots_set') ||
    has('papic_unlock_provisioned') ||
    has('limited_synced') ||
    has('limited_error') ||
    has('guestCameras')
  ) {
    return 'cameras';
  }

  return null;
}

/**
 * The room to open, in precedence order:
 *
 *   1. an explicit, valid `?tab=` — the couple clicked a tab, honour it
 *   2. the outcome already in the URL — they just saved something; show them
 *      where it happened
 *   3. where they are in the event
 *
 * ⚠ THE NULL-WINDOW BRANCH COMES FIRST, AND IT IS NOT A DUPLICATE OF THE
 * `not_started` CASE. `captureWindowState` FAILS OPEN on absent bounds — a
 * deliberate posture, because a legacy seat with no window must never be bricked
 * mid-party. Correct there, wrong here: an event whose window was never set
 * would read `open` and land the couple in Cameras, with no hint that the one
 * thing stopping every camera is a date they have not picked. Unset means Set
 * up, where the attention row is.
 */
export function resolvePapicRoom(opts: {
  requested?: unknown;
  outcomes?: Record<string, unknown>;
  windowStart?: string | null;
  windowEnd?: string | null;
  nowMs?: number;
}): PapicRoom {
  if (isRoom(opts.requested)) return opts.requested;

  const fromOutcome = opts.outcomes ? roomForOutcome(opts.outcomes) : null;
  if (fromOutcome) return fromOutcome;

  if (!opts.windowStart) return 'setup';

  switch (captureWindowState(opts.windowStart, opts.windowEnd, opts.nowMs)) {
    case 'not_started':
      return 'setup';
    case 'open':
      return 'cameras';
    case 'closed':
      return 'photos';
  }
}

/** Tab labels, in the order they are shown. */
export const PAPIC_ROOM_TABS: ReadonlyArray<{ room: PapicRoom; label: string }> = [
  { room: 'photos', label: 'Photos' },
  { room: 'cameras', label: 'Cameras & shots' },
  { room: 'setup', label: 'Set up' },
];
