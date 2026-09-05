/**
 * S5 · the real backpressure drop policy — mutation-tested, see the guard notes below.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBackpressureRing, type RingEntry } from './backpressure-ring';

function entry(seq: number, keyframe: boolean): RingEntry {
  return { keyframe, timestampMicros: seq * 33_333, seq, data: new Uint8Array([seq % 256]) };
}

test('never exceeds capacity under steady non-keyframe overflow', () => {
  const ring = createBackpressureRing(5);
  ring.push(entry(0, true));
  for (let i = 1; i <= 20; i++) ring.push(entry(i, false));
  const stats = ring.stats();
  assert.equal(stats.size, 5, 'the ring must be bounded to its capacity');
  assert.equal(stats.pushed, 21);
  assert.equal(stats.droppedNonKeyframe + stats.droppedGop, 16, 'exactly the overflow amount, counted');
});

test('drops the OLDEST non-keyframe first, keeping the keyframe and the newest deltas', () => {
  const ring = createBackpressureRing(3);
  ring.push(entry(0, true)); // keyframe, must survive
  ring.push(entry(1, false));
  ring.push(entry(2, false));
  ring.push(entry(3, false)); // overflow: oldest non-keyframe (seq 1) must go
  const remaining = ring.drain().map((e) => e.seq);
  assert.deepEqual(remaining, [0, 2, 3]);
});

test('when only keyframes remain, drops the oldest WHOLE GOP, never the newest one', () => {
  const ring = createBackpressureRing(2);
  // Three keyframes, no deltas to shed first — forces the GOP-drop path.
  ring.push(entry(0, true));
  ring.push(entry(1, true));
  ring.push(entry(2, true)); // overflow with nothing but keyframes: drop oldest GOP (seq 0)
  const remaining = ring.drain().map((e) => e.seq);
  assert.deepEqual(remaining, [1, 2]);
});

test('never evicts down to nothing — the newest keyframe GOP is the resync floor', () => {
  const ring = createBackpressureRing(1);
  ring.push(entry(0, true));
  ring.push(entry(1, true)); // only one keyframe would remain either way — refuses further eviction
  const stats = ring.stats();
  assert.ok(stats.size >= 1, 'must never empty the ring entirely when only one keyframe GOP remains');
});

test('SWALLOWED DROP COUNT GUARD — every eviction is counted, none silent', () => {
  const ring = createBackpressureRing(4);
  ring.push(entry(0, true));
  for (let i = 1; i <= 10; i++) ring.push(entry(i, false));
  const stats = ring.stats();
  assert.equal(stats.pushed - stats.size, stats.totalDropped, 'pushed - size must equal drops, exactly');
  assert.ok(stats.totalDropped > 0, 'this scenario must have dropped something');
});

test('UNBOUNDED RING GUARD — push never grows the ring past capacity, ever', () => {
  const capacity = 10;
  const ring = createBackpressureRing(capacity);
  for (let i = 0; i < 500; i++) ring.push(entry(i, i % 7 === 0));
  assert.ok(ring.stats().size <= capacity, `ring grew to ${ring.stats().size}, past capacity ${capacity}`);
});

test('push never awaits — synchronous return, no Promise', () => {
  const ring = createBackpressureRing(5);
  const result = ring.push(entry(0, true));
  assert.equal(result, undefined, 'push must be a synchronous void call, never a Promise the producer awaits');
});

test('onDrop callback fires once per eviction with running totals', () => {
  const calls: Array<{ droppedNonKeyframe: number; droppedGop: number; totalDropped: number }> = [];
  const ring = createBackpressureRing(2, (s) => calls.push(s));
  ring.push(entry(0, true));
  ring.push(entry(1, false));
  ring.push(entry(2, false)); // overflow -> 1 drop
  ring.push(entry(3, false)); // overflow -> 1 drop
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[calls.length - 1], { droppedNonKeyframe: 2, droppedGop: 0, totalDropped: 2 });
});

test('rejects a non-positive or non-integer capacity', () => {
  assert.throws(() => createBackpressureRing(0));
  assert.throws(() => createBackpressureRing(-1));
  assert.throws(() => createBackpressureRing(1.5));
});
