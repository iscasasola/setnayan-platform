/**
 * stage-mark.ts — what MARK a journey-rail stop draws, and how big it is.
 *
 * Pure on purpose. The rule it carries is "three states, three shapes": a
 * finished stage, an under-way stage and a not-started stage must be visibly
 * different KINDS of mark, not one mark in three greys.
 *
 * ── WHY THIS IS A MODULE AND NOT THREE BRANCHES IN THE COMPONENT ────────────
 * Because the thing that can be got wrong is a NUMBER, and a guard reading JSX
 * cannot judge it. Measured: a sabotage that re-drew the not-started mark at the
 * same size as the others passed a markup guard asserting "a not-started stage
 * emits no <svg>" — the defect was back, the same outline at the same size, told
 * apart from a started one only by colour, and every assertion stayed green.
 * Size is the whole difference between "a different kind of thing" and "the same
 * thing in a paler grey", so the sizes live here where a test can execute them.
 *
 * ⚠ RE-POINTED 2026-09-23 WHEN THE OWNER PICKED TREATMENT B. This module used to
 * size a 34px ProgressRing per stage (`STAGE_RING_PX` / `STAGE_DOT_PX`) and floor
 * the not-started mark at 1/3 of it. B draws ONE rail with six small stops, so
 * those constants had zero production readers the moment the rings went — and a
 * well-tested constant nothing runs is precisely the defect that got
 * `lib/digest-sub.ts` deleted this week. They are gone rather than kept "just in
 * case", and the size rule moved onto the marks that actually ship.
 */

export type StageMarkKind = 'complete' | 'partial' | 'not-started';

export type StageMark = { kind: StageMarkKind };

/**
 * The mark for a stage at `pct`.
 *
 * Boundaries are inclusive at both ends on purpose: 100 and above is complete,
 * 0 and below is not-started. A negative or non-finite percentage is a BAD READ,
 * and "not started" is the honest rendering of one — failing toward "not started"
 * understates, failing toward "complete" tells a couple a phase is finished on
 * the strength of a number nobody computed.
 */
export function stageMarkFor(pct: number): StageMark {
  const n = Number.isFinite(pct) ? pct : 0;
  if (n >= 100) return { kind: 'complete' };
  if (n <= 0) return { kind: 'not-started' };
  return { kind: 'partial' };
}

/**
 * Diameter in px of a STOP's dot on the rail, by what that stage is.
 *
 * `current` is the largest because it carries the one number this treatment
 * shows. A not-started stop is the smallest AND hollow (the component draws it
 * with a border instead of a fill) — two differences, not one, so it cannot be
 * mistaken for a started stop that happens to be pale.
 *
 * 🔒 `notStartedIsSmallest()` below is the executable floor. It replaced a
 * ratio against the old ring size, which stopped meaning anything when the ring
 * went.
 */
export const RAIL_STOP_PX: Readonly<Record<StageMarkKind | 'current', number>> = {
  current: 14,
  complete: 10,
  partial: 10,
  'not-started': 7,
};

/**
 * True when the not-started dot is strictly smaller than every other stop.
 *
 * Strict inequality rather than a ratio: these are all small dots now, so "a
 * third of the others" is not the right shape for the rule — what matters is
 * that the not-started mark is never merely a recoloured version of a started
 * one. A future edit that equalises them fails here, which is the sabotage that
 * beat the markup-only guard.
 */
export function notStartedIsSmallest(): boolean {
  const { 'not-started': ns, ...rest } = RAIL_STOP_PX;
  return Object.values(rest).every((v) => ns < v);
}

/**
 * Where the rail's head sits, 0–100, for a journey of `count` stops.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Stops are evenly spaced with the FIRST at 0% and the LAST at 100%, so there
 * are `count - 1` gaps. The head sits on the current stage's stop, advanced into
 * the gap ahead of it by that stage's own completion:
 *
 *     head = (index + pct/100) / (count - 1)
 *
 * A stage finished (100%) therefore lands exactly on the NEXT stop, which is
 * what "finished this phase" should look like, and a stage at 0 sits exactly on
 * its own. Stated rather than drawn: the approved mock put the head at 38% with
 * no derivation, and a position nobody can re-derive is a number waiting to rot.
 *
 * ⚠ Clamped at both ends. A `count` of 0 or 1 has no gaps to divide by — one
 * stop is the whole journey — and returns 0 rather than dividing by zero.
 */
export function railHeadPercent(index: number, pct: number, count: number): number {
  const n = Math.trunc(count);
  if (!Number.isFinite(n) || n <= 1) return 0;
  /*
    ⚠ `index` IS GUARDED FOR NON-FINITE SEPARATELY, AND THE TEST FOUND THIS.
    `Math.trunc(NaN)` is NaN, and NaN survives both Math.max and Math.min — so a
    NaN index produced a NaN head and the component would have emitted
    `width: NaN%`, which is an invalid declaration the browser drops silently.
    A rail that renders with no fill at all looks like "nothing has started"
    rather than like a bug, which is the failure mode this whole rail has just
    been cleaned of.
  */
  const idx = Number.isFinite(index) ? Math.trunc(index) : 0;
  const i = Math.min(Math.max(idx, 0), n - 1);
  const p = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  const raw = ((i + p / 100) / (n - 1)) * 100;
  return Math.min(100, Math.max(0, raw));
}
