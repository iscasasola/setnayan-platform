/**
 * The sign-in check's time budget — the fix for the 2026-08-20 outage, where an
 * unbounded auth call on every request turned a sick database into 504s on the
 * whole site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_CHECK_BUDGET_MS, withBudget } from './session-budget';

test('a fast answer comes back whole', async () => {
  const r = await withBudget(async () => 'the user', 1000);
  assert.deepEqual(r, { ok: true, value: 'the user' });
});

test('🔴 a hung call gives up instead of holding the page forever', async () => {
  const started = Date.now();
  const r = await withBudget(() => new Promise(() => {}), 40);
  assert.deepEqual(r, { ok: false, reason: 'timeout' });
  assert.ok(Date.now() - started < 1000, 'it waited far longer than its budget');
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

test('the timer never outlives the answer', async () => {
  // A leaked timer keeps a serverless invocation alive after the response is
  // sent, and is billed for.
  //
  // 🪤 THE FIRST VERSION OF THIS TEST COULD NOT FAIL. It counted
  // `process._getActiveHandles()`, which does NOT include timers — deleting the
  // `clearTimeout` left it green (mutation M28). `getActiveResourcesInfo()`
  // does list them, as 'Timeout'. **A guard that watches the wrong list is a
  // guard that watches nothing.**
  const timers = () =>
    process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
  const before = timers();
  await withBudget(async () => 'quick', 30_000);
  assert.equal(
    timers(),
    before,
    'a 30s timer is still pending after the answer came back in microseconds',
  );
});
