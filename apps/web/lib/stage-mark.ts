/**
 * stage-mark.ts — which MARK a journey-rail stage draws, and how big it is.
 *
 * Pure on purpose. The rule it carries is "three states, three shapes": a
 * finished stage, an under-way stage and a not-started stage must be visibly
 * different KINDS of mark, not one mark in three greys.
 *
 * ── WHY THIS IS A MODULE AND NOT THREE BRANCHES IN THE COMPONENT ────────────
 * Because the thing that can be got wrong is a NUMBER, and a guard reading JSX
 * cannot judge it. Measured: a sabotage that re-drew the not-started mark as a
 * ring-sized pale circle passed a markup guard asserting "a not-started stage
 * emits no <svg>" — the defect was back, the same full outline at the same
 * size, told apart from a real ring only by colour, and every assertion stayed
 * green. Size is the whole difference between "a different kind of thing" and
 * "the same thing in a paler grey", so the size lives here where a test can
 * execute it. (Same reason `lib/` holds the other decision modules this repo
 * splits out: put what can be got wrong in a pure sibling and RUN it.)
 */

/** Diameter of the progress ring an under-way stage draws. */
export const STAGE_RING_PX = 34;

/**
 * Diameter of the dot a not-started stage draws.
 *
 * ⚠ IT MUST STAY A SMALL FRACTION OF `STAGE_RING_PX`. A mark of comparable size
 * reads as "a ring that failed to fill" however it is coloured — which is the
 * defect this module exists to prevent, not a styling preference.
 * `stage-mark.test.ts` fails if the gap closes.
 */
export const STAGE_DOT_PX = 8;

/**
 * The largest a not-started mark may be, as a fraction of the ring. A third is
 * the point at which the two stop reading as the same object at a glance; it is
 * a floor with a reason, not a round number chosen to fit today's value.
 */
export const NOT_STARTED_MAX_RATIO = 1 / 3;

export type StageMarkKind = 'complete' | 'partial' | 'not-started';

export type StageMark = {
  kind: StageMarkKind;
  /** Rendered diameter in px. 0 for `complete`, which draws a glyph, not a shape. */
  diameterPx: number;
};

/**
 * The mark for a stage at `pct`.
 *
 * Boundaries are inclusive at both ends on purpose: 100 and above is complete,
 * 0 and below is not-started (a negative or non-finite percentage is a bad read,
 * and "not started" is the honest rendering of one — never a full ring).
 */
export function stageMarkFor(pct: number): StageMark {
  const n = Number.isFinite(pct) ? pct : 0;
  if (n >= 100) return { kind: 'complete', diameterPx: 0 };
  if (n <= 0) return { kind: 'not-started', diameterPx: STAGE_DOT_PX };
  return { kind: 'partial', diameterPx: STAGE_RING_PX };
}
