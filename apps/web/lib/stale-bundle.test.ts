import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isStaleBundleError, reloadForStaleBundle, STALE_RELOAD_KEY } from './stale-bundle';

/**
 * A tab left open across a deploy shows "Application error: a client-side
 * exception has occurred" on a site that is serving perfectly.
 *
 * The owner hit it twice in one day and both times reasonably concluded we were
 * down. The second time, three deploys landed in half an hour while his page
 * sat open. Every vendor and couple with a tab open during a deploy sees the
 * same thing.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    size: () => map.size,
  };
}

test('the shapes a browser actually produces are recognised', () => {
  assert.ok(isStaleBundleError(Object.assign(new Error('x'), { name: 'ChunkLoadError' })));
  assert.ok(isStaleBundleError(new Error('Loading chunk 4821 failed.')));
  assert.ok(isStaleBundleError(new Error('Failed to fetch dynamically imported module: /_next/x.js')));
  assert.ok(isStaleBundleError(new Error('Importing a module script failed.'))); // Safari
  assert.ok(
    isStaleBundleError(
      new Error("Refused to execute script: 'text/html' is not a valid JavaScript MIME type"),
    ),
    'a 404 HTML page served where JS was expected is the same situation',
  );
});

test('a REAL crash is not mistaken for a stale tab', () => {
  // 🔑 The dangerous direction. Reloading on a genuine bug hides it behind a
  // refresh and loses the error the person could have reported.
  assert.equal(isStaleBundleError(new TypeError("Cannot read properties of undefined")), false);
  assert.equal(isStaleBundleError(new Error('Something on our end failed')), false);
  assert.equal(isStaleBundleError(null), false);
  assert.equal(isStaleBundleError(undefined), false);
  assert.equal(isStaleBundleError('Loading chunk 1 failed'), false, 'a bare string is not an error');
  assert.equal(isStaleBundleError({}), false);
});

test('it reloads once', () => {
  const s = fakeStorage();
  let reloads = 0;
  assert.equal(reloadForStaleBundle(s, () => (reloads += 1)), true);
  assert.equal(reloads, 1);
});

test('and never twice — an infinite refresh is worse than the message it replaces', () => {
  // 🔑 THE WHOLE REASON FOR THE MARKER. If the new build throws too, reloading
  // on every failure leaves a page nobody can read or leave.
  const s = fakeStorage();
  let reloads = 0;
  reloadForStaleBundle(s, () => (reloads += 1));
  assert.equal(reloadForStaleBundle(s, () => (reloads += 1)), false);
  assert.equal(reloadForStaleBundle(s, () => (reloads += 1)), false);
  assert.equal(reloads, 1);
});

test('the marker is written BEFORE the reload, not after', () => {
  // A reload never returns, so anything after the call never runs. Setting the
  // marker afterwards would mean it is never set and the loop is unbounded —
  // the exact bug this guard exists to prevent, hidden inside the guard.
  const s = fakeStorage();
  let markerAtReloadTime: string | null = null;
  reloadForStaleBundle(s, () => {
    markerAtReloadTime = s.getItem(STALE_RELOAD_KEY);
  });
  assert.equal(markerAtReloadTime, '1');
});

test('a healthy render clears it, so a later deploy gets its own reload', () => {
  const obs = readFileSync(
    join(process.cwd(), 'app/_components/deferred-observability.tsx'),
    'utf8',
  );
  assert.match(
    obs,
    /sessionStorage\.removeItem\(STALE_RELOAD_KEY\)/,
    'nothing clears the marker — the second stale bundle in a long session would never recover',
  );
  assert.match(obs, /catch \{/, 'private mode must degrade, not throw');
});

test('both boundaries use it — the root layout crash is the one error.tsx cannot catch', () => {
  for (const f of ['app/error.tsx', 'app/global-error.tsx']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.match(src, /isStaleBundleError\(error\)/, `${f} does not check for a stale bundle`);
    assert.match(
      src,
      /reloadForStaleBundle\(window\.sessionStorage/,
      `${f} detects a stale bundle and does nothing about it`,
    );
    // Deliberately not a regex over the argument list: the call contains its
    // own parentheses, and a pattern that tries to span them is a test that
    // fails on correct code — which is how a guard gets weakened to make it
    // pass. Assert the SHAPE that matters: the early return.
    const call = src.slice(src.indexOf('reloadForStaleBundle('));
    assert.ok(
      call.slice(0, 200).includes(') return;'),
      `${f} keeps running after starting a reload — the report below would file a ` +
        'crash that is really a deploy',
    );
  }
});
