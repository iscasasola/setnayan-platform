/**
 * A STALE TAB IS RECOVERED AT EVERY BOUNDARY — Build 5 Step 0 row 29 (F6, 2026-11-10).
 *
 * Seen live: Create on a service card saved, `/vendor-dashboard/shop?saved=1&created=draft` drew the crash page, and
 * the console carried ONE 429. What was rate-limited:
 *   · not Supabase — its edge logs hold zero 429s for that window (only 400/401/403);
 *   · not one of our own limiters — none of the requests a single create makes is near its ceiling (upload 120/min,
 *     telemetry 40/min/IP, slug check 60/min); a route-handler 429 also leaves no Vercel log line;
 *   · the browser's report to Sentry's ingest (`ingest.us.sentry.io`, the DSN is live in the production bundle): the
 *     crash fires an error event and, on a signed-in screen, a whole on-error session replay
 *     (`replaysOnErrorSampleRate: 1.0`) — and Sentry answers 429 when the quota / spike protection is hit.
 * And WHY there was a crash at all: #7424 taught the reload to recognise webpack's missing-module error — but only
 * `app/error.tsx` reloaded, and the supplier pages are caught first by `app/vendor-dashboard/error.tsx`, which did not.
 *
 * Fixed twice over: every segment boundary recovers a stale tab (`recoverStaleTab`), and a stale-tab error is never
 * sent to Sentry (`isRecoverableTabError` in `beforeSend`). A normal create then draws no crash and sends no report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STALE_RELOAD_KEY, isRecoverableTabError, recoverStaleTab } from './stale-bundle';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(WEB, 'app');

/** The exact error from the owner's phone: webpack's runtime calling `.call` on a module the new build lacks. */
function webpackMissingModule(): TypeError {
  const e = new TypeError("Cannot read properties of undefined (reading 'call')");
  e.stack =
    "TypeError: Cannot read properties of undefined (reading 'call')\n" +
    '    at c (https://setnayan.com/_next/static/chunks/webpack-0a1b2c3d.js:1:128)\n' +
    '    at 4321 (https://setnayan.com/_next/static/chunks/app/vendor-dashboard/shop/page-9f8e.js:1:900)';
  return e;
}

function withFakeWindow<T>(run: (reloads: () => number) => T): T {
  const store = new Map<string, string>();
  let reloads = 0;
  const g = globalThis as unknown as { window?: unknown; navigator?: unknown };
  const prevWindow = g.window;
  g.window = {
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    location: { reload: () => void (reloads += 1) },
    addEventListener: () => {},
  };
  try {
    return run(() => reloads);
  } finally {
    g.window = prevWindow;
  }
}

test('the Create → Shop stale tab reloads once, and only once', () => {
  withFakeWindow((reloads) => {
    assert.equal(recoverStaleTab(webpackMissingModule()), true);
    assert.equal(reloads(), 1);
    assert.equal(recoverStaleTab(webpackMissingModule()), false, 'a second failure must show the card, never loop');
    assert.equal(reloads(), 1);
    assert.ok(STALE_RELOAD_KEY.length > 0);
  });
});

test('a real crash is not mistaken for a stale tab', () => {
  withFakeWindow((reloads) => {
    assert.equal(recoverStaleTab(new Error('relation "vendor_services" does not exist')), false);
    assert.equal(reloads(), 0);
  });
  assert.equal(isRecoverableTabError(new Error('boom')), false);
  assert.equal(isRecoverableTabError(webpackMissingModule()), true);
});

function errorBoundaries(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'dev') errorBoundaries(p, out);
    } else if (e.name === 'error.tsx' || e.name === 'global-error.tsx') out.push(p);
  }
  return out;
}

test('every error boundary recovers a stale tab before it draws a crash', () => {
  const files = errorBoundaries(APP);
  assert.ok(files.length >= 6, `only ${files.length} boundaries found — the walk is broken`);
  const missing: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const reExport = /export \{ default \} from '([^']+)'/.exec(src);
    if (reExport) continue; // e.g. papic/me re-exports the [slug] boundary, which is checked on its own
    const shared = /recoverStaleTab\(error\)/.test(src);
    const inline = /isStaleBundleError\(error\)/.test(src) && /reloadForStaleBundle\(/.test(src);
    if (!shared && !inline) missing.push(relative(APP, f));
  }
  assert.deepEqual(
    missing,
    [],
    'These boundaries draw a crash for a tab that is merely older than the deploy (the F6 Create → Shop case):\n  ' +
      missing.join('\n  '),
  );
});

test('a stale-tab error is never sent to Sentry', () => {
  const src = stripComments(readFileSync(join(APP, '_components', 'deferred-observability.tsx'), 'utf8'));
  assert.match(
    src,
    /beforeSend:\s*\(event, hint\)\s*=>\s*isRecoverableTabError\(hint\?\.originalException\)\s*\?\s*null/,
    'the browser files stale-tab errors (plus an on-error replay) against the Sentry quota again — the 429',
  );
});
