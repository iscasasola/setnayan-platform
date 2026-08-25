/**
 * GUARD — which room the Papic page opens on.
 *
 * The page was twenty cards in one scroll. It is now three rooms, and this is
 * the rule that decides which one a request lands in. It is pure precisely so it
 * can be tested without rendering a page — the alternative was a landing rule
 * nobody could check.
 *
 * 🔑 THE OUTCOME MAP IS THE HALF THAT ROTS. Roughly ninety-five `redirect()`
 * calls across four files send the couple back here with an outcome in the query
 * string, and not one carries a room. Deriving the room from the outcome means
 * one list to keep honest instead of ninety-five call sites — but it also means
 * a NEW outcome silently lands in the wrong room unless someone adds it. § 3
 * below fails when an action grows an outcome this map has never heard of.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAPIC_ROOMS, roomForOutcome, resolvePapicRoom } from './rooms';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = resolve(HERE, '..');

/* ── 1 · the landing rule ─────────────────────────────────────────────────── */

test('an explicit tab always wins — the couple clicked it', () => {
  for (const room of PAPIC_ROOMS) {
    assert.equal(
      resolvePapicRoom({
        requested: room,
        outcomes: { papic_pool_error: 'unknown_rung' },
        windowStart: '2026-01-01',
        windowEnd: '2026-01-02',
      }),
      room,
      'an outcome must never override a tab the couple chose',
    );
  }
});

test('a junk tab is ignored rather than trusted', () => {
  for (const junk of ['', 'PHOTOS', 'money', 'setup ', 1, null, undefined, {}]) {
    const got = resolvePapicRoom({ requested: junk, windowStart: null });
    assert.ok(
      (PAPIC_ROOMS as readonly string[]).includes(got),
      `junk tab ${JSON.stringify(junk)} produced ${got}`,
    );
  }
});

test('after a save, the couple lands where the save happened', () => {
  assert.equal(resolvePapicRoom({ outcomes: { style_set: '1' }, windowStart: null }), 'setup');
  assert.equal(
    resolvePapicRoom({ outcomes: { papic_pool_error: 'unavailable' }, windowStart: null }),
    'cameras',
  );
  assert.equal(
    resolvePapicRoom({ outcomes: { papic_purchased: '1' }, windowStart: null }),
    'cameras',
  );
});

test('🚨 an event whose window was never set lands on Set up, NOT Cameras', () => {
  // captureWindowState FAILS OPEN on absent bounds — correct there (a legacy
  // seat must never be bricked mid-party), wrong here. Without this branch an
  // unset event reads 'open' and the couple lands in Cameras with no hint that
  // the one thing stopping every camera is a date they have not picked.
  assert.equal(resolvePapicRoom({ windowStart: null, windowEnd: null }), 'setup');
  assert.equal(resolvePapicRoom({ windowStart: undefined }), 'setup');
});

test('the window decides the rest: before → Set up · open → Cameras · after → Photos', () => {
  const day = (d: string) => Date.parse(`${d}T06:00:00+08:00`);
  assert.equal(
    resolvePapicRoom({ windowStart: '2026-12-10', windowEnd: '2026-12-12', nowMs: day('2026-11-01') }),
    'setup',
  );
  assert.equal(
    resolvePapicRoom({ windowStart: '2026-12-10', windowEnd: '2026-12-12', nowMs: day('2026-12-11') }),
    'cameras',
  );
  assert.equal(
    resolvePapicRoom({ windowStart: '2026-12-10', windowEnd: '2026-12-12', nowMs: day('2027-01-05') }),
    'photos',
  );
});

test('the window is a whole Manila day at both ends', () => {
  // The DATE-columns-are-instants bug cost six of thirteen prod seats every
  // shutter tap. The landing rule must not re-introduce it at either edge.
  const start = Date.parse('2026-12-10T00:05:00+08:00');
  const end = Date.parse('2026-12-12T23:55:00+08:00');
  assert.equal(resolvePapicRoom({ windowStart: '2026-12-10', windowEnd: '2026-12-12', nowMs: start }), 'cameras');
  assert.equal(resolvePapicRoom({ windowStart: '2026-12-10', windowEnd: '2026-12-12', nowMs: end }), 'cameras');
});

/* ── 2 · the outcome map ──────────────────────────────────────────────────── */

test('an unmapped query says nothing about a room', () => {
  assert.equal(roomForOutcome({}), null);
  assert.equal(roomForOutcome({ something_else: '1' }), null);
});

test('an outcome present but empty still counts — a failure often carries no text', () => {
  // `?limited_synced=` with no value is how a redirect reports "done, nothing to
  // say". Treating that as absent would land the couple in the wrong room on
  // exactly the quiet successes.
  assert.equal(roomForOutcome({ limited_synced: '' }), 'cameras');
  assert.equal(roomForOutcome({ papic_window_saved: '' }), 'setup');
});

/* ── 3 · the map cannot fall behind the actions ───────────────────────────── */

/** Every `?key=` this route's server actions redirect back with. */
function outcomeKeysFromActions(): Set<string> {
  const keys = new Set<string>();
  for (const name of readdirSync(ROUTE)) {
    if (!name.endsWith('actions.ts')) continue;
    const src = readFileSync(join(ROUTE, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    // ⚠ SCOPED TO REDIRECTS THAT LAND ON *THIS* PAGE. A first cut matched every
    // `?key=` in the file and reported `seat_set` / `seat_error` — which redirect
    // to the /crew child page and are read there, correctly — plus `next`, a
    // login param. A guard that cries wolf teaches you to skim past the one time
    // it is right. The page is `…/studio/papic?…`; a further path segment is a
    // different page with its own params.
    // Two shapes reach this page: the literal path, and a `back` variable that
    // was assigned this page's path (face-tagging / vendor-visibility do the
    // latter). Matching only the literal missed both of those files entirely —
    // and they are two of the silent-save outcomes.
    const targetsThisPage =
      /const back = `\/dashboard\/\$\{eventId\}\/studio\/papic`/.test(src);
    const patterns = [/\/studio\/papic\?([^`'"\n]*)/g];
    if (targetsThisPage) patterns.push(/\$\{back\}\?([^`'"\n]*)/g);
    for (const m of patterns.flatMap((re) => [...src.matchAll(re)])) {
      for (const kv of m[1]!.split('&')) {
        const key = kv.split('=')[0]?.trim();
        if (key && /^[a-zA-Z_]+$/.test(key)) keys.add(key);
      }
    }
  }
  return keys;
}

test('the scan finds the outcome keys (a guard reading nothing passes everything)', () => {
  const keys = outcomeKeysFromActions();
  assert.ok(keys.size >= 10, `expected the route's redirect outcomes, found ${keys.size}`);
  assert.ok(keys.has('papic_pool_error'), 'a known outcome must be found');
});

test('🚨 every outcome an action redirects with has a room', () => {
  // ⚠ NOT a style rule. An unmapped outcome means a couple who just paid, or
  // just failed to pay, is dropped into whichever room the date happens to
  // pick — and their confirmation is in a room they are not looking at.
  const unmapped = [...outcomeKeysFromActions()]
    .filter((k) => k !== 'tab')
    .filter((k) => roomForOutcome({ [k]: '1' }) === null)
    .sort();
  assert.deepEqual(
    unmapped,
    [],
    `these outcomes have no room, so their confirmation can land where nobody is looking:\n  ${unmapped.join('\n  ')}`,
  );
});
