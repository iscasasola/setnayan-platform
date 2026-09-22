import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOT_STARTED_MAX_RATIO,
  STAGE_DOT_PX,
  STAGE_RING_PX,
  stageMarkFor,
} from './stage-mark';

/*
  THREE STATES, THREE SHAPES — EXECUTED, INCLUDING THE SIZE.

  🔑 WHY THE SIZE IS ASSERTED HERE AND NOT IN THE MARKUP TEST. The rail's own
  guard checks that a not-started stage emits no <svg>. A sabotage that redrew
  the not-started mark as a RING-SIZED pale circle — a <span>, not an <svg> —
  passed that guard with the defect fully restored: the same full outline, the
  same size, distinguished from a real progress ring only by colour. A markup
  guard cannot see that, because the difference is a number. So the number lives
  in a pure module and is run.
*/

test('each band resolves to its own kind of mark', () => {
  assert.equal(stageMarkFor(0).kind, 'not-started');
  assert.equal(stageMarkFor(1).kind, 'partial');
  assert.equal(stageMarkFor(50).kind, 'partial');
  assert.equal(stageMarkFor(99).kind, 'partial');
  assert.equal(stageMarkFor(100).kind, 'complete');
  assert.equal(stageMarkFor(101).kind, 'complete');
});

test('a bad percentage reads as not-started, never as a full ring', () => {
  // A negative or non-finite pct is a bad read. "Not started" is the honest
  // rendering of one; a full ring would state completion nobody measured.
  for (const bad of [-1, -100, Number.NaN, -Number.POSITIVE_INFINITY]) {
    assert.equal(stageMarkFor(bad).kind, 'not-started', `pct ${bad}`);
  }
  /*
    ⚠ +Infinity IS NOT "COMPLETE", AND THIS TEST ASSERTED THAT IT WAS UNTIL IT
    RAN. The reasoning looked sound — Infinity is "at or past 100" — but the
    module coerces every NON-FINITE value to 0 BEFORE banding, so +Infinity
    reads as not-started. The module is right and the assertion was wrong:
    Infinity is not a measurement of 100%, it is a broken read, and drawing a ✓
    for it would tell a couple a stage was finished on the strength of a number
    nobody computed. Failing toward "not started" understates; failing toward
    "complete" lies.
  */
  assert.equal(stageMarkFor(Number.POSITIVE_INFINITY).kind, 'not-started');
});

test('🔒 the not-started mark is a DIFFERENT SIZE, not a different grey', () => {
  const dot = stageMarkFor(0).diameterPx;
  const ring = stageMarkFor(50).diameterPx;
  const ratio = dot / ring;
  console.log(`  not-started ${dot}px · partial ${ring}px · ratio ${ratio.toFixed(3)} (max ${NOT_STARTED_MAX_RATIO.toFixed(3)})`);
  assert.ok(ring > 0, 'an under-way stage must draw something');
  assert.ok(dot > 0, 'a not-started stage must draw something — absence is not a mark');
  assert.ok(
    ratio <= NOT_STARTED_MAX_RATIO,
    `the not-started mark is ${ratio.toFixed(2)} of the ring — at that size it reads as ` +
      'a ring that failed to fill, which is the defect this rule exists to prevent',
  );
  // Pin the constants themselves so a silent widening has to be deliberate.
  assert.equal(ring, STAGE_RING_PX);
  assert.equal(dot, STAGE_DOT_PX);
});

test('the ratio floor can actually fail — so the green above is evidence', () => {
  // The sabotage that beat the markup guard, expressed as arithmetic.
  const ringSizedDot = STAGE_RING_PX;
  assert.ok(
    ringSizedDot / STAGE_RING_PX > NOT_STARTED_MAX_RATIO,
    'a ring-sized dot must violate the ratio — otherwise this rule is vacuous',
  );
});

test('a complete stage draws a glyph, not a shape', () => {
  assert.equal(stageMarkFor(100).diameterPx, 0, 'the tick is text; it has no diameter');
});
