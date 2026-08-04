/**
 * FLOOR COMMAND — the coordinator's day-of specialization, decision logic only.
 *
 * The surface is `on-the-day/live/[eventId]/_components/floor-command/`. Four
 * panels: advance the run-of-show · the event QR kit · find-my-seat · the
 * requests inbox. Everything here is pure so the rules can be tested without a
 * database, a camera, or a browser.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ────────────────────────────────
 * The live console already renders `FloorClock` (next-block countdown) and
 * `RunOfShowHeader` (the live timeline) ABOVE this surface. Neither is rebuilt
 * here — a second clock that can disagree with the first is worse than no
 * second clock. What the console does NOT have is the ability to *act*:
 * `page.tsx:294` mounts `RunOfShowHeader` WITHOUT `canAdvance`, so the
 * coordinator can watch the timeline and not touch it. That gap is the delta.
 *
 * ── THE INVARIANT THIS FILE OWES THE DATABASE ──────────────────────────────
 * `nextAdvanceAction` must predict what `advance_schedule_block(p_block_id)`
 * will actually do, because the button's label is written from it. That RPC is
 * strictly sequential: it starts the earliest upcoming block when nothing is
 * live, finishes the live one (lighting the next) when one is, is a no-op on an
 * already-finished block, and refuses to start a second block while one runs.
 * If the RPC's rules change, these must change with them.
 */

import type { RunOfShowBlock, RunState } from './run-of-show';
import { deriveRunOfShow } from './run-of-show';
import type { DelegateArea } from './event-moderators';
import { MAX_RETIME_MINUTES } from './schedule-ros';
import { parsePapicTagScan } from './papic-tag';
import { DEFAULT_EVENT_TZ } from './schedule';

// ─── 1. Advancing the run-of-show ──────────────────────────────────────────

export type AdvanceAction =
  /** Nothing is live yet — this starts the first block. */
  | { kind: 'start'; blockId: string; label: string }
  /** One block is live — this finishes it and lights `nextLabel` (if any). */
  | { kind: 'finish'; blockId: string; label: string; nextLabel: string | null }
  /** Every block has run. Nothing left to advance. */
  | { kind: 'all_done' }
  /** No schedule at all — the couple never built one. */
  | { kind: 'empty' };

/**
 * What one tap of the advance button will do next, mirroring
 * `advance_schedule_block`. Returns the *action*, not a label, so the copy
 * lives with the component and the rule lives here.
 */
export function nextAdvanceAction(
  blocks: readonly RunOfShowBlock[],
  now: Date = new Date(),
): AdvanceAction {
  if (blocks.length === 0) return { kind: 'empty' };

  const state = deriveRunOfShow(blocks, now);

  if (state.current) {
    return {
      kind: 'finish',
      blockId: state.current.block_id,
      label: state.current.label,
      nextLabel: state.next?.label ?? null,
    };
  }

  // Nothing live. The RPC starts the earliest UPCOMING block by
  // (sort_order, start_at) — `deriveRunOfShow` surfaces that as `next`.
  if (state.next) {
    return { kind: 'start', blockId: state.next.block_id, label: state.next.label };
  }

  // No live block and nothing upcoming: everything has run.
  return { kind: 'all_done' };
}

/** Blocks that still have to happen — the "N left" readout. */
export function remainingBlockCount(blocks: readonly RunOfShowBlock[]): number {
  return blocks.filter((b) => b.run_state !== ('done' satisfies RunState)).length;
}

// ─── 2. Pushing the schedule ───────────────────────────────────────────────

/** The presets the floor actually uses. Anything finer is a couple-side edit. */
export const RETIME_PRESETS: readonly number[] = [5, 10, 15, 30];

export type RetimeCheck =
  | { ok: true; minutes: number }
  | { ok: false; reason: 'not_an_integer' | 'zero' | 'too_large' };

/**
 * Validate a delay before it reaches `computeRetimePatches`, which THROWS on
 * bad input. Same bounds as the pure retime math (±12h) so the two can never
 * disagree about what is acceptable.
 */
export function checkRetime(minutes: unknown): RetimeCheck {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes)) {
    return { ok: false, reason: 'not_an_integer' };
  }
  if (minutes === 0) return { ok: false, reason: 'zero' };
  if (Math.abs(minutes) > MAX_RETIME_MINUTES) return { ok: false, reason: 'too_large' };
  return { ok: true, minutes };
}

// ─── 3. Find-my-seat ───────────────────────────────────────────────────────

/**
 * What a scan turned out to be, BEFORE any lookup. Distinguishing a table sign
 * from a guest card matters: both are Setnayan QRs and both are printed by the
 * same pack, so a coordinator will scan the wrong one, and "unreadable" would
 * be a lie that sends them hunting for a camera problem.
 */
export type ScanKind =
  | { kind: 'guest'; token: string }
  | { kind: 'table'; ref: string }
  | { kind: 'unreadable' };

export function classifyScan(raw: string | null | undefined): ScanKind {
  const scan = parsePapicTagScan(raw ?? '');
  if (!scan) return { kind: 'unreadable' };
  return scan.kind === 'guest'
    ? { kind: 'guest', token: scan.token }
    : { kind: 'table', ref: scan.ref };
}

/** What the server's seat lookup can come back with. */
export type SeatLookupResult =
  | { found: true; tableLabel: string | null }
  | { found: false };

export type SeatScanOutcome =
  | { kind: 'seated'; tableLabel: string }
  /** The guest is on this event's list but has no seat on the published plan. */
  | { kind: 'unseated' }
  /** A valid Setnayan guest QR, but not for THIS event. */
  | { kind: 'not_this_event' }
  /** They scanned a table sign. Tell them so, rather than "not found". */
  | { kind: 'table_sign'; ref: string }
  | { kind: 'unreadable' };

/**
 * Fold a scan plus its lookup into the one thing the coordinator sees. Pure, so
 * every branch is testable — including the two that are easy to conflate
 * ("wrong event" vs "no seat yet"), which send the coordinator to different
 * people: the couple for the first, the seating plan for the second.
 */
export function resolveSeatScan(
  scan: ScanKind,
  lookup: SeatLookupResult | null,
): SeatScanOutcome {
  if (scan.kind === 'unreadable') return { kind: 'unreadable' };
  if (scan.kind === 'table') return { kind: 'table_sign', ref: scan.ref };
  if (!lookup || !lookup.found) return { kind: 'not_this_event' };
  const label = lookup.tableLabel?.trim();
  return label ? { kind: 'seated', tableLabel: label } : { kind: 'unseated' };
}

// ─── 3b. Asking the host for access ────────────────────────────────────────

/**
 * The areas a coordinator can ask for, in the order the ask is shown. A subset
 * of `DELEGATE_AREAS` on purpose: mood board and budget are not floor tools,
 * and putting them on a day-of ask invites a host to hand over the budget for
 * no reason. Asking wide is a privacy cost with no operational benefit.
 */
export const FLOOR_REQUESTABLE_AREAS: readonly DelegateArea[] = [
  'seat_plan',
  'schedule',
  'guest_list',
  'vendors',
];

/**
 * Client-safe labels for the askable areas.
 *
 * `lib/event-moderators.ts` is `import 'server-only'` (it mints invitation
 * tokens), so its `DELEGATE_AREA_LABEL` cannot cross into a client component —
 * the type import above is erased at compile time, but a runtime value would
 * break the build. These four live here, next to `FLOOR_REQUESTABLE_AREAS`,
 * which is the only list that can use them.
 */
export const FLOOR_AREA_LABEL: Readonly<Record<DelegateArea, string>> = {
  guest_list: 'Guest list',
  seat_plan: 'Seat plan',
  schedule: 'Schedule',
  vendors: 'Vendors',
  invitations: 'Invitations',
  mood_board: 'Mood board',
  budget: 'Budget',
};

export type AreaVerdict = 'granted' | 'declined';

/**
 * Keep only areas that are (a) real, (b) askable from the floor, and (c) not
 * already held — asking for what you already have wastes the host's attention,
 * which is the scarce thing in this flow. Deduped and returned in catalogue
 * order so two identical asks look identical.
 */
export function normalizeRequestedAreas(
  raw: readonly string[] | null | undefined,
  alreadyHeld: Partial<Record<DelegateArea, 'edit' | 'view' | null>> = {},
): DelegateArea[] {
  const asked = new Set(raw ?? []);
  return FLOOR_REQUESTABLE_AREAS.filter(
    (a) => asked.has(a) && !alreadyHeld[a],
  );
}

/**
 * The level an approval grants. `schedule` is the only floor area whose tools
 * WRITE (advance, retime), so it is the only one that needs `edit`; everything
 * else is a read and gets `view`. Granting edit where view suffices is the
 * quiet way permissions creep.
 */
export function grantLevelFor(area: DelegateArea): 'edit' | 'view' {
  return area === 'schedule' ? 'edit' : 'view';
}

export type RequestOutcome = 'all_granted' | 'partly_granted' | 'all_declined' | 'unanswered';

/** How a host's line-by-line answer reads as one sentence. */
export function summarizeDecisions(
  requested: readonly DelegateArea[],
  decisions: Partial<Record<DelegateArea, AreaVerdict>> | null | undefined,
): RequestOutcome {
  if (!decisions || requested.length === 0) return 'unanswered';
  const answered = requested.filter((a) => decisions[a]);
  if (answered.length === 0) return 'unanswered';
  const granted = answered.filter((a) => decisions[a] === 'granted').length;
  if (granted === 0) return 'all_declined';
  // A partial answer counts as partly granted, not as fully granted — the
  // coordinator must not be told they have everything while a line is still
  // open or refused.
  return granted === requested.length ? 'all_granted' : 'partly_granted';
}

// ─── 4. The surface model ──────────────────────────────────────────────────

export type PanelState = 'ready' | 'unavailable';

/**
 * Why a panel is closed. `not_shared` is the one that is NOT a fault: the host
 * simply has not handed this coordinator that area yet, and the fix is to ask
 * them — so the copy for it must read as an errand, never as an error.
 */
export type PanelReason = 'not_shared' | 'not_published' | 'no_schedule' | 'control_off';

/**
 * What the HOST has shared with this coordinator, per area. Owner ruling
 * 2026-07-27: "coordinator will ask for access from the host; host must approve
 * what features they want to share with the vendor." Being booked grants
 * nothing on its own.
 *
 * These come from `event_moderators.permissions_json.areas` via
 * `moderator_area_level` — the delegate mechanism that already ships. This
 * model must never widen them; it only decides what to draw.
 */
export type FloorGrants = {
  /** 'view' is enough to look a seat up; the scanner never writes. */
  seatPlan: 'edit' | 'view' | null;
  /** ACTING on the running order is a write, so 'edit' is required. */
  schedule: 'edit' | 'view' | null;
};

export type FloorCommandModel = {
  schedule: {
    state: PanelState;
    reason: PanelReason | null;
    action: AdvanceAction;
    remaining: number;
    /** Minutes behind (+) or ahead (−) of plan; null when nothing has started. */
    driftMinutes: number | null;
  };
  seatFinder: { state: PanelState; reason: PanelReason | null };
  qrKit: { state: PanelState; reason: PanelReason | null };
  requests: { state: PanelState; reason: PanelReason | null };
  /** True when at least one panel is closed purely for want of a host grant —
   *  the surface uses this to offer "ask the host for access". */
  needsHostAccess: boolean;
};

/**
 * Assemble what the surface renders. All four panels are computed together so
 * a single call describes the whole console — and so "why is this panel not
 * here" always has a named answer instead of an empty div.
 *
 * ORDER OF REASONS MATTERS. A missing host grant is reported BEFORE anything
 * else, because it is the only cause the coordinator can actually do something
 * about, and telling them "the plan isn't published" when the real answer is
 * "you were never given the seat plan" sends them to the wrong person.
 */
export function buildFloorCommand(input: {
  blocks: readonly RunOfShowBlock[];
  grants: FloorGrants;
  seatingPublished: boolean;
  requestsActive: boolean;
  now?: Date;
}): FloorCommandModel {
  const now = input.now ?? new Date();
  // DEFAULT_EVENT_TZ, explicitly: the "N minutes behind" badge is only truthful
  // if the planned wall clock is read at the VENUE. Passed here rather than
  // defaulted inside the derivation, so a caller that ever knows a non-PH venue
  // has an obvious place to say so.
  const state = deriveRunOfShow(input.blocks, now, DEFAULT_EVENT_TZ);
  const action = nextAdvanceAction(input.blocks, now);

  const scheduleShared = input.grants.schedule === 'edit';
  const seatShared = input.grants.seatPlan !== null;

  const schedule = !scheduleShared
    ? { state: 'unavailable' as const, reason: 'not_shared' as const }
    : action.kind === 'empty'
      // An empty schedule is not a broken panel — there is genuinely nothing
      // to advance, and saying so beats a dead button.
      ? { state: 'unavailable' as const, reason: 'no_schedule' as const }
      : { state: 'ready' as const, reason: null };

  const seatPanel: { state: PanelState; reason: PanelReason | null } = !seatShared
    ? { state: 'unavailable', reason: 'not_shared' }
    : !input.seatingPublished
      ? { state: 'unavailable', reason: 'not_published' }
      : { state: 'ready', reason: null };

  return {
    schedule: {
      ...schedule,
      action,
      remaining: remainingBlockCount(input.blocks),
      driftMinutes: state.driftMinutes,
    },
    seatFinder: seatPanel,
    qrKit: seatPanel,
    requests: input.requestsActive
      ? { state: 'ready', reason: null }
      : { state: 'unavailable', reason: 'control_off' },
    needsHostAccess: !scheduleShared || !seatShared,
  };
}
