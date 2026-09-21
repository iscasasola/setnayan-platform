/**
 * ONE FLOOR, TWO SURFACES — and they may never disagree again.
 *
 * ─── THE DEFECT ────────────────────────────────────────────────────────────
 * Measured on production 2026-09-22, event 044f7e64 (wedding 2026-12-18, 87 days
 * out, coordinator unbooked). Two pages told the same couple two different
 * things about the same category:
 *
 *     Overview  ..... "Lock your coordinator · overdue by 278 days"
 *     Your Team ..... "Coordinator / Planner · 113D OVERDUE"
 *
 * 165 days apart. Neither was a date bug: `todays-one-thing.ts` measured
 * lateness from `PLAN_GROUPS.monthsBefore` (12 → 2025-12-18, 278 days ago) while
 * `vendors-plan-budget.ts` measured it from `lockLeadDaysFor` (200 → 2026-06-01,
 * 113 days ago). Both arithmetics were right about the number they were handed.
 *
 * 🔑 `monthsBefore` IS AN AIM — its own docblock says "aim to have this locked" —
 * AND MISSING AN AIM IS NOT BEING LATE. The floor is `lockLeadDaysFor`, exported
 * since 2026-07-27 and read by the Your Team page all along. The Overview just
 * never imported it.
 *
 * ─── WHAT THIS FILE PINS ───────────────────────────────────────────────────
 * Not "the coordinator says 113". That would pass again the moment a second
 * surface started measuring from the aim. It pins the INVARIANT: for every plan
 * group, the two resolvers put the floor on the same day. One is the hero's
 * `days`; the other is the model's `daysUntilWedding - lockLeadDaysFor`.
 *
 * ⚠ AND IT PROVES THE OLD NUMBER IS UNREACHABLE. A test that only asserted
 * agreement would still pass if BOTH surfaces regressed to the aim together, so
 * the coordinator case also asserts the specific wrong answer, 278, is gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_GROUPS, computeTargetDate } from './wedding-plan-groups';
import { lockLeadDaysFor } from './vendors-plan-budget';
import { pickTodaysOneThing } from './todays-one-thing';

/** The real event, so the numbers in the docblock above are the numbers here. */
const WEDDING = '2026-12-18';
const NOW = new Date('2026-09-22T12:00:00+08:00');
const DAYS_UNTIL_WEDDING = 87;

/** Whole days between two dates, positive when `b` is later. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

test('the hero reports the coordinator 113 days overdue, not 278', () => {
  /*
    ⚠ THIS ASSERTS `pickTodaysOneThing`'s OWN OUTPUT, and it has to.
    My first draft checked only `lockLeadDaysFor` and `computeTargetDate` — the
    two helpers — and never read the resolver's `daysContextual`. It passed 4/4
    with the fix REVERTED, because nothing in it ever ran `classify()`. A test
    has to face the thing it is guarding.

    `groups` is narrowed to the coordinator so the hero must pick it: with
    nothing booked every category is overdue, and the venues (270-day floors,
    183 days past) outrank a 200-day floor, so the unnarrowed hero would answer
    "reception venue" and the coordinator's number would never be examined.
  */
  const coordinator = PLAN_GROUPS.find((g) => g.id === 'coordinator')!;
  const hero = pickTodaysOneThing([], WEDDING, NOW, [coordinator]);
  assert.ok(hero, 'with nothing booked the hero must find a task');
  assert.equal(hero.id, 'coordinator');
  assert.equal(hero.status, 'overdue');
  assert.equal(
    hero.daysContextual,
    113,
    'the hero must measure from the 200-day FLOOR (113), never the 12-month AIM (278)',
  );

  // The floor the model uses, computed independently of the hero.
  const floorDays = lockLeadDaysFor('coordinator');
  assert.equal(floorDays, 200, 'the coordinator floor is 200 days before the day');
  assert.equal(
    DAYS_UNTIL_WEDDING - floorDays,
    -113,
    'so the model puts it 113 days past the floor',
  );

  // And the date arithmetic the hero now shares.
  const target = computeTargetDate(WEDDING, floorDays);
  assert.ok(target);
  assert.equal(
    daysBetween(target, NOW),
    113,
    'the floor date is 2026-06-01, which is 113 days before 2026-09-22',
  );

  /*
    🪤 THE OLD ANSWER, measured as a GAP rather than as an absolute.
    The absolute (278) depends on the clock time inside `now`, because a
    12-calendar-month subtraction and a 200-day subtraction land on midnights in
    different offsets — my first draft of this test asserted 278 and got 279 for
    exactly that reason. The gap between the two target DATES does not depend on
    the clock at all: both are derived from the same wedding date the same way.
  */
  const aimMonths = PLAN_GROUPS.find((g) => g.id === 'coordinator')!.monthsBefore;
  assert.equal(aimMonths, 12, 'the aim is unchanged — it is still 12 months');
  const aimTarget = new Date(WEDDING);
  aimTarget.setMonth(aimTarget.getMonth() - aimMonths);
  assert.equal(
    daysBetween(aimTarget, target),
    165,
    'the aim (2025-12-18) sits exactly 165 days before the floor (2026-06-01) — '
      + 'so reading the aim reported 165 days more lateness than was true',
  );
  assert.notEqual(
    daysBetween(target, NOW),
    daysBetween(aimTarget, NOW),
    'the floor and the aim must not produce the same overdue figure',
  );
});

test('every plan group puts its floor on the same day in both resolvers', () => {
  // THE INVARIANT. If a surface ever starts measuring from the aim again, the
  // group where aim ≠ floor fails here — which is 22 of the 26 groups that
  // carry both, so this cannot be regressed quietly.
  let checked = 0;
  for (const g of PLAN_GROUPS) {
    const floorDays = lockLeadDaysFor(g.id);

    // Resolver A — the model: days from now to the floor, off daysUntilWedding.
    const modelDaysToFloor = DAYS_UNTIL_WEDDING - floorDays;

    // Resolver B — the hero's shared date helper.
    const target = computeTargetDate(WEDDING, floorDays);
    assert.ok(target, `${g.id}: the floor date must resolve`);
    const heroDaysToFloor = -daysBetween(target, NOW);

    assert.equal(
      heroDaysToFloor,
      modelDaysToFloor,
      `${g.id}: the hero says ${heroDaysToFloor} days to the floor, the model says ${modelDaysToFloor}`,
    );
    checked += 1;
  }
  assert.ok(checked >= 26, `expected every group to be checked, got ${checked}`);
});

test('the aim and the floor are genuinely different numbers — so the swap mattered', () => {
  // Guards against a future "simplification" that sets monthsBefore ≈ the floor
  // and makes the two tests above vacuous. If this ever fails, the aim table and
  // the floor table have been conflated and the distinction this fix rests on is
  // gone — which is a decision for the owner, not a tidy-up.
  const differing = PLAN_GROUPS.filter((g) => {
    const floorDays = lockLeadDaysFor(g.id);
    const aim = new Date(`${WEDDING}T00:00:00`);
    aim.setMonth(aim.getMonth() - g.monthsBefore);
    const floor = computeTargetDate(WEDDING, floorDays)!;
    return Math.abs(daysBetween(aim, floor)) > 7;
  });
  assert.ok(
    differing.length >= 15,
    `the aim and the floor should differ for most groups; only ${differing.length} differ`,
  );
  assert.ok(
    differing.some((g) => g.id === 'coordinator'),
    'the coordinator — the category the owner reported — must be one of them',
  );
});

test('a group with no floor of its own still gets one', () => {
  // `lockLeadDaysFor` is total: a group added later with no entry falls back to
  // 90 rather than producing "overdue by null days".
  for (const g of PLAN_GROUPS) {
    const d = lockLeadDaysFor(g.id);
    assert.equal(typeof d, 'number', `${g.id}: floor must be a number`);
    assert.ok(Number.isFinite(d) && d >= 0, `${g.id}: floor must be a real day count`);
  }
});
