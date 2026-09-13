import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAttemptStart, type StartAttemptState } from './encoder-start-attempt';

const idle: StartAttemptState = { cancelled: false, started: false, starting: false };

test('a fresh host may start — this is the on-air attempt', () => {
  assert.equal(shouldAttemptStart(idle), true);
});

test('a REFUSED attempt may be retried — the whole point of DSK-1', () => {
  // `no_stream_key` leaves started false and clears starting in `finally`. A key
  // pasted now must be able to reach a start, without a page reload.
  assert.equal(shouldAttemptStart({ ...idle, started: false, starting: false }), true);
});

test('an already-started encoder must NOT start again', () => {
  // Two `encoder_start`s is two RTMP publishes of one wedding to one key.
  assert.equal(shouldAttemptStart({ ...idle, started: true }), false);
});

test('an in-flight attempt must NOT be joined by a second one', () => {
  // `started` is still false here, so only `starting` can catch this — a couple
  // pasting twice quickly, or pasting while the token mint is in flight.
  assert.equal(shouldAttemptStart({ ...idle, starting: true }), false);
});

test('a torn-down host never starts', () => {
  assert.equal(shouldAttemptStart({ ...idle, cancelled: true }), false);
  assert.equal(shouldAttemptStart({ cancelled: true, started: true, starting: true }), false);
});

test('every field alone is enough to refuse — none is redundant', () => {
  // Deleting any one of the three predicates leaves a state that wrongly starts.
  // This is the conjunction, constructed so each field is the only difference.
  for (const field of ['cancelled', 'started', 'starting'] as const) {
    assert.equal(
      shouldAttemptStart({ ...idle, [field]: true }),
      false,
      `dropping the ${field} check would let this state start`,
    );
  }
});
