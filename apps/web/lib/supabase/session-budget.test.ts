/**
 * The sign-in check's time budget — the fix for the 2026-08-20 outage, where an
 * unbounded auth call on every request turned a sick database into 504s on the
 * whole site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_CHECK_BUDGET_MS, withBudget, type BudgetOutcome } from './session-budget';

test('a fast answer comes back whole', async () => {
  const r = await withBudget(async () => 'the user', 1000);
  assert.deepEqual(r, { ok: true, value: 'the user' });
});

test('🔴 a hung call gives up at its budget instead of holding the page forever', async (t) => {
  // 🕰 FAKE CLOCK. This used to measure `Date.now()` around a real 40ms timer
  // and demand it came back inside a second — which is a claim about how busy
  // the CI machine is, not about this code, and it flaked. With the clock
  // faked, "gives up at its budget" is asserted exactly: not one tick early,
  // and on the tick it is due.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let settled: BudgetOutcome<unknown> | null = null;
  const done = withBudget(() => new Promise(() => {}), 40).then((r) => {
    settled = r;
  });
  const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

  t.mock.timers.tick(39);
  await drain();
  assert.equal(settled, null, 'it gave up before its budget ran out');

  t.mock.timers.tick(1);
  await done;
  assert.deepEqual(settled, { ok: false, reason: 'timeout' });
});

test('a rejection degrades exactly like a timeout — the caller must not tell them apart', async () => {
  const r = await withBudget(async () => {
    throw new Error('auth is down');
  }, 1000);
  assert.equal(r.ok, false);
});

test('the budget is short enough to matter — the platform kills the request at ~25s', () => {
  assert.ok(
    SESSION_CHECK_BUDGET_MS <= 5_000,
    `The budget is ${SESSION_CHECK_BUDGET_MS}ms. Anything near the platform's own ` +
      'limit gives the visitor a hung page instead of a served one, which is the ' +
      'defect this exists to fix.',
  );
  assert.ok(SESSION_CHECK_BUDGET_MS >= 1_000, 'too tight — a healthy but busy database would trip it');
});

test('the timer never outlives the answer', async (t) => {
  // A leaked timer keeps a serverless invocation alive after the response is
  // sent, and is billed for.
  //
  // 🪤 THE FIRST VERSION OF THIS TEST COULD NOT FAIL. It counted
  // `process._getActiveHandles()`, which does NOT include timers — deleting the
  // `clearTimeout` left it green (mutation M28). `getActiveResourcesInfo()`
  // does list them, as 'Timeout'. **A guard that watches the wrong list is a
  // guard that watches nothing.**
  //
  // 🕰 And the SECOND version counted every live 'Timeout' in the process
  // before and after — a global count any other timer (the runner's own
  // included) can move, so it could flake. Now it follows the one handle:
  // the deadline timer `withBudget` created must be the one it cleared.
  const set = t.mock.method(globalThis, 'setTimeout');
  const clear = t.mock.method(globalThis, 'clearTimeout');
  await withBudget(async () => 'quick', 30_000);
  const deadlines = set.mock.calls.filter((c) => c.arguments[1] === 30_000);
  assert.equal(deadlines.length, 1, 'withBudget did not set exactly one deadline timer');
  const handle = deadlines[0]!.result;
  assert.ok(
    clear.mock.calls.some((c) => c.arguments[0] === handle),
    'a 30s timer is still pending after the answer came back in microseconds',
  );
});
