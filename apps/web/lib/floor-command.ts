/**
 * FLOOR COMMAND — the decision core behind the coordinator day-of
 * specialization (`VendorSpecializationSet = 'floor_command'`).
 *
 * WHY A PURE MODULE. Same reason as `lib/stage-script.ts` and
 * `lib/vendor-dayof-frame.ts`: the interesting part is a DECISION — "do I move
 * the show along, or clear something first?" — and a decision is only
 * trustworthy if a test can hold it down. The surface is a renderer over
 * {@link buildFloorCommand}.
 *
 * ── WHAT THIS ADDS, AND WHAT IT REFUSES TO REBUILD ─────────────────────────
 *
 * Almost everything a coordinator needs already ships. This module crosses two
 * shipped facts that have never been crossed, and adds nothing else:
 *
 *   ✗ the inbox itself — `_components/requests-inbox.tsx`, already
 *     coordinator-aware by construction ("the booked COORDINATOR sees every
 *     lane and triages"), reached through `IssuesLog`'s local-log fallback.
 *   ✗ sorting / summarising / triage rules — `lib/day-requests.ts`
 *     (`summarizeInbox`, `sortInbox`, `countsAsOpenWork`, `nextStatus`).
 *     Imported, never re-derived.
 *   ✗ now / next / drift — `lib/run-of-show.ts` (`deriveRunOfShow`,
 *     `driftLabel`), the same derivation the realtime header and the host's
 *     cue card already read from.
 *   ✓ THE CROSS — open work × where the show actually is. Nothing in the app
 *     relates the two today, and it is the one judgement a coordinator makes
 *     over and over on a floor: the show is 20 minutes behind and four things
 *     are unresolved — do I push, or do I fix?
 *
 * ── WHY THE ADVICE IS "CLEAR FIRST" WHEN LATE, NOT "HURRY UP" ──────────────
 *
 * Running late is the state in which pushing is most tempting and most
 * expensive: every unresolved request is a supplier waiting on an answer, and
 * advancing past them converts a late show into a broken one. So lateness
 * RAISES the bar for advancing rather than lowering it. On time with nothing
 * open, the advice is simply to go.
 *
 * ── ADVANCING IS NOT A LOCAL ACTION ────────────────────────────────────────
 *
 * `advance_schedule_block` moves `run_state`, and `run_state` is what every
 * other screen follows — the guest "what's happening now" card, the realtime
 * header, and the host/MC cue card (`lib/stage-script.ts`) which says "You're
 * on: <block>" purely from this pointer. A coordinator tapping advance is
 * cueing the emcee. {@link FloorCommandModel.advanceMovesOthers} carries that
 * so the surface can say it out loud, because a control whose blast radius is
 * invisible is a control people are afraid to use.
 */

import {
  summarizeInbox,
  countsAsOpenWork,
  type DayRequestRow,
} from '@/lib/day-requests';
import {
  deriveRunOfShow,
  driftLabel,
  type RunOfShowBlock,
} from '@/lib/run-of-show';

/** What the coordinator should do next. */
export type FloorAdvice =
  /** Nothing has been started — the show has not begun. */
  | 'not_started'
  /** A block is live and nothing is blocking — move when ready. */
  | 'clear_to_advance'
  /** Behind schedule with unresolved work — fix before pushing. */
  | 'clear_work_first'
  /** Between moments: nothing live, but the run is under way. */
  | 'holding'
  /** Every block done. */
  | 'wrapped'
  /** No timeline at all. */
  | 'no_timeline';

export type FloorCommandModel = {
  advice: FloorAdvice;
  /** The single sentence the coordinator reads first. Always present. */
  headline: string;
  /** Unresolved issues + requests — the badge number. Status pings excluded. */
  openWork: number;
  /** Status pings, surfaced separately and never counted as work. */
  statusUpdates: number;
  /** The block that is live now, if any. */
  currentLabel: string | null;
  /** The next upcoming block, if any. */
  nextLabel: string | null;
  /** "12 min behind" / "on time" — from the shared `driftLabel`. */
  drift: string | null;
  /** True when the show is measurably behind its plan. */
  behind: boolean;
  /** There is a live block, so an advance would do something. */
  canAdvanceNow: boolean;
  /** The block id an advance would act on, or null. */
  advanceBlockId: string | null;
  /**
   * Advancing moves OTHER people's screens too (guest cards, the realtime
   * header, the host/MC cue card). True whenever an advance is possible —
   * the surface says so rather than leaving the blast radius invisible.
   */
  advanceMovesOthers: boolean;
};

/** Minutes behind beyond which "late" is worth acting on rather than noting. */
export const BEHIND_THRESHOLD_MINUTES = 5;

export function buildFloorCommand(input: {
  /** The day-of requests stream, as the inbox already reads it. */
  rows: readonly DayRequestRow[];
  /** The run of show — the same rows the realtime header reads. */
  blocks: readonly RunOfShowBlock[];
  now?: Date;
}): FloorCommandModel {
  const now = input.now ?? new Date();
  const summary = summarizeInbox(input.rows);
  const run = deriveRunOfShow(input.blocks, now);

  const behind =
    run.driftMinutes !== null && run.driftMinutes >= BEHIND_THRESHOLD_MINUTES;

  const currentLabel = run.current?.label ?? null;
  const nextLabel = run.next?.label ?? null;
  const canAdvanceNow = run.current !== null;

  const advice = pickAdvice({
    hasBlocks: input.blocks.length > 0,
    allDone: run.allDone,
    notStarted: run.notStarted,
    live: run.current !== null,
    behind,
    openWork: summary.openWork,
  });

  return {
    advice,
    headline: headlineFor(advice, {
      currentLabel,
      nextLabel,
      openWork: summary.openWork,
      drift: driftLabel(run.driftMinutes),
    }),
    openWork: summary.openWork,
    statusUpdates: summary.statusUpdates,
    currentLabel,
    nextLabel,
    drift: driftLabel(run.driftMinutes),
    behind,
    canAdvanceNow,
    advanceBlockId: run.current?.block_id ?? null,
    advanceMovesOthers: canAdvanceNow,
  };
}

function pickAdvice(s: {
  hasBlocks: boolean;
  allDone: boolean;
  notStarted: boolean;
  live: boolean;
  behind: boolean;
  openWork: number;
}): FloorAdvice {
  if (!s.hasBlocks) return 'no_timeline';
  if (s.allDone) return 'wrapped';
  if (s.notStarted) return 'not_started';
  // Behind AND carrying unresolved work is the one state where pushing costs
  // more than it saves — see the module doc.
  if (s.behind && s.openWork > 0) return 'clear_work_first';
  if (s.live) return 'clear_to_advance';
  return 'holding';
}

function headlineFor(
  advice: FloorAdvice,
  ctx: {
    currentLabel: string | null;
    nextLabel: string | null;
    openWork: number;
    drift: string | null;
  },
): string {
  const work = `${ctx.openWork} ${ctx.openWork === 1 ? 'thing' : 'things'} still open`;
  switch (advice) {
    case 'no_timeline':
      return 'No timeline yet — nothing to run.';
    case 'not_started':
      return ctx.nextLabel
        ? `Not started. First up: ${ctx.nextLabel}.`
        : 'Not started.';
    case 'wrapped':
      return 'Every block is done.';
    case 'clear_work_first':
      return `Running ${ctx.drift ?? 'behind'} with ${work} — clear these before you push.`;
    case 'clear_to_advance':
      return ctx.currentLabel
        ? `On: ${ctx.currentLabel}. Nothing blocking.`
        : 'Nothing blocking.';
    case 'holding':
      return ctx.nextLabel
        ? `Between moments. Next: ${ctx.nextLabel}.`
        : 'Between moments.';
  }
}

/**
 * The open rows, newest-relevant first, for the "what's blocking" list. Uses
 * the shipped `countsAsOpenWork` so this list and the badge can never disagree
 * about what counts as work.
 */
export function openWorkRows(
  rows: readonly DayRequestRow[],
): DayRequestRow[] {
  return rows.filter((r) => countsAsOpenWork(r));
}
