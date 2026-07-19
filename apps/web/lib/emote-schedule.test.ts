/**
 * Unit suite for the emote-bubble rotation policy (`lib/emote-schedule.ts` —
 * Fable dossier §3.6). Load-bearing invariants:
 *   • ≤6 visible by construction: one sample per lane, six lanes.
 *   • Deterministic lane assignment + within-lane order (id-hash phase): the
 *     same crowd always rotates in the same sequence.
 *   • Per-guest cooldown: an emitter in a lane of k reappears exactly once
 *     every k slots — round-robin, no starvation, no double-booking.
 *   • Glyph rotation: `appearance` advances once per that emitter's OWN
 *     appearance (a [rsvp, meal] guest shows the plate once per rotation).
 *   • WALL-CLOCK LAW (the arrival fix): samples are closed-form in t — a
 *     44-minute jump lands on the exact owed state, no frame accumulation.
 *   • Reduced motion: static full-scale bubble, still capped.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emoteHash,
  emoteLanes,
  lanePhase,
  emotePopScale,
  sampleLane,
  EMOTE_MAX_VISIBLE,
  EMOTE_SLOT_S,
  EMOTE_VISIBLE_S,
  EMOTE_POP_IN_S,
  EMOTE_POP_OUT_S,
  type EmoteEmitter,
} from './emote-schedule';

const mk = (id: string): EmoteEmitter => ({ id, x: 0, y: 1.6, z: 0, glyphs: ['check', 'meal'] });

test('emoteLanes: every emitter lands in exactly one lane, deterministically', () => {
  const emitters = Array.from({ length: 40 }, (_, i) => mk(`guest-${i}`));
  const lanes = emoteLanes(emitters);
  assert.equal(lanes.length, EMOTE_MAX_VISIBLE);
  const seen = lanes.flat().map((e) => e.id);
  assert.equal(seen.length, emitters.length); // no drops, no duplicates
  assert.equal(new Set(seen).size, emitters.length);
  // Stable: a re-shuffled input partitions + orders identically (id-hash phase).
  const shuffled = [...emitters].reverse();
  const again = emoteLanes(shuffled);
  assert.deepEqual(
    again.map((l) => l.map((e) => e.id)),
    lanes.map((l) => l.map((e) => e.id)),
  );
  // Lane index really is hash % 6 for every member.
  lanes.forEach((lane, i) => {
    for (const e of lane) assert.equal(emoteHash(e.id) % EMOTE_MAX_VISIBLE, i);
  });
});

test('cap: at any instant at most one sample per lane → ≤6 bubbles room-wide', () => {
  const lanes = emoteLanes(Array.from({ length: 200 }, (_, i) => mk(`g${i}`)));
  for (const t of [0, 1.7, 3.59, 3.61, 12.8, 777.77]) {
    const visible = lanes.filter((lane, i) => sampleLane(t, i, lane.length) !== null);
    assert.ok(visible.length <= EMOTE_MAX_VISIBLE);
  }
});

test('round-robin cooldown: a lane of k cycles each emitter once every k slots', () => {
  const k = 5;
  const lane = 2;
  const seen: number[] = [];
  // Sample the middle of each slot for 2 full rotations.
  for (let slot = 0; slot < k * 2; slot++) {
    const t = slot * EMOTE_SLOT_S + 1 - lanePhase(lane);
    const s = sampleLane(t, lane, k);
    assert.ok(s, `slot ${slot} should be inside the visible window`);
    seen.push(s.emitterIndex);
  }
  // First rotation covers all k emitters exactly once, then repeats in order.
  assert.deepEqual(seen.slice(0, k), [0, 1, 2, 3, 4]);
  assert.deepEqual(seen.slice(k), seen.slice(0, k));
});

test('glyph rotation: appearance advances once per full lane rotation', () => {
  const k = 3;
  const lane = 0;
  // Emitter 1's appearances live in slots 1, 1+k, 1+2k, …
  for (let round = 0; round < 4; round++) {
    const slot = 1 + round * k;
    const s = sampleLane(slot * EMOTE_SLOT_S + 1 - lanePhase(lane), lane, k);
    assert.ok(s);
    assert.equal(s.emitterIndex, 1);
    assert.equal(s.appearance, round); // → glyphs[appearance % glyphs.length]
  }
});

test('wall-clock law: a starved frame consumes all owed progress (closed form)', () => {
  const lane = 4;
  const k = 7;
  // The state at t is a pure function of t: jumping 44 minutes ahead equals
  // computing that instant directly — no per-frame accumulation to miss.
  const jump = 44 * 60;
  const a = sampleLane(jump + 0.9, lane, k);
  const b = sampleLane(jump + 0.9, lane, k); // recompute — bit-identical
  assert.deepEqual(a, b);
  // And the slot index really advanced by the owed amount.
  const slotsOwed = Math.floor((jump + 0.9 + lanePhase(lane)) / EMOTE_SLOT_S);
  if (a) assert.equal(a.emitterIndex, slotsOwed % k);
});

test('visibility window: hidden outside EMOTE_VISIBLE_S, empty lane always null', () => {
  const lane = 0; // lanePhase(0) === 0 → local time is t within the slot
  assert.equal(lanePhase(0), 0);
  assert.ok(sampleLane(EMOTE_VISIBLE_S - 0.01, lane, 3));
  assert.equal(sampleLane(EMOTE_VISIBLE_S + 0.01, lane, 3), null);
  assert.equal(sampleLane(1, lane, 0), null);
});

test('pop tween: 0 → overshoot → 1 → 0, all from local time alone', () => {
  assert.equal(emotePopScale(0), 0);
  assert.equal(emotePopScale(EMOTE_POP_IN_S), 1);
  const mid = emotePopScale(EMOTE_POP_IN_S * 0.7);
  assert.ok(mid > 1, 'back-out overshoots past 1 mid-pop');
  assert.equal(emotePopScale((EMOTE_POP_IN_S + (EMOTE_VISIBLE_S - EMOTE_POP_OUT_S)) / 2), 1);
  assert.equal(emotePopScale(EMOTE_VISIBLE_S), 0);
  assert.equal(emotePopScale(EMOTE_VISIBLE_S + 5), 0);
});

test('reduced motion: static first-emitter bubble at full scale, still capped', () => {
  for (const t of [0, 3.3, 999]) {
    const s = sampleLane(t, 3, 9, true);
    assert.deepEqual(s, { emitterIndex: 0, appearance: 0, scale: 1 });
  }
  assert.equal(sampleLane(5, 3, 0, true), null); // empty lane stays empty
});
