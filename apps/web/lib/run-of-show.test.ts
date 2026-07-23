/**
 * Unit suite for the guest "What's happening now" trigger read (owner
 * directive 2026-07-23): hasRunShowSignal + pickTriggerNowNext. Guards the
 * contract every guest surface leans on — wall-clock fallback while the show
 * hasn't started, pointer-following once it has, graceful "between moments"
 * when the live block is hidden (is_public=false rows never reach guests),
 * and wrapped-program behavior.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRunShowSignal,
  pickTriggerNowNext,
  type RunState,
} from './run-of-show';

type B = { block_id: string; start_at: string; run_state?: RunState | null };

const b = (id: string, start: string, run_state?: RunState | null): B => ({
  block_id: id,
  start_at: start,
  run_state,
});

test('hasRunShowSignal: false when all upcoming or run_state missing', () => {
  assert.equal(hasRunShowSignal([]), false);
  assert.equal(
    hasRunShowSignal([b('a', '2026-12-19T14:00', 'upcoming'), b('b', '2026-12-19T15:00', 'upcoming')]),
    false,
  );
  // Callers that never selected run_state (older shapes) must not trip it.
  assert.equal(hasRunShowSignal([b('a', '2026-12-19T14:00'), b('b', '2026-12-19T15:00', null)]), false);
});

test('hasRunShowSignal: true once any block is live or done', () => {
  assert.equal(hasRunShowSignal([b('a', '2026-12-19T14:00', 'live')]), true);
  assert.equal(
    hasRunShowSignal([b('a', '2026-12-19T14:00', 'done'), b('b', '2026-12-19T15:00', 'upcoming')]),
    true,
  );
});

test('pickTriggerNowNext: null (wall-clock fallback) while show not started', () => {
  assert.equal(pickTriggerNowNext([b('a', '2026-12-19T14:00', 'upcoming')]), null);
  assert.equal(pickTriggerNowNext([]), null);
});

test('pickTriggerNowNext: live block wins regardless of the clock', () => {
  const blocks = [
    b('a', '2026-12-19T14:00', 'done'),
    b('b', '2026-12-19T15:00', 'live'),
    b('c', '2026-12-19T16:00', 'upcoming'),
    b('d', '2026-12-19T17:00', 'upcoming'),
  ];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current?.block_id, 'b');
  assert.equal(res.next?.block_id, 'c');
});

test('pickTriggerNowNext: next skips non-upcoming rows after the live one', () => {
  // Host jumped around historically — a done row after the live one is never
  // offered as "next".
  const blocks = [
    b('a', '2026-12-19T14:00', 'live'),
    b('b', '2026-12-19T15:00', 'done'),
    b('c', '2026-12-19T16:00', 'upcoming'),
  ];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current?.block_id, 'a');
  assert.equal(res.next?.block_id, 'c');
});

test('pickTriggerNowNext: hidden live block degrades to between-moments (no teaser)', () => {
  // The live block is is_public=false → not in the guest-visible list. Guests
  // see done + upcoming rows only: current must be null (between moments) and
  // next the first still-upcoming visible block.
  const blocks = [
    b('a', '2026-12-19T14:00', 'done'),
    b('c', '2026-12-19T16:00', 'upcoming'),
  ];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current, null);
  assert.equal(res.next?.block_id, 'c');
});

test('pickTriggerNowNext: wrapped program → current and next both null', () => {
  const blocks = [
    b('a', '2026-12-19T14:00', 'done'),
    b('b', '2026-12-19T15:00', 'done'),
  ];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current, null);
  assert.equal(res.next, null);
});

test('pickTriggerNowNext: unsorted input is ordered by start_at', () => {
  const blocks = [
    b('d', '2026-12-19T17:00', 'upcoming'),
    b('b', '2026-12-19T15:00', 'live'),
    b('c', '2026-12-19T16:00', 'upcoming'),
    b('a', '2026-12-19T14:00', 'done'),
  ];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current?.block_id, 'b');
  assert.equal(res.next?.block_id, 'c');
});

test('pickTriggerNowNext: missing run_state on some rows counts as upcoming', () => {
  const blocks = [b('a', '2026-12-19T14:00', 'done'), b('b', '2026-12-19T15:00')];
  const res = pickTriggerNowNext(blocks);
  assert.ok(res);
  assert.equal(res.current, null);
  assert.equal(res.next?.block_id, 'b');
});
