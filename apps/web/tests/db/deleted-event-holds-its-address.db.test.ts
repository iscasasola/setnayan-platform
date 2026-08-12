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
  RETIRED_SLUG_HOLD_MONTHS,
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

test('DELETING AN EVENT HOLDS ITS ADDRESS — no app code involved', async () => {
  // The load-bearing one. A raw SQL DELETE stands in for prod's own RLS policy
  // `couple_can_delete_event`, which lets a couple delete their wedding through
  // PostgREST with no server action running. If the hold lived in the app, this
  // test could not exist and that path would silently free the word.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name) VALUES ('doomed-wedding', 'birthday', 'Probe')
     RETURNING event_id`,
  );
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [ev.rows[0]!.event_id]);

  const { rows } = await db.query<{ entity_type: string; days: number }>(
    `SELECT entity_type, (redirect_until::date - now()::date) AS days
       FROM public.slug_change_log WHERE old_slug = 'doomed-wedding'`,
  );
  assert.equal(
    rows.length,
    1,
    'deleting an event did not hold its address — the word is free the same second, and a ' +
      'guest following a printed invitation would land on whoever took it next',
  );
  assert.equal(rows[0]!.entity_type, 'event_closed');
  assert.ok(rows[0]!.days > 700, `held only ${rows[0]!.days} days; the rule is two years`);

  assert.equal(
    (await db.query<{ free: boolean }>(
      `SELECT public.business_slug_is_available('doomed-wedding') AS free`,
    )).rows[0]!.free,
    false,
    'the held address is still being handed out',
  );
});

test('the sweep can delete an abandoned draft WITHOUT holding its address', async () => {
  // The one deliberate opt-out. If this stops working, every abandoned
  // anonymous draft burns its couple's natural address for two years.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name) VALUES ('abandoned-draft', 'birthday', 'Probe')
     RETURNING event_id`,
  );
  await db.query(`SELECT public.sweep_delete_abandoned_events(ARRAY[$1]::uuid[])`, [
    ev.rows[0]!.event_id,
  ]);
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.slug_change_log WHERE old_slug = 'abandoned-draft'`,
  );
  assert.equal(rows[0]!.n, 0, 'the sweep held a draft address it was meant to release');

  // …and the opt-out did NOT leak to the next delete IN THE SAME TRANSACTION.
  //
  // ⚠ THIS HAS TO BE ONE EXPLICIT TRANSACTION OR IT PROVES NOTHING. A
  // transaction-local setting dies at COMMIT, so two separate statements each
  // get a clean session and the assertion cannot fail however the function is
  // written — measured: deleting the restore left this green. Wrapping both in
  // one transaction is what makes the leak observable, and is also the shape a
  // real caller doing more work after the sweep would have.
  const ev2 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name) VALUES ('real-wedding-after', 'birthday', 'Probe')
     RETURNING event_id`,
  );
  const ev3 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name) VALUES ('swept-in-txn', 'birthday', 'Probe')
     RETURNING event_id`,
  );
  await db.query('BEGIN');
  await db.query(`SELECT public.sweep_delete_abandoned_events(ARRAY[$1]::uuid[])`, [
    ev3.rows[0]!.event_id,
  ]);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [ev2.rows[0]!.event_id]);
  const held = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.slug_change_log WHERE old_slug = 'real-wedding-after'`,
  );
  await db.query('COMMIT');
  assert.equal(
    held.rows[0]!.n,
    1,
    'the skip flag outlived its statement — a real wedding deleted afterwards in the same ' +
      'transaction lost its hold, and its address is free immediately',
  );
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
  // ⚠ WAS ONE YEAR (owner-locked 2026-08-10). Owner 2026-08-12: "make it 2
  // years" — a retired address is now out of circulation for exactly as long as
  // a renamed one keeps forwarding.
  assert.equal(RETIRED_SLUG_HOLD_MONTHS, 24, 'the owner rule is two years');
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
