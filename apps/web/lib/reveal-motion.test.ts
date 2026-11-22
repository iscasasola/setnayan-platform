/**
 * 🎭 ONE SET OF MOTION RULES FOR EVERY REVEAL (owner 23 Nov 2026 — DECISION_LOG "REVEALS ACCEPTED FOR NOW AT v10"
 * and "NINE REVEALS SHIP; THE GIFT BOX IS HELD"). The rules are the shipped veil's own numbers, moved into
 * `lib/reveal-motion.ts`; the hands-free speed is 9 · 12 · 16 s (12 the house's). And the retired openings keep
 * playing — as their nearest new reveal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REVEAL_SPEED,
  REVEAL_MOTION,
  REVEAL_SPEEDS,
  SCRATCH_OPENS_AT,
  handsFreeTarget,
  pushedZ,
  readGesture,
  revealDt,
  snapRevealSpeed,
  stepLift,
} from './reveal-motion';
import { RETIRED_REVEAL_IDS, REVEAL_TEMPLATE_IDS, canonicalRevealId } from './reveal-config-pure';

test('⏱ the speeds are 9 · 12 · 16 s and the house speed is 12', () => {
  assert.deepEqual([...REVEAL_SPEEDS], [9, 12, 16]);
  assert.equal(DEFAULT_REVEAL_SPEED, 12);
  assert.equal(snapRevealSpeed(undefined), 12);
  assert.equal(snapRevealSpeed('16'), 12, 'a string is unreadable, not a speed');
  assert.equal(snapRevealSpeed(Number.NaN), 12);
  assert.equal(snapRevealSpeed(5), 9, 'the old veil feather (5 s) is the quickest choice, never quicker');
  assert.equal(snapRevealSpeed(11), 12);
  assert.equal(snapRevealSpeed(14), 16, 'a tie goes to the slower — more drama');
  assert.equal(snapRevealSpeed(99), 16);
});

test('the rules are the shipped veil’s numbers, read off veil-reveal.tsx', () => {
  assert.equal(REVEAL_MOTION.LIFT_K, 0.05);
  assert.equal(REVEAL_MOTION.DONE, 0.985);
  assert.equal(REVEAL_MOTION.TAP_MS, 300);
  assert.equal(REVEAL_MOTION.TAP_PX, 18);
  assert.equal(REVEAL_MOTION.SWIPE_PX, 40);
  assert.equal(REVEAL_MOTION.SWIPE_MS, 460);
  assert.equal(SCRATCH_OPENS_AT, 0.6, 'owner: "they have to scratch at least 60%"');
});

test('the hands-free curve starts at once, never goes back, and lands at 1', () => {
  assert.equal(handsFreeTarget(0), 0);
  assert.equal(handsFreeTarget(1), 1);
  assert.ok(handsFreeTarget(0.05) > 0.02, 'even pace from the first moment (the reference clips)');
  let prev = 0;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const v = handsFreeTarget(p);
    assert.ok(v >= prev - 1e-9, `the open went back at ${p}`);
    prev = v;
  }
  assert.equal(handsFreeTarget(-1), 0);
  assert.equal(handsFreeTarget(2), 1);
});

test('the lift closes 5 % of what is left each frame, and a hands-free open is revealed within its speed + the landing', () => {
  assert.equal(stepLift(0, 1), 0.05);
  for (const speed of REVEAL_SPEEDS) {
    let lift = 0;
    let frames = 0;
    for (; lift <= REVEAL_MOTION.DONE && frames < 5000; frames++) lift = stepLift(lift, handsFreeTarget(Math.min(1, frames / 60 / speed)));
    const sec = frames / 60;
    assert.ok(sec > speed * 0.9 && sec < speed + 2, `${speed} s: revealed after ${sec.toFixed(1)} s`);
  }
});

test('a tap, a swipe the way it opens, the other way, and a hold — read as the veil reads them', () => {
  assert.equal(readGesture({ dx: 3, dy: -4, ms: 120 }), 'tap');
  assert.equal(readGesture({ dx: 0, dy: -80, ms: 200 }), 'open', 'up opens the veil');
  assert.equal(readGesture({ dx: 0, dy: 80, ms: 200 }), 'close');
  assert.equal(readGesture({ dx: 0, dy: 80, ms: 200, dir: [0, 1] }), 'open', 'the fabric opens downward');
  assert.equal(readGesture({ dx: 120, dy: -10, ms: 200 }), 'hold', 'sideways is not up');
  assert.equal(readGesture({ dx: 0, dy: -80, ms: 600 }), 'hold', 'too slow for a swipe');
  assert.equal(readGesture({ dx: 0, dy: 0, ms: 400 }), 'hold', 'too long for a tap');
});

test('the push-in travels its share and no further', () => {
  assert.equal(pushedZ(10, REVEAL_MOTION.PUSH, 0), 10);
  assert.ok(Math.abs(pushedZ(10, REVEAL_MOTION.PUSH, 1) - 6.4) < 1e-9);
});

test('🎞 a frame is capped at 33 ms (no stalled frame jumps the open)', () => {
  assert.equal(revealDt(1000, 0), 0.033);
  assert.ok(Math.abs(revealDt(1016, 1000) - 0.016) < 1e-9);
});

test('🎭 the nine reveals — the envelope in two styles — and the gift box is HELD (no id)', () => {
  assert.deepEqual(
    [...REVEAL_TEMPLATE_IDS].sort(),
    ['beach-curtains', 'cathedral-doors', 'envelope-classic', 'envelope-gatefold', 'fabric', 'fireworks', 'petals', 'scratch', 'smoke', 'veil-sheer'],
  );
  for (const held of ['gift', 'gift-box', 'giftbox']) assert.equal(canonicalRevealId(held), null, `${held} is held by the owner`);
});

test('↪️ an event that chose a retired opening keeps an opening — its nearest new reveal', () => {
  assert.deepEqual({ ...RETIRED_REVEAL_IDS }, {
    'four-flap': 'envelope-classic',
    'two-flap-horizontal': 'envelope-classic',
    'two-flap-vertical': 'envelope-gatefold',
    'church-doors': 'cathedral-doors',
  });
  for (const [old, now] of Object.entries(RETIRED_REVEAL_IDS)) assert.equal(canonicalRevealId(old), now);
  for (const id of REVEAL_TEMPLATE_IDS) assert.equal(canonicalRevealId(id), id);
  for (const junk of [null, undefined, 3, 'none', 'constructor', '__proto__', '']) assert.equal(canonicalRevealId(junk), null, String(junk));
});
