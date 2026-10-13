/**
 * invitation-retry.test.ts — THE GUEST'S ERROR SCREEN TRIES AGAIN ONCE, BY
 * ASKING THE SERVER, AND NEVER IN A LOOP (2026-10-13, guest-load fix).
 *
 *   1 · once per page per minute — a second failure inside the window stays
 *       on the honest error with its button; after the window it may again;
 *   2 · another page is its own count; storage that throws still stops (the
 *       module memory counts);
 *   3 · the boundary (`app/[slug]/error.tsx`): "Try again" AND the automatic
 *       retry both run `router.refresh()` + `reset()` in ONE transition — in
 *       Next 15 a bare `reset()` re-renders the failed page the browser already
 *       holds — and while they run the screen says "Still opening your
 *       invitation…". Proven in a browser on a page that fails once and then
 *       answers (handover: guest-load-fix.md); held here by its source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AUTO_RETRY_DELAY_MS,
  AUTO_RETRY_WINDOW_MS,
  claimAutoRetry,
  forgetAutoRetriesForTest,
  type RetryStore,
} from './invitation-retry';
import { stripComments } from './strip-comments';

function store(): RetryStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const refusing: RetryStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

test('1 · once per page per minute', () => {
  forgetAutoRetriesForTest();
  const s = store();
  const t0 = 1_000_000;
  assert.equal(claimAutoRetry(s, '/marco-marga', t0), true, 'the first failure did not retry');
  assert.equal(claimAutoRetry(s, '/marco-marga', t0 + 5_000), false, 'it retried again inside the minute — a loop');
  assert.equal(claimAutoRetry(s, '/marco-marga', t0 + AUTO_RETRY_WINDOW_MS - 1), false);
  assert.equal(claimAutoRetry(s, '/marco-marga', t0 + AUTO_RETRY_WINDOW_MS), true, 'a stall a minute later got no retry');
});

test('1b · a fresh tab (empty module memory) still reads the stored retry', () => {
  forgetAutoRetriesForTest();
  const s = store();
  assert.equal(claimAutoRetry(s, '/a', 10), true);
  forgetAutoRetriesForTest();
  assert.equal(claimAutoRetry(s, '/a', 20), false);
});

test('2 · another page is its own count; refusing storage still stops', () => {
  forgetAutoRetriesForTest();
  const s = store();
  assert.equal(claimAutoRetry(s, '/a', 0 + 1), true);
  assert.equal(claimAutoRetry(s, '/b', 2), true);
  assert.equal(claimAutoRetry(refusing, '/c', 3), true);
  assert.equal(claimAutoRetry(refusing, '/c', 4), false, 'with storage refusing, the page refreshed itself again');
  assert.equal(claimAutoRetry(null, '/c', 5), false);
});

test('3 · the wait is short enough to land after a typical stall, and below the minute', () => {
  assert.ok(AUTO_RETRY_DELAY_MS >= 1_500 && AUTO_RETRY_DELAY_MS <= 4_000);
  assert.ok(AUTO_RETRY_WINDOW_MS >= 60_000);
});

const BOUNDARY = stripComments(readFileSync(join(__dirname, '..', 'app', '[slug]', 'error.tsx'), 'utf8'));

test('3 · the boundary re-asks the server — refresh and reset together, in a transition, from BOTH paths', () => {
  const transitions = [...BOUNDARY.matchAll(/startTransition\(\(\)\s*=>\s*\{([^}]*)\}\)/g)].map((m) => m[1]!);
  assert.equal(transitions.length, 2, `expected the button and the automatic retry, found ${transitions.length} transitions`);
  for (const body of transitions) {
    assert.match(body, /router\.refresh\(\)/, 'a retry calls reset() without router.refresh() — it re-renders the failed page');
    assert.match(body, /reset\(\)/);
    assert.ok(body.indexOf('refresh()') < body.indexOf('reset()'), 'refresh must be asked before reset');
  }
  assert.ok(!/onClick=\{\(\)\s*=>\s*reset\(\)\}/.test(BOUNDARY), 'the button is a bare reset() again');
  assert.match(BOUNDARY, /onClick=\{openAgain\}/);
  assert.match(BOUNDARY, /claimAutoRetry\(/, 'the automatic retry is no longer counted');
  assert.match(BOUNDARY, /setTimeout\([\s\S]*AUTO_RETRY_DELAY_MS\)/);
});

test('3 · while it opens again the screen says so — never a dead end', () => {
  assert.match(BOUNDARY, /Still opening your invitation&hellip;/);
  assert.match(BOUNDARY, /This invitation didn&rsquo;t load\./, 'the honest error is gone');
  assert.match(BOUNDARY, /role="status"/);
});
