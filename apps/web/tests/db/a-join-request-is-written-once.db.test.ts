/**
 * A JOIN REQUEST IS WRITTEN ONCE — event-day L1·3 (migration 20271273586425,
 * `public.guest_join_request_create`), run against the REPLAYED schema.
 *
 * Before: the ask-to-join door inserted a request row and notified the couple
 * on every submit, so a double tap (or a retry after the redirect was lost on
 * venue signal) made two requests and two "Someone asked to join" notices; the
 * per-event ceiling was a COUNT in the app before the INSERT.
 *
 * PGlite is one session, so the race itself is not staged; the property the
 * event lock protects is — the SECOND call with the same form key, made after
 * the first committed, writes nothing and says so (`created: false`), and the
 * ceiling is counted inside the function. The lock + order is read from the SQL.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the same-key lookup removed from the function          → tests 1, 3, 5 red;
 *   • the ceiling refusal removed                            → tests 3, 5 red;
 *   • the lock removed                                       → test 5 red;
 *   • the app notifies before asking `created`               → test 6 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let seq = 0;

const ROOT = join(__dirname, '..', '..');
const MIGRATION = join(ROOT, '..', '..', 'supabase', 'migrations', '20271273586425_a_join_request_is_written_once.sql');

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function seedEvent(): Promise<string> {
  const { rows } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Ask', 'birthday', $1) RETURNING event_id`,
    [`ask-once-${seq++}`],
  );
  return rows[0]!.event_id;
}

/** The p_row `createJoinRequest` builds for an accountless asker. */
const row = (first: string) => ({
  first_name: first,
  last_name: 'Reyes',
  side: 'both',
  group_category: 'other',
  role: 'guest',
  entry_source: 'self_added_unlisted',
  email: null,
  rsvp_status: 'attending',
  rsvp_responded_at: new Date().toISOString(),
  meal_preference: 'fish',
  dietary_restrictions: null,
  guest_note: 'see you',
  mobile: '+639171234421',
  notes: null,
  updated_at: new Date().toISOString(),
});

type Out = { status: string; guest_id?: string; created?: boolean };
async function ask(eventId: string, key: string | null, first = 'Carla', ceiling = 1000): Promise<Out> {
  const r = await db.query<{ out: Out }>(
    `SELECT public.guest_join_request_create($1, $2::uuid, $3, $4::jsonb) AS out`,
    [eventId, key, ceiling, JSON.stringify(row(first))],
  );
  return r.rows[0]!.out;
}
const requests = async (eventId: string) =>
  (
    await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.guests WHERE event_id = $1 AND entry_source = 'self_added_unlisted' AND deleted_at IS NULL`,
      [eventId],
    )
  ).rows[0]!.n;

const FORM_A = '2d8e4c6a-3b5f-4a7c-9d9e-0f1a2b3c4d5e';
const FORM_B = '3e9f5d7b-4c6a-4b8d-8e0f-1a2b3c4d5e6f';

test('the same form sent twice is ONE request — the second is told it already exists', async () => {
  const ev = await seedEvent();
  const a = await ask(ev, FORM_A);
  const b = await ask(ev, FORM_A);
  assert.equal(a.status, 'ok');
  assert.equal(a.created, true);
  assert.equal(b.status, 'ok');
  assert.equal(b.created, false, 'a resubmitted form made a second request');
  assert.equal(b.guest_id, a.guest_id);
  assert.equal(await requests(ev), 1);
  const kept = await db.query<{ entry_source: string; meal: string; rsvp: string }>(
    `SELECT entry_source::text AS entry_source, meal_preference::text AS meal, rsvp_status::text AS rsvp FROM public.guests WHERE guest_id = $1`,
    [a.guest_id],
  );
  assert.deepEqual(kept.rows[0], { entry_source: 'self_added_unlisted', meal: 'fish', rsvp: 'attending' });
});

test('two forms are two requests, and a form with no key writes as it always did', async () => {
  const ev = await seedEvent();
  await ask(ev, FORM_A, 'Ana');
  await ask(ev, FORM_B, 'Ben');
  await ask(ev, null, 'Cy');
  await ask(ev, null, 'Cy');
  assert.equal(await requests(ev), 4);
});

test('the ceiling is counted inside the writer', async () => {
  const ev = await seedEvent();
  assert.equal((await ask(ev, FORM_A, 'One', 2)).status, 'ok');
  assert.equal((await ask(ev, FORM_B, 'Two', 2)).status, 'ok');
  assert.equal((await ask(ev, null, 'Three', 2)).status, 'ceiling');
  assert.equal(await requests(ev), 2);
  // …and the repeat of a form already written is still answered at the ceiling.
  assert.equal((await ask(ev, FORM_A, 'One', 2)).created, false);
});

test('only the server can call it', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege($1, 'public.guest_join_request_create(uuid, uuid, integer, jsonb)', 'EXECUTE') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]!.ok, false, `${role} may write a request`);
  }
});

test('the repeat and the ceiling are asked under a lock on the event, before the insert', () => {
  const sql = readFileSync(MIGRATION, 'utf8').replace(/--[^\n]*/g, '');
  const lock = sql.indexOf('pg_advisory_xact_lock');
  assert.ok(lock > -1, 'the writer takes no lock');
  assert.match(sql.slice(lock, lock + 120), /p_event_id/, 'the lock is not keyed on the event');
  const repeat = sql.indexOf('join_request_key = p_request_key');
  const ceiling = sql.indexOf("'ceiling'");
  const insert = sql.indexOf('INSERT INTO public.guests');
  assert.ok(lock < repeat && repeat < insert && lock < ceiling && ceiling < insert, 'a check moved outside the lock or after the insert');
});

test('the app writes through it, tells the couple only about a NEW request, and both forms carry a browser-made key', () => {
  const src = readFileSync(join(ROOT, 'app', 'join', '[eventId]', 'actions.ts'), 'utf8');
  const fn = src.slice(src.indexOf('async function createJoinRequest('), src.indexOf('function backToDoor('));
  assert.ok(fn.length > 500, 'createJoinRequest moved — re-point this guard');
  assert.doesNotMatch(fn, /from\('guests'\)\s*\.insert\(/, 'a request is inserted outside the locked writer again');
  assert.match(fn, /rpc\('guest_join_request_create'/);
  const again = fn.indexOf('outcome.created === false');
  const notify = fn.indexOf('await notifyCoupleUnlisted(');
  assert.ok(again > -1 && notify > -1 && again < notify, 'the couple is told before the repeat is asked');
  assert.equal((src.match(/requestKey: readRequestKey\(formData\)/g) ?? []).length, 2, 'a join action stopped passing the form key');
  for (const f of [['app', 'join', '[eventId]', '_components', 'request-form.tsx'], ['app', '[slug]', '_components', 'get-inside.tsx']]) {
    assert.match(readFileSync(join(ROOT, ...f), 'utf8'), /<RequestKeyInput \/>/, `${f.join('/')} lost its key`);
  }
  const input = readFileSync(join(ROOT, 'app', '_components', 'request-key-input.tsx'), 'utf8');
  assert.match(input, /^'use client';/, 'the key must be minted in the browser, never in a (cacheable) server render');
  assert.match(input, /useEffect\(\(\) => \{\s*setKey\(/);
});
