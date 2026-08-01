/**
 * The poster QR — one code, anyone scans, camera on the shared pool.
 *
 * Owner-locked 2026-08-01: **"No limit — first come, first served."**
 *
 * So the interesting assertions are NOT about limits. They are about the two
 * things that stay true when there is no limit:
 *
 *   • nothing is minted on a GET — a link previewer must not burn cameras;
 *   • the token is a CAPABILITY — never derived from anything guessable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PAPIC_POOL_JOIN_INDEX_BASE,
  resolvePapicPoolToken,
} from './papic-pool-join';
import {
  PAPIC_CAMERA_INDEX_BASE,
  PAPIC_FREE_CAMERA_INDEX_BASE,
  PAPIC_FREE_ONE_CAMERA_INDEX,
} from './papic-cameras';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('poster seats sit clear of every other seat range', () => {
  // A poster camera must never be mistakable for a free pool camera, the free
  // Papic One, or a paid extra — in a query or by eye.
  assert.ok(PAPIC_POOL_JOIN_INDEX_BASE > PAPIC_CAMERA_INDEX_BASE);
  assert.ok(PAPIC_POOL_JOIN_INDEX_BASE > PAPIC_FREE_ONE_CAMERA_INDEX);
  assert.ok(PAPIC_POOL_JOIN_INDEX_BASE > PAPIC_FREE_CAMERA_INDEX_BASE);
  // A gap, not an adjacency: paid extras grow upward from their own base, so
  // the poster base must leave them room rather than sit one above.
  assert.ok(
    PAPIC_POOL_JOIN_INDEX_BASE - PAPIC_CAMERA_INDEX_BASE >= 50,
    'leave the paid range room to grow',
  );
});

test('a blank or short token never reaches the database', () => {
  // A capability check that queries first would let an empty string match a row
  // whose column is somehow empty too. Refuse before the round trip.
  const exploded = { from: () => { throw new Error('must not query'); } };
  for (const bad of ['', '   ', 'short', 'x'.repeat(15)]) {
    assert.doesNotThrow(async () => {
      const out = await resolvePapicPoolToken(exploded as never, bad);
      assert.equal(out, null);
    });
  }
});

test('🪤 the camera is minted on POST only — never on GET', () => {
  // Chat apps and link previewers fetch a URL the moment it is pasted. If the
  // page minted the camera, sharing the poster in a group chat would burn seats
  // and anonymous auth rows before a single guest scanned it.
  const page = read('app/papic/pool/[token]/page.tsx');
  for (const forbidden of [
    'provisionPoolJoinSeatAdmin',
    'signInAnonymously',
    'ensurePapicPoolToken',
  ]) {
    assert.ok(
      !page.includes(forbidden),
      `the poster PAGE must not call ${forbidden} — a GET must mint nothing. ` +
        `It belongs in the server action, which only runs on POST.`,
    );
  }
  const action = read('app/papic/pool/[token]/actions.ts');
  assert.match(action, /^'use server';/, 'the action must be a server action');
  assert.match(action, /provisionPoolJoinSeatAdmin\(/);
  assert.match(action, /signInAnonymously\(/);
});

test('the join action refuses a dead poster before minting anything', () => {
  const action = read('app/papic/pool/[token]/actions.ts');
  // Order matters: resolve → Papic on → pool exists → THEN a session. Minting an
  // anonymous user for a dead poster leaves orphan auth rows behind.
  const iResolve = action.indexOf('resolvePapicPoolToken(');
  const iActive = action.indexOf('eventPapicActive(');
  const iPool = action.indexOf('fetchEventPoolStatus(');
  const iAnon = action.indexOf('signInAnonymously(');
  const iSeat = action.indexOf('provisionPoolJoinSeatAdmin(');
  assert.ok(iResolve > 0 && iActive > iResolve, 'resolve before the active check');
  assert.ok(iPool > iActive, 'active check before the pool check');
  assert.ok(iAnon > iPool, 'every refusal before the anonymous session');
  assert.ok(iSeat > iAnon, 'session before the seat');
});

test('the token is never derived from anything guessable', () => {
  const lib = read('lib/papic-pool-join.ts');
  // It is minted by the same CSPRNG that mints seat claim tokens. A token built
  // from the event id or the slug would let anyone who can read a URL bar shoot
  // into a stranger's gallery.
  assert.match(lib, /generateSeatClaimToken\(\)/);
  assert.ok(
    !/papic_pool_token:\s*(eventId|`|slug)/.test(lib),
    'the token must not be built from the event id or slug',
  );
});
