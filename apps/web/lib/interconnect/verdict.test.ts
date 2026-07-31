import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, classifyPopulation, isFault, VERDICT_COPY } from './verdict';

/**
 * The verdict rule is the only part of the probe system that must never be
 * wrong, so it is pure and tested directly. Every case below is a real state
 * prod has been in, not a hypothetical.
 */

test('classify · a reader who saw rows is the healthy case', () => {
  assert.equal(classify({ permitted: true, subjectCount: 3, truthCount: 3 }), 'ok');
});

test('classify · permitted and genuinely empty is NOT a fault', () => {
  // Pre-launch prod is mostly this. If it read as a fault the page would cry
  // wolf until nobody looked at it.
  assert.equal(classify({ permitted: true, subjectCount: 0, truthCount: 0 }), 'empty');
  assert.equal(isFault('empty'), false);
});

test('classify · THE SONG DESK — permitted, saw nothing, rows exist', () => {
  // Three pending song requests in the table, a vendor entitled to see them,
  // and an inbox rendering "no requests yet". This is the case the whole system
  // exists to name.
  assert.equal(classify({ permitted: true, subjectCount: 0, truthCount: 3 }), 'lying');
  assert.equal(isFault('lying'), true);
});

test('classify · a denial is never reported as emptiness', () => {
  // fetchActSongRequests returns [] on a denied gate by design, so the gate is
  // asked separately. If `permitted` were inferred from the row count instead,
  // this case would collapse into `empty` and disappear.
  assert.equal(classify({ permitted: false, subjectCount: 0, truthCount: 0 }), 'denied');
  assert.equal(classify({ permitted: false, subjectCount: 0, truthCount: 9 }), 'denied');
  assert.equal(isFault('denied'), true);
});

test('classify · the gate outranks the counts', () => {
  // A denied reader's row count carries no information — the query never ran.
  assert.equal(classify({ permitted: false, subjectCount: 5, truthCount: 5 }), 'denied');
});

test('classifyPopulation · partial service is a fault, not a pass', () => {
  // The trap this guards: four vendors reach their desks and the fifth cannot.
  // Routing that through classify() would return `ok` on the strength of the
  // four, and the stranded vendor would never appear anywhere.
  assert.equal(classifyPopulation(4, 5), 'lying');
  assert.equal(classifyPopulation(0, 3), 'lying');
  assert.equal(classifyPopulation(5, 5), 'ok');
});

test('classifyPopulation · an empty population is empty, not broken', () => {
  // No bookings at all is the pre-launch state, not a defect.
  assert.equal(classifyPopulation(0, 0), 'empty');
});

test('every verdict has operator-readable copy', () => {
  // `satisfies Record<ProbeVerdict, string>` enforces this at compile time; this
  // asserts the strings are actually non-empty rather than just present.
  for (const [verdict, copy] of Object.entries(VERDICT_COPY)) {
    assert.ok(copy.trim().length > 0, `${verdict} has no copy`);
  }
});
