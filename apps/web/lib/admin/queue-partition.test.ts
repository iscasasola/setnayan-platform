import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionQueues } from './queue-partition';

/**
 * What an admin is SHOWN, guarded as a rule rather than left to the eye.
 *
 * The work list collapses clear queues behind one line so the waiting ones are
 * not buried among them. That is a claim about attention, and the ways it goes
 * wrong are silent: a queue filed under "clear" is still on the page, still one
 * click away, and looks completely fine — right up until the thing nobody
 * looked at turns out to have had items in it.
 */

const row = (over: Partial<Parameters<typeof partitionQueues>[0][number]> = {}) => ({
  dueState: undefined as 'overdue' | 'due-soon' | 'ok' | undefined,
  count: 0 as number | null,
  ...over,
});

test('a queue with items waiting is never filed as clear', () => {
  const { waiting, clear } = partitionQueues([row({ count: 1 }), row({ count: 99 })]);
  assert.equal(waiting.length, 2);
  assert.equal(clear.length, 0);
});

test('count === null is a doorway, not a verdict — it stays visible', () => {
  // 🔑 THE FAILURE THIS EXISTS FOR. `null` means "we did not measure this
  // queue", which is not the same as "this queue is empty". Filing it under
  // "N queues are clear" would put an unmeasured queue in the one place a
  // reader has been told they need not look.
  const { waiting, clear } = partitionQueues([row({ count: null })]);
  assert.equal(clear.length, 0, 'an unmeasured queue must not be reported as clear');
  assert.equal(waiting.length, 1);
});

test('overdue outranks everything, including an empty count', () => {
  const { overdue, waiting, clear } = partitionQueues([
    row({ dueState: 'overdue', count: 0 }),
    row({ dueState: 'overdue', count: 3 }),
  ]);
  assert.equal(overdue.length, 2);
  assert.equal(waiting.length + clear.length, 0);
});

test('every row lands in exactly one bucket — none dropped, none duplicated', () => {
  // The whole point of collapsing is that nothing goes missing. A partition that
  // loses a row would hide a queue completely, which is worse than the density
  // problem it was written to solve.
  const rows = [
    row({ count: 0 }),
    row({ count: 4 }),
    row({ count: null }),
    row({ dueState: 'overdue', count: 2 }),
    row({ dueState: 'due-soon', count: 1 }),
    row({ dueState: 'ok', count: 0 }),
  ];
  const { overdue, waiting, clear } = partitionQueues(rows);
  assert.equal(overdue.length + waiting.length + clear.length, rows.length);
  const seen = new Set([...overdue, ...waiting, ...clear]);
  assert.equal(seen.size, rows.length, 'a row appeared in two buckets');
});

test('due-soon with items waits with the rest, not under clear', () => {
  const { waiting, clear } = partitionQueues([row({ dueState: 'due-soon', count: 2 })]);
  assert.equal(waiting.length, 1);
  assert.equal(clear.length, 0);
});
