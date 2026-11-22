/**
 * 💳 Two production deploys minutes apart must not show a payer the crash card (22 Nov 2026, live on /pay:
 * PAGE_CRASH "crash global" right after the second of two deploys five minutes apart). The reload budget is one per
 * BUILD (lib/stale-bundle.ts `reloadBudgetSpent`), and a real bug inside one build still shows the card the second time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STALE_RELOAD_KEY, reloadBudgetSpent, reloadForDeploymentSkew, reloadForInterruptedRequest, reloadForStaleBundle } from '@/lib/stale-bundle';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

test('two quick deploys: the tab on build A reloads, lands on B, hits the next cutover, and reloads again', () => {
  const storage = memoryStorage();
  let reloads = 0;
  const reload = () => void reloads++;
  // Deploy 1 cuts over while the tab runs build A.
  assert.equal(reloadForStaleBundle(storage, reload, 'build-a'), true);
  assert.equal(storage.m.get(STALE_RELOAD_KEY), 'build-a');
  // The reload landed on build B; deploy 2 cuts over before any page cleared the marker.
  assert.equal(reloadForStaleBundle(storage, reload, 'build-b'), true, 'a new cutover gets its own reload');
  assert.equal(reloads, 2);
  // The same holds whichever shape the second cutover throws.
  assert.equal(reloadForDeploymentSkew(storage, reload, new Error('Failed to find Server Action "x"'), 'build-c'), true);
  assert.equal(reloadForInterruptedRequest(storage, reload, true, () => {}, 'build-d'), true);
  assert.equal(reloads, 4);
});

test('one real bug in a single build: one reload, then the card — never a loop', () => {
  const storage = memoryStorage();
  let reloads = 0;
  const reload = () => void reloads++;
  assert.equal(reloadForStaleBundle(storage, reload, 'build-b'), true);
  // Reloaded into the SAME build, which throws the same shape again.
  assert.equal(reloadForStaleBundle(storage, reload, 'build-b'), false);
  assert.equal(reloadForDeploymentSkew(storage, reload, new Error('Failed to find Server Action "x"'), 'build-b'), false);
  assert.equal(reloadForInterruptedRequest(storage, reload, true, () => {}, 'build-b'), false);
  assert.equal(reloads, 1);
  assert.equal(reloadBudgetSpent(storage, 'build-b'), true);
});

test('no build stamped (a local build): the old once-per-session rule; an old "1" marker never blocks a stamped tab', () => {
  const unstamped = memoryStorage();
  let reloads = 0;
  const reload = () => void reloads++;
  assert.equal(reloadForStaleBundle(unstamped, reload, ''), true);
  assert.equal(reloadForStaleBundle(unstamped, reload, ''), false);
  assert.equal(reloads, 1);

  const legacy = memoryStorage();
  legacy.setItem(STALE_RELOAD_KEY, '1');
  assert.equal(reloadBudgetSpent(legacy, 'build-b'), false, 'a marker from before this change names no build');
  assert.equal(reloadBudgetSpent(legacy, ''), true);
});
