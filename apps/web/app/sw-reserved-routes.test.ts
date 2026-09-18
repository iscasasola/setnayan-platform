/**
 * GUARD — `public/sw.js`'s guest-slug RESERVED set must match `app/` exactly.
 *
 * WHY THIS EXISTS (LAU-41). `isDayOfGuestNavigation` in the service worker
 * decides whether a bare `/[segment]` navigation is a couple's guest slug (cache
 * it stale-while-revalidate) or a real site page (leave it on the network-first
 * fallback). It tells the two apart with a hand-maintained `RESERVED` set. Three
 * shipped routes — `creators`, `open-shop`, `tour` — were missing from that set,
 * so a guest whose personal slug never collides was fine, but any of those three
 * pages, opened offline-first, would have been served the stale DAYOF cache
 * instead of the real page.
 *
 * The root cause was never "three routes forgotten" — it is that the set is
 * hand-typed and nothing re-checks it against the routes that actually exist.
 * This guard recomputes the expected set from the top-level directories under
 * `app/` (excluding `_private`, `(route-groups)` and `[dynamic]` segments, none
 * of which produce a static first path segment) and fails if `sw.js` disagrees
 * in EITHER direction — a route added without updating `sw.js`, or a stale entry
 * for a route that no longer exists.
 *
 * Mutation-tested: deleting any one directory from the expected set (simulating
 * "a route shipped, sw.js wasn't told") turns this red; so does adding an entry
 * to RESERVED for a directory that isn't there.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const APP_DIR = path.join(import.meta.dirname, '..', 'app');
const SW_FILE = path.join(import.meta.dirname, '..', 'public', 'sw.js');

/** Top-level `app/` directories that produce a real, static first path segment. */
function expectedReservedRoutes(): string[] {
  return readdirSync(APP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('_')) // private folder, no route
    .filter((name) => !(name.startsWith('(') && name.endsWith(')'))) // route group, no segment
    .filter((name) => !(name.startsWith('[') && name.endsWith(']'))) // dynamic segment — the guest slug itself
    .sort();
}

/** Pulls the string literals out of `const RESERVED = new Set([ ... ]);` in sw.js. */
function actualReservedRoutes(): string[] {
  const src = readFileSync(SW_FILE, 'utf8');
  const start = src.indexOf('const RESERVED = new Set([');
  assert.notEqual(
    start,
    -1,
    'public/sw.js no longer declares `const RESERVED = new Set([...])` — ' +
      'isDayOfGuestNavigation was rewritten; update this guard to match its new shape.',
  );
  const open = src.indexOf('[', start);
  const close = src.indexOf(']', open);
  assert.ok(close > open, 'Could not find the closing `]` of the RESERVED set in sw.js.');
  const body = src.slice(open + 1, close);
  const matches = [...body.matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((s): s is string => s !== undefined);
  assert.ok(matches.length > 0, 'RESERVED set in sw.js parsed as empty — check the quoting.');
  return matches.sort();
}

test('sw.js RESERVED set matches every top-level app/ route directory', () => {
  const expected = expectedReservedRoutes();
  const actual = actualReservedRoutes();

  const missing = expected.filter((r) => !actual.includes(r));
  const stale = actual.filter((r) => !expected.includes(r));

  assert.deepEqual(
    missing,
    [],
    `public/sw.js RESERVED is missing route(s) that exist under app/: ${missing.join(', ')}. ` +
      'A guest whose day-of slug never collides is fine; anyone else navigating to one of ' +
      'these pages offline-first would be served the stale guest cache instead of the real page.',
  );
  assert.deepEqual(
    stale,
    [],
    `public/sw.js RESERVED lists route(s) that no longer exist under app/: ${stale.join(', ')}. ` +
      'Remove them (or restore the directory) so the set stays a true mirror of app/.',
  );
});
