/**
 * a-malformed-guest-id-is-not-found.test.ts — every page and API route under a
 * `[guestId]` segment checks the id is a UUID BEFORE any query sees it.
 *
 * 🔴 WHAT HAPPENED (prod, 2026-09-29): `/dashboard/<event>/guests/{guest}`
 * rendered the global error boundary — "Something on our end didn't work" —
 * instead of a 404. The segment reached `.eq('guest_id', '{guest}')`, Postgres
 * rejected it (22P02 invalid input syntax for type uuid), and `fetchGuestById`
 * deliberately RE-THROWS every error except a missing relation. The page's own
 * `notFound()` never ran. `lib/is-uuid.ts` already existed for exactly this
 * (`/join/zzzbad` did the same), but only one route used it.
 *
 * The guard is keyed on the SEGMENT, not on a list of files, so a new route
 * under `[guestId]` is covered the day it is added.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { isUuid } from './is-uuid';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

function routesUnderGuestIdSegment(dir: string, inside = false, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      routesUnderGuestIdSegment(p, inside || name === '[guestId]', out);
    } else if (inside && (name === 'page.tsx' || name === 'route.ts')) {
      out.push(p);
    }
  }
  return out;
}

/** The first place the raw segment can reach the database. */
const FIRST_QUERY = /\.eq\(\s*'guest_id'\s*,\s*guestId\b|loadGuestCard\([^)]*guestId|fetchGuestById\([^)]*guestId/;

test('every [guestId] page and route checks isUuid(guestId) before any query', () => {
  const files = routesUnderGuestIdSegment(APP);
  assert.ok(files.length >= 2, `scan floor: found ${files.length} files under [guestId]`);

  const offenders: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const guard = src.search(/isUuid\(\s*guestId\s*\)/);
    const query = src.search(FIRST_QUERY);
    if (query === -1) continue; // never queries by the segment
    if (guard === -1 || guard > query) offenders.push(relative(APP, f).split(sep).join('/'));
  }
  assert.deepEqual(
    offenders,
    [],
    'these reach a query with the raw [guestId] before checking it is a UUID — a typed-in ' +
      'address like /guests/{guest} crashes the page (22P02) instead of a 404. Add ' +
      '`if (!isUuid(guestId)) notFound()` (or a 400 in an API route) first; see lib/is-uuid.ts.',
  );
});

test('the address that crashed is not a UUID; a real guest id is', () => {
  assert.equal(isUuid('{guest}'), false);
  assert.equal(isUuid('%7Bguest%7D'), false);
  assert.equal(isUuid('b5bb28ee-f50f-4242-84c5-0ecba3ba5572'), true);
});
