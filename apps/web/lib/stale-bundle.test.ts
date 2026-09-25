import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEPLOYMENT_SKEW_FAILURE_KEY,
  isDeploymentSkewError,
  isStaleBundleError,
  reloadForDeploymentSkew,
  reloadForStaleBundle,
  STALE_RELOAD_KEY,
} from './stale-bundle';
// The real class Next throws for a rejected Server Action (see the
// "THIRD SHAPE" docblock in stale-bundle.ts) — imported from Next's own
// source, not reconstructed by hand, so this test proves the matcher against
// what the browser actually throws, not against a guess at its shape.
import { UnrecognizedActionError } from 'next/dist/client/components/unrecognized-action-error';

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

test('THE SAVE CASE: a stale ACTION reads the same as a stale script', () => {
  // Owner, 2026-09-15, reproduced live with the console open after pressing
  // Save on a guest. Measured both times it happened: the write had ALREADY
  // LANDED — the value was in the database, no 5xx was logged, and the error
  // screen showed no "Reference:" line because there was no server digest.
  //
  // Before this, the message matched none of the five patterns above, so the
  // boundary did not reload and the person was told "Something on our end
  // didn't work" about work that was safely saved.
  assert.ok(
    isStaleBundleError(new Error('An unexpected response was received from the server.')),
    'the Server Action transport error is a stale tab, not a crash',
  );
  assert.ok(
    isStaleBundleError(new Error('Failed to fetch RSC payload for https://x/y. Falling back.')),
    'the follow-up navigation payload is the same situation',
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

  // 🔑 THE NEW PATTERNS MUST NOT WIDEN THIS DOOR. The 2026-09-15 addition
  // catches a TRANSPORT failure; an action whose own code throws must still
  // reach a human. These are the shapes a genuinely broken Server Action
  // produces — server-side failures that Next serialises properly and that
  // arrive WITH a digest, which is precisely what the owner's screen lacked.
  for (const real of [
    new Error('An error occurred in the Server Components render.'),
    new Error('Failed to update guest: permission denied for table guests'),
    new Error('duplicate key value violates unique constraint'),
    new Error('An unexpected error occurred'), // near-miss wording: error != response
    new Error('The server responded with a status of 500'),
  ]) {
    assert.equal(
      isStaleBundleError(real),
      false,
      `"${real.message}" is a real failure and must NOT be reloaded away`,
    );
  }
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

/**
 * THE THIRD SHAPE: a rejected Server Action (2026-09-25 · POST /login 404
 * incident). See the docblock above `isDeploymentSkewError` in stale-bundle.ts
 * for why this needs its own matcher rather than a new STALE_PATTERNS regex.
 */

test('the real Next class is recognised — via next/navigation\'s own discriminator', () => {
  assert.ok(
    isDeploymentSkewError(
      new UnrecognizedActionError(
        'Server Action "40ba73abc123" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
      ),
    ),
    'unstable_isUnrecognizedActionError must recognise its own class',
  );
});

test('the shapes without the real class still match, defensively', () => {
  assert.ok(
    isDeploymentSkewError(Object.assign(new Error('x'), { name: 'UnrecognizedActionError' })),
    'a hand-built object with the right name is still a skew error',
  );
  assert.ok(
    isDeploymentSkewError(
      new Error(
        'Failed to find Server Action "40ba73abc123". This request might be from an older or newer deployment.',
      ),
    ),
    'the SERVER-side message (Vercel runtime log / action-utils.ts getActionNotFoundError) is recognised too',
  );
});

test('a real crash is not mistaken for deployment skew', () => {
  for (const real of [
    new TypeError('Cannot read properties of undefined'),
    new Error('Something on our end failed'),
    new Error('Failed to update guest: permission denied for table guests'),
    new Error('An unexpected response was received from the server.'), // the OTHER shape — not this one
    null,
    undefined,
    'Server Action was not found',
    {},
  ]) {
    assert.equal(
      isDeploymentSkewError(real),
      false,
      `"${String(real)}" must NOT be treated as deployment skew`,
    );
  }
});

test('isStaleBundleError and isDeploymentSkewError do not overlap — each shape has exactly one owner', () => {
  const skew = new UnrecognizedActionError('Server Action "x" was not found on the server.');
  assert.equal(isStaleBundleError(skew), false);
  const stale = new Error('An unexpected response was received from the server.');
  assert.equal(isDeploymentSkewError(stale), false);
});

test('reloadForDeploymentSkew reloads once and records why, sharing the one reload budget', () => {
  const s = fakeStorage();
  let reloads = 0;
  const err = new Error('Failed to find Server Action "abc". This request might be from an older or newer deployment.');
  assert.equal(reloadForDeploymentSkew(s, () => (reloads += 1), err), true);
  assert.equal(reloads, 1);
  const recorded = JSON.parse(s.getItem(DEPLOYMENT_SKEW_FAILURE_KEY) ?? '{}');
  assert.match(recorded.message, /Failed to find Server Action/);

  // Shares STALE_RELOAD_KEY with reloadForStaleBundle — a second reload of
  // EITHER shape in the same tab must not fire.
  assert.equal(reloadForDeploymentSkew(s, () => (reloads += 1), err), false);
  assert.equal(reloadForStaleBundle(s, () => (reloads += 1)), false);
  assert.equal(reloads, 1);
});

test('a healthy render clears the skew marker too, so a later deploy gets its own report', () => {
  const obs = readFileSync(
    join(process.cwd(), 'app/_components/deferred-observability.tsx'),
    'utf8',
  );
  assert.match(
    obs,
    /DEPLOYMENT_SKEW_FAILURE_KEY/,
    'DeferredObservability never reads the skew marker — the report is written but never sent',
  );
  assert.match(
    obs,
    /sessionStorage\.removeItem\(DEPLOYMENT_SKEW_FAILURE_KEY\)/,
    'nothing clears the skew marker — a later occurrence would re-send a stale report, or never send at all',
  );
});

test('both boundaries check deployment skew BEFORE the generic stale-bundle check', () => {
  for (const f of ['app/error.tsx', 'app/global-error.tsx']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.match(
      src,
      /isDeploymentSkewError\(error\)/,
      `${f} does not check for a rejected Server Action — the /login 404 incident would still crash here`,
    );
    assert.match(
      src,
      /reloadForDeploymentSkew\(window\.sessionStorage/,
      `${f} detects deployment skew and does nothing about it`,
    );
    const call = src.slice(src.indexOf('reloadForDeploymentSkew('));
    assert.ok(
      call.slice(0, 200).includes(') return;'),
      `${f} keeps running after starting a skew reload`,
    );
    // The skew check must come first in the file — it is the more specific
    // signal, and Next's own throw for it never satisfies the generic regexes.
    assert.ok(
      src.indexOf('isDeploymentSkewError(error)') < src.indexOf('isStaleBundleError(error)'),
      `${f} checks the generic shape before the specific one`,
    );
  }
});
