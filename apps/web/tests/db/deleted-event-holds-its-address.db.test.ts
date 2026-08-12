/**
 * GUARD — a deleted wedding's address cannot be reissued for a year.
 *
 * Owner 2026-08-12: *"a retired website address will only be usable again after
 * 1 year."* Measured in prod before this shipped: `bbgh`, the final address of
 * an already-deleted wedding, was claimable the SAME SECOND — every invitation
 * and printed QR carrying it could have been handed to a stranger.
 *
 * Every other retirement already held its word. Deletion was the hole.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  CLOSED_EVENT_SLUG_ENTITY_TYPE,
  CLOSED_SHOP_SLUG_HOLD_DAYS,
} from '../../lib/closed-shop-slug';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the database accepts the deleted-event hold type', async () => {
  // A phantom enum/CHECK value is REJECTED, not thrown — the insert would fail
  // and the app's best-effort write would swallow it, leaving the address free
  // while everything looked fine.
  await db.query(
    `INSERT INTO public.slug_change_log (entity_type, entity_id, old_slug, new_slug, redirect_until)
     VALUES ($1, gen_random_uuid(), 'gone-wedding', 'gone-wedding', now() + interval '365 days')`,
    [CLOSED_EVENT_SLUG_ENTITY_TYPE],
  );
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.slug_change_log WHERE old_slug = 'gone-wedding'`,
  );
  assert.equal(rows[0]!.n, 1, 'the CHECK constraint refused the hold type');
});

test('the hold BLOCKS the address being reissued', async () => {
  // The whole point. `business_slug_is_available` matches on old_slug with no
  // entity_type filter, deliberately — holds nobody, blocks everybody.
  const { rows } = await db.query<{ free: boolean }>(
    `SELECT public.business_slug_is_available('gone-wedding') AS free`,
  );
  assert.equal(
    rows[0]!.free,
    false,
    'a deleted wedding’s address is still being handed out — the guest following a printed ' +
      'invitation would land on a stranger’s page',
  );
});

test('the hold FORWARDS NOBODY — there is nothing left to forward to', async () => {
  // Mirrors `vendor_closed`. Encoding a deletion as a rename would work and
  // would lie, and the resolver would chase an event that no longer exists.
  assert.equal(CLOSED_EVENT_SLUG_ENTITY_TYPE, 'event_closed');
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../../lib/slug-forwarding.ts', import.meta.url), 'utf8'),
  );
  assert.match(
    src,
    /FORWARDING_ENTITY_TYPES = \['event', 'vendor', 'user'\]/,
    'the forwarding types changed — a _closed hold must never be forwarded',
  );
});

test('the hold releases after a year, not sooner and not never', async () => {
  assert.equal(CLOSED_SHOP_SLUG_HOLD_DAYS, 365, 'the owner rule is one year');
  const { rows } = await db.query<{ free: boolean }>(
    `SELECT public.business_slug_is_available('released-wedding') AS free`,
  );
  assert.equal(rows[0]!.free, true, 'precondition: this word is otherwise free');

  await db.query(
    `INSERT INTO public.slug_change_log (entity_type, entity_id, old_slug, new_slug, redirect_until)
     VALUES ($1, gen_random_uuid(), 'released-wedding', 'released-wedding', now() - interval '1 day')`,
    [CLOSED_EVENT_SLUG_ENTITY_TYPE],
  );
  const after = await db.query<{ free: boolean }>(
    `SELECT public.business_slug_is_available('released-wedding') AS free`,
  );
  assert.equal(
    after.rows[0]!.free,
    true,
    'an EXPIRED hold must free the word — otherwise the ledger is a one-way ratchet and no ' +
      'address ever returns to the pool',
  );
});
