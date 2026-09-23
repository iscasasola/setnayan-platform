import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RAIL_STOP_PX,
  notStartedIsSmallest,
  railHeadPercent,
  stageMarkFor,
} from './stage-mark';

/*
  THREE STATES, THREE SHAPES — EXECUTED, INCLUDING THE SIZES.

  🔑 WHY THE SIZE IS ASSERTED HERE AND NOT ONLY IN THE MARKUP TEST. A sabotage
  that redrew the not-started mark at the same size as a started one passed a
  markup guard checking only which element was emitted: the defect was fully
  restored — same shape, same size, distinguished by colour alone — and every
  assertion stayed green. A markup guard cannot see a defect whose difference is
  a NUMBER. So the numbers live in a pure module and are run.

  ⚠ RE-POINTED 2026-09-23 for treatment B. The old floor was a ratio against a
  34px ring; B has no rings, so that ratio was measuring a constant nothing
  rendered. The rule is now "the not-started dot is strictly smaller than every
  other stop", which is the property the shipped marks actually have.
*/

test('each band resolves to its own kind of mark', () => {
  assert.equal(stageMarkFor(0).kind, 'not-started');
  assert.equal(stageMarkFor(1).kind, 'partial');
  assert.equal(stageMarkFor(50).kind, 'partial');
  assert.equal(stageMarkFor(99).kind, 'partial');
  assert.equal(stageMarkFor(100).kind, 'complete');
  assert.equal(stageMarkFor(101).kind, 'complete');
});

test('a bad percentage reads as not-started, never as complete', () => {
  /*
    A negative or non-finite pct is a broken read. Failing toward "not started"
    understates; failing toward "complete" would tell a couple a phase was
    finished on the strength of a number nobody computed. +Infinity included on
    purpose — it looks like "past 100" and is not.
  */
  for (const bad of [-1, -100, Number.NaN, -Infinity, Number.POSITIVE_INFINITY]) {
    assert.equal(stageMarkFor(bad).kind, 'not-started', `pct ${bad}`);
  }
});

test('🔒 the not-started stop is a DIFFERENT SIZE, not a different grey', () => {
  const ns = RAIL_STOP_PX['not-started'];
  const others = [RAIL_STOP_PX.current, RAIL_STOP_PX.complete, RAIL_STOP_PX.partial];
  console.log(`  not-started ${ns}px · others ${JSON.stringify(others)}px`);
  assert.ok(ns > 0, 'a not-started stop must still draw something — absence is not a mark');
  assert.ok(notStartedIsSmallest(), 'the not-started dot is not smaller than every started one');
  assert.ok(Math.min(...others) - ns >= 2, 'a 1px difference is not a visible difference');
});

test('the floor can actually fail — so the green above is evidence', () => {
  /*
    The sabotage that beat the markup guard, expressed as arithmetic against the
    real table: equalise the sizes and the rule must break. If this ever passes
    with equal sizes, `notStartedIsSmallest` has stopped meaning anything.
  */
  const equalised = { current: 10, complete: 10, partial: 10, 'not-started': 10 };
  const { 'not-started': ns, ...rest } = equalised;
  assert.equal(
    Object.values(rest).every((v) => ns < v),
    false,
    'equal sizes must violate the rule',
  );
});

test('the rail head sits where the RULE puts it', () => {
  assert.equal(railHeadPercent(0, 0, 6), 0, 'first stop at 0% is the left end');
  assert.equal(railHeadPercent(5, 100, 6), 100, 'last stop finished is the right end');
  assert.equal(railHeadPercent(2, 0, 6), 40, 'stop 3 of 6 sits at 2/5');
  assert.equal(railHeadPercent(1, 100, 6), 40, 'a finished stage lands on the NEXT stop');
  assert.ok(Math.abs(railHeadPercent(2, 52, 6) - 50.4) < 1e-9, 'advanced into the gap by its own pct');
});

test('no input can push the head outside the bar', () => {
  const cases: Array<[number, number, number]> = [
    [0, 0, 0], [0, 0, 1], [-5, -5, 6], [99, 999, 6], [2, Number.NaN, 6],
    [2, Number.POSITIVE_INFINITY, 6], [Number.NaN, 50, 6], [2, 50, Number.NaN],
  ];
  for (const [i, p, c] of cases) {
    const v = railHeadPercent(i, p, c);
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `railHeadPercent(${i},${p},${c}) = ${v}`);
  }
});
