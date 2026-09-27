/**
 * element-size-scale.test.ts — SIZE IS A BOUNDED − / + STEPPER, AND EVERY SIZE
 * ALREADY SAVED KEEPS ITS LOOK.
 *
 * Owner, 2026-09-27: *"Stepper with safe limits"*, then on the approved
 * prototype, answer 3: *"-+ only"* — no number, rails on. It replaced
 * S · M · L · XL, which couples have already saved. What this proves:
 *
 *   1. the old S · L · XL read as exactly the scale they drew at (0.85 · 1.2 ·
 *      1.45) — on the element AND on a run — so no couple's page moves;
 *   2. every element's bounds contain all three, so nothing saved is clamped;
 *   3. − / + walk the steps and STOP at the element's bounds (the button is then
 *      disabled), and 100 — the theme's own size — is never stored;
 *   4. a hand-made value outside the bounds is pulled back in; anything that is
 *      not a step is dropped, so nothing typed reaches CSS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_ELEMENT_KEYS,
  HUB_ELEMENT_LEGACY_SIZE,
  HUB_ELEMENT_SIZE_BOUNDS,
  HUB_ELEMENT_SIZE_STEPS,
  hubElementDeclarations,
  hubRunInlineStyle,
  sanitizeHubElementSize,
  sanitizeHubElements,
  stepHubElementSize,
  withElementChoice,
} from './element-style';

test('♻ the old S · L · XL draw at exactly the scale they always did — element and run', () => {
  const old = { s: 0.85, l: 1.2, xl: 1.45 } as const;
  for (const [legacy, scale] of Object.entries(old) as Array<['s' | 'l' | 'xl', number]>) {
    const kept = sanitizeHubElements({ heading: { size: legacy } });
    assert.equal(kept?.heading?.size, Math.round(scale * 100), `${legacy} is carried as its percent`);
    assert.deepEqual(hubElementDeclarations(kept!.heading), [['zoom', String(scale)]], `${legacy} still draws at zoom ${scale}`);
    // A run (one letter) made with the old sizes keeps its size too.
    const run = sanitizeHubElements({ names: { runs: [{ start: 0, end: 1, size: legacy }], of: '0000abcd' } });
    assert.equal(run?.names?.runs?.[0]?.size, Math.round(scale * 100));
    assert.equal(hubRunInlineStyle(run!.names!.runs![0]!).fontSize, `${scale}em`);
  }
  assert.equal(sanitizeHubElements({ heading: { size: 'm' } }), null, 'M was the theme size — still an absence');
});

test('every element can hold every size a couple already saved (nothing is clamped on read)', () => {
  for (const key of HUB_ELEMENT_KEYS) {
    const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[key];
    for (const pct of Object.values(HUB_ELEMENT_LEGACY_SIZE)) {
      assert.ok(pct >= min && pct <= max, `${key}: ${pct} is inside ${min}–${max}`);
    }
    assert.ok((HUB_ELEMENT_SIZE_STEPS as readonly number[]).includes(min) && (HUB_ELEMENT_SIZE_STEPS as readonly number[]).includes(max));
    assert.ok(min < 100 && max > 100, `${key}: the theme size sits inside its own bounds`);
  }
});

test('− / + walk the steps and stop at the bounds; 100 is the theme size and is never stored', () => {
  // From the theme's size, one + and one −.
  assert.equal(stepHubElementSize(undefined, 1, 'body'), 110);
  assert.equal(stepHubElementSize(undefined, -1, 'body'), 92);
  // Back to the theme's size is an absence.
  assert.equal(stepHubElementSize(110, -1, 'body'), null);
  // Walk + to the ceiling, then the next press is refused.
  for (const key of HUB_ELEMENT_KEYS) {
    const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[key];
    let at: number | null = null;
    let presses = 0;
    for (;;) {
      const next = stepHubElementSize(at, 1, key);
      if (next === false) break;
      at = next;
      assert.ok(++presses < 20, 'the stepper must end');
    }
    assert.equal(at, max, `${key}: + stops at ${max}`);
    at = null;
    presses = 0;
    for (;;) {
      const next = stepHubElementSize(at, -1, key);
      if (next === false) break;
      at = next;
      assert.ok(++presses < 20, 'the stepper must end');
    }
    assert.equal(at, min, `${key}: − stops at ${min}`);
  }
  // A body line is never taken below 85% (unreadable on a phone) …
  assert.equal(stepHubElementSize(85, -1, 'body'), false);
  // … and the names never past 145% (off a phone's edge).
  assert.equal(stepHubElementSize(145, 1, 'names'), false);
  // The choice writer never stores 100.
  assert.equal(withElementChoice({ body: { size: 110 } }, 'body', 'size', 100), null);
});

test('a value outside the bounds is pulled in; anything that is not a step is dropped', () => {
  assert.equal(sanitizeHubElementSize(160, 'names'), 145, 'past the ceiling → the ceiling');
  assert.equal(sanitizeHubElementSize(70, 'body'), 85, 'under the floor → the floor');
  assert.equal(sanitizeHubElementSize(117, 'body'), null, 'not a step');
  assert.equal(sanitizeHubElementSize('150%', 'body'), null);
  assert.equal(sanitizeHubElementSize('1.2); background:url(x)', 'body'), null);
  assert.equal(sanitizeHubElementSize(100, 'body'), null, 'the theme size is an absence');
});
