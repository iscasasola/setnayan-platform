/**
 * A NOTICE KNOWS WHICH WEDDING IT IS ABOUT — AND SURVIVES LOSING IT.
 *
 * `public.notifications` carried no `event_id` from iteration 0028 until
 * `20271238868040_notifications_know_their_event.sql`. Everything that needed
 * per-event notices had to match the uuid as a SUBSTRING of `related_url`;
 * `sever_event_connections()` says so in its own comment. This file pins the
 * three things that can go wrong with the column now that it exists.
 *
 * ─── 🪤 1 · THE BACKFILL'S `EXISTS` GUARD IS LOAD-BEARING ─────────────────
 * The derived id is only whatever the link SAID, so it can name an event that
 * no longer exists. `event_id` is a foreign key — without the EXISTS guard, one
 * stale uuid does not skip one row, it makes the UPDATE raise and takes the
 * WHOLE MIGRATION down with it, on a `db push` that fail-closes the production
 * deploy. So the test builds exactly that row and asserts the statement still
 * completes.
 *
 * ─── 🪤 2 · THE STATEMENT UNDER TEST IS THE MIGRATION'S OWN TEXT ──────────
 * The backfill is READ OUT OF THE MIGRATION FILE and executed, not retyped
 * here. A copy would let the two drift the moment someone edited one of them,
 * and the copy would keep passing — which is the whole failure mode this file
 * is supposed to catch.
 *
 * ─── 🪤 3 · SET NULL, NOT CASCADE, AND THE DIFFERENCE IS VISIBLE ──────────
 * Deleting a wedding must leave its notices standing, exactly as it does today.
 * CASCADE would sweep that event's order and payment notices — the outcome
 * `sever_event_connections()` deliberately avoided — and a schema-only
 * assertion ("the constraint says SET NULL") would not notice if some later
 * trigger deleted them anyway. So the event is really deleted and the rows are
 * counted afterwards.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const MIGRATION = '20271238868040_notifications_know_their_event.sql';

/** The migration's own backfill statement, lifted from the file it ships in. */
function backfillStatement(): string {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations',
    MIGRATION,
  );
  const sql = readFileSync(path, 'utf8');
  const start = sql.indexOf('UPDATE public.notifications n');
  assert.notEqual(start, -1, `${MIGRATION} must still contain the backfill UPDATE`);
  const end = sql.indexOf(';', start);
  assert.notEqual(end, -1, 'the backfill UPDATE must be terminated');
  return sql.slice(start, end + 1);
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [name],
  );
  return e.rows[0]!.event_id;
}

/** Service-role writes, the way `emitNotification` inserts. */
async function notify(
  userId: string,
  relatedUrl: string | null,
  eventId?: string | null,
): Promise<string> {
  const r = await db.query<{ notification_id: string }>(
    `INSERT INTO public.notifications (user_id, type, title, related_url, event_id)
     VALUES ($1,'order_paid','A supplier did something',$2,$3)
     RETURNING notification_id`,
    [userId, relatedUrl, eventId ?? null],
  );
  return r.rows[0]!.notification_id;
}

test('the column exists, is nullable, and is indexed for the per-event read', async () => {
  const col = await db.query<{ data_type: string; is_nullable: string }>(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='notifications' AND column_name='event_id'`,
  );
  assert.equal(col.rows.length, 1, 'notifications.event_id must exist');
  assert.equal(col.rows[0]!.data_type, 'uuid');
  assert.equal(
    col.rows[0]!.is_nullable,
    'YES',
    'account-level notices (a connection request, a security alert) have no event',
  );

  const idx = await db.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes
      WHERE schemaname='public' AND indexname='notifications_event_created_idx'`,
  );
  assert.equal(idx.rows.length, 1, 'the per-event feed needs its index');
  assert.match(idx.rows[0]!.indexdef, /event_id/);
  assert.match(
    idx.rows[0]!.indexdef,
    /WHERE \(event_id IS NOT NULL\)/,
    'partial — account-level notices are never read this way',
  );
});

test('the foreign key is SET NULL, so deleting a wedding does not erase its notices', async () => {
  const user = await newUser('setnull@test.com');
  const event = await newEvent('Deleted Later');
  const kept = await notify(user, `/dashboard/${event}/orders/abc`, event);

  // The constraint says SET NULL …
  const fk = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
       JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' AND t.relname='notifications'
        AND c.contype='f' AND pg_get_constraintdef(c.oid) LIKE '%events%'`,
  );
  assert.equal(fk.rows.length, 1, 'exactly one FK from notifications to events');
  assert.match(fk.rows[0]!.def, /ON DELETE SET NULL/);

  // … and the behaviour agrees, through whatever triggers fire on the way.
  await db.exec(`DELETE FROM public.events WHERE event_id = '${event}'`);
  const after = await db.query<{ event_id: string | null }>(
    `SELECT event_id FROM public.notifications WHERE notification_id = $1`,
    [kept],
  );
  assert.equal(after.rows.length, 1, 'the notice must survive its wedding');
  assert.equal(after.rows[0]!.event_id, null, 'and be orphaned, not deleted');
});

test('the backfill fills event-scoped links and leaves everything else alone', async () => {
  const user = await newUser('backfill@test.com');
  const event = await newEvent('Backfilled');

  // Rows as history holds them: no event_id, only a link.
  const scoped = await notify(user, `/dashboard/${event}/vendors/xyz/workspace#payments`);
  const bare = await notify(user, `/dashboard/${event}`);
  const account = await notify(user, '/dashboard/people');
  const admin = await notify(user, '/admin/payments');
  const noUrl = await notify(user, null);
  // 🪤 The row the EXISTS guard exists for: a well-formed uuid that is not an
  // event. Without the guard this raises and the migration dies.
  const stale = await notify(user, '/dashboard/2f3c1a44-0000-4000-8000-000000000000/orders/x');
  // 🪤 And a uuid with trailing characters, which must not match at all.
  const trailing = await notify(user, `/dashboard/${event}EXTRA/guests`);

  await db.exec(backfillStatement());

  const read = async (id: string) =>
    (
      await db.query<{ event_id: string | null }>(
        `SELECT event_id FROM public.notifications WHERE notification_id = $1`,
        [id],
      )
    ).rows[0]!.event_id;

  assert.equal(await read(scoped), event, 'the first uuid in the path is the event');
  assert.equal(await read(bare), event, 'the bare event root counts too');
  assert.equal(await read(account), null, '/dashboard/people is not an event');
  assert.equal(await read(admin), null, 'admin links have no event');
  assert.equal(await read(noUrl), null, 'no link, no event');
  assert.equal(await read(stale), null, 'a uuid that is not an event stays null');
  assert.equal(await read(trailing), null, 'a uuid with a suffix is not a match');
});

test('the backfill is idempotent and never unsets a value a caller passed', async () => {
  const user = await newUser('idem@test.com');
  const eventA = await newEvent('Link Says A');
  const eventB = await newEvent('Caller Said B');

  // A caller passed B explicitly while the link points at A — the caller wins,
  // and re-running the backfill must not "correct" it, because the backfill
  // only touches rows where event_id IS NULL.
  const explicit = await notify(user, `/dashboard/${eventA}/orders/x`, eventB);

  await db.exec(backfillStatement());
  await db.exec(backfillStatement());

  const r = await db.query<{ event_id: string | null }>(
    `SELECT event_id FROM public.notifications WHERE notification_id = $1`,
    [explicit],
  );
  assert.equal(r.rows[0]!.event_id, eventB, 'an explicit event_id is never overwritten');
});
