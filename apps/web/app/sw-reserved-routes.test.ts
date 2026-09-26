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
 * `app/` (excluding `_private` and `[dynamic]` segments, neither of which
 * produces a static first path segment) and fails if `sw.js` disagrees in
 * EITHER direction — a route added without updating `sw.js`, or a stale entry
 * for a route that no longer exists.
 *
 * 🔑 A `(route-group)` IS WALKED INTO, NOT SKIPPED (fixed 2026-09-27). A group
 * adds no URL segment, so `app/(shell)/pricing/page.tsx` serves `/pricing` —
 * a real first segment. This guard used to skip group folders entirely, and so
 * did the set it guards: 21 public pages that live only under `(shell)` —
 * /pricing, /privacy, /terms, /budget, /marketplace, /pa3d … — were never in
 * RESERVED, so the service worker treated each as a couple's guest slug and
 * could serve it stale from the day-of cache: the /monogram bug (owner
 * 2026-06-19) on 21 pages at once, invisible because the guard shared the
 * blind spot it was meant to catch. Same walk as `scripts/gen-reserved-slugs.mjs`,
 * which always descended into groups.
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

const isGroup = (name: string) => name.startsWith('(') && name.endsWith(')');

/**
 * Every directory that produces a real, static FIRST path segment: the
 * top-level `app/` folders, plus the folders directly inside a route group
 * (recursively — a group adds no segment, so its children are first segments).
 */
function firstSegments(dir: string, out: Set<string>, viaGroup: Set<string> | null): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('_')) continue; // private folder, no route
    if (name.startsWith('[') && name.endsWith(']')) continue; // dynamic segment — the guest slug itself
    if (isGroup(name)) {
      firstSegments(path.join(dir, name), out, viaGroup ?? new Set());
      continue;
    }
    out.add(name);
    if (viaGroup) viaGroup.add(name);
  }
}

function expectedReservedRoutes(): string[] {
  const out = new Set<string>();
  firstSegments(APP_DIR, out, null);
  return [...out].sort();
}

/** First segments that exist ONLY because a route group was walked into. */
function groupOnlyRoutes(): string[] {
  const all = new Set<string>();
  const viaGroup = new Set<string>();
  firstSegments(APP_DIR, all, null);
  // Re-walk just the groups to learn which words they contribute.
  for (const entry of readdirSync(APP_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && isGroup(entry.name)) {
      firstSegments(path.join(APP_DIR, entry.name), new Set(), viaGroup);
    }
  }
  const topLevel = readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  return [...viaGroup].filter((w) => !topLevel.includes(w)).sort();
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

// SABOTAGE: restore the old "skip route groups" filter in firstSegments →
// this goes RED (the group-only words vanish from `expected`, and the mirror
// test reports them as stale in sw.js). And removing any one group-only word
// from sw.js → the mirror test reports it missing.
test('pages that live only inside a route group are reserved too', () => {
  const groupOnly = groupOnlyRoutes();
  assert.ok(
    groupOnly.length > 0,
    'no first segment comes only from a (route-group) — either every group page gained a top-level ' +
      'twin, or the walk stopped descending into groups and this guard went blind again',
  );
  const expected = expectedReservedRoutes();
  const actual = actualReservedRoutes();
  for (const w of groupOnly) {
    assert.ok(expected.includes(w), `${w} lives in a route group but the walk did not produce it`);
    assert.ok(actual.includes(w), `public/sw.js RESERVED is missing group page /${w}`);
  }
});
