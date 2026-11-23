/**
 * ✍️ ONE EDITOR PER PART — asserted against the REPLAYED schema (migration 20271360932916), every call through a real
 * `authenticated` session (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE EDITOR PER PART — APPROVED TO
 * BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/desktop_split_view_v2_fable.html`, frames 3–5).
 *
 *   1 · THE LOCK — one editor per part: the first edit-level person holds Guests; a second editor is told
 *       "held_by_other" with the holder's name; a view-level helper and a stranger never hold it; another part is its
 *       own lock.
 *   2 · THE 5 s RELEASE — the part frees itself 5 seconds after the editor stops (server clock): at 4 s it is still
 *       held, at 6 s it is free, the next editor takes it and the old holder's touch answers "lost".
 *   3 · HOST TAKE-OVER — a host can always take over (a non-host cannot); the bumped person's touch and read answer
 *       "taken_over" with the host's name; they cannot take it back while the host edits; once the host stops they
 *       claim it again and the notice clears.
 *   4 · RELEASE — the holder frees it at once; nobody frees a peer's pen.
 *
 * 🛡 Sabotage (each turns this file red): `INTERVAL '5 seconds'` → `'90 seconds'` in acquire (test 2) · drop
 *    `AND v_is_host` from the take-over branch (test 3, Ben takes over) · drop the `bumped_user_id = v_uid` branch of
 *    touch (test 3, Ria is told "lost", not who took it).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const W = { eventId: '', claire: '', ria: '', ben: '', looker: '', stranger: '' };

type Env = { status: string; lock_id?: string; holder_label?: string; holder_is_host?: boolean; taken_by_label?: string | null; can_take_over?: boolean; can_edit?: boolean };

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
}
async function asUser<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}
async function newUser(email: string): Promise<string> {
  return one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, '{"account_type":"customer"}'::jsonb) RETURNING id AS v`, [email]);
}
async function helper(uid: string, level: 'edit' | 'view'): Promise<void> {
  const areas = `jsonb_build_object('guest_list', '${level}', 'schedule', '${level}')`;
  await db.query(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, 'wedding_planner_external', jsonb_build_object('edit_all', false, 'checkout', false, 'areas', ${areas}), $2, $3, now())`,
    [W.eventId, W.claire, uid],
  );
}

const acquire = (uid: string, part: string, label: string, takeOver = false) =>
  asUser<Env>(uid, `SELECT public.acquire_part_editor_lock($1, $2, $3, $4) AS v`, [W.eventId, part, label, takeOver]);
const touch = (uid: string, lockId: string) => asUser<Env>(uid, `SELECT public.touch_part_editor_lock($1) AS v`, [lockId]);
const release = (uid: string, lockId: string) => asUser<{ released: number }>(uid, `SELECT public.release_part_editor_lock($1) AS v`, [lockId]);
const state = (uid: string, part = 'guests') => asUser<Env>(uid, `SELECT public.part_editor_lock_state($1, $2) AS v`, [W.eventId, part]);
/** Move the holder's last edit `seconds` into the past — the clock, without waiting for it. */
async function stoppedFor(part: string, seconds: number): Promise<void> {
  await db.query(
    `UPDATE public.event_part_editor_locks SET last_edit_at = NOW() - make_interval(secs => $3) WHERE event_id = $1 AND part = $2`,
    [W.eventId, part, seconds],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W.claire = await newUser('claire@part-lock.test');
  W.ria = await newUser('ria@part-lock.test');
  W.ben = await newUser('ben@part-lock.test');
  W.looker = await newUser('looker@part-lock.test');
  W.stranger = await newUser('stranger@part-lock.test');
  W.eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Claire & Indalecio', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [W.eventId, W.claire]);
  await helper(W.ria, 'edit');
  await helper(W.ben, 'edit');
  await helper(W.looker, 'view');
});

after(async () => {
  await replay?.db.close();
});

test('1 · the lock — one editor per part; the others are told who', async () => {
  const r = await acquire(W.ria, 'guests', 'Ria');
  assert.equal(r.status, 'acquired', JSON.stringify(r));
  assert.ok(r.lock_id);

  const b = await acquire(W.ben, 'guests', 'Ben');
  assert.equal(b.status, 'held_by_other', 'a second editor got the pen');
  assert.equal(b.holder_label, 'Ria');

  const host = await state(W.claire);
  assert.equal(host.status, 'held');
  assert.equal(host.holder_label, 'Ria');
  assert.equal(host.can_take_over, true, 'the host is not offered the take-over');
  assert.equal((await state(W.ben)).can_take_over, false, 'a helper is offered the take-over');

  assert.equal((await acquire(W.looker, 'guests', 'Looker')).status, 'not_authorized', 'a view-level helper held the pen');
  const lookerSees = await state(W.looker);
  assert.equal(lookerSees.status, 'held', 'a view-level helper is not told who is editing');
  assert.equal(lookerSees.can_edit, false);
  assert.equal((await state(W.stranger)).status, 'not_authorized', 'a stranger was told about the event');
  assert.equal((await acquire(W.stranger, 'guests', 'Stranger')).status, 'not_authorized');

  // Another part is its own lock.
  assert.equal((await acquire(W.ben, 'schedule', 'Ben')).status, 'acquired', 'Guests being edited locked the Schedule');
  // Not a part at all.
  assert.equal((await acquire(W.claire, 'memories', 'Claire')).status, 'not_authorized');

  // Mine again → refreshed, and my touch keeps it.
  assert.equal((await acquire(W.ria, 'guests', 'Ria')).status, 'refreshed');
  assert.equal((await touch(W.ria, r.lock_id!)).status, 'ok');
});

test('2 · the 5 s release — the part frees itself 5 seconds after the editor stops', async () => {
  const ria = await acquire(W.ria, 'guests', 'Ria');
  assert.ok(['acquired', 'refreshed'].includes(ria.status), JSON.stringify(ria));

  await stoppedFor('guests', 4);
  assert.equal((await state(W.claire)).status, 'held', 'freed before 5 s');
  assert.equal((await acquire(W.ben, 'guests', 'Ben')).status, 'held_by_other', 'Ben took it before 5 s');

  await stoppedFor('guests', 6);
  assert.equal((await state(W.claire)).status, 'free', 'still held 6 s after Ria stopped');
  const ben = await acquire(W.ben, 'guests', 'Ben');
  assert.equal(ben.status, 'acquired', 'the next editor could not take a freed part');
  assert.equal((await touch(W.ria, ria.lock_id!)).status, 'lost', 'Ria still thinks she holds it');
  assert.equal((await state(W.ria)).holder_label, 'Ben');

  // A pause with nobody else claiming keeps it: the holder's touch after 6 s still answers ok.
  await stoppedFor('guests', 6);
  assert.equal((await touch(W.ben, ben.lock_id!)).status, 'ok', 'a pause nobody used lost the holder the pen');
  await release(W.ben, ben.lock_id!);
});

test('3 · host take-over — a host can always take over; the bumped person is told and keeps nothing of the pen', async () => {
  const ria = await acquire(W.ria, 'guests', 'Ria');
  assert.equal(ria.status, 'acquired', JSON.stringify(ria));

  assert.equal((await acquire(W.ben, 'guests', 'Ben', true)).status, 'held_by_other', 'a helper took over');

  const claire = await acquire(W.claire, 'guests', 'Claire', true);
  assert.equal(claire.status, 'took_over', JSON.stringify(claire));

  const told = await touch(W.ria, ria.lock_id!);
  assert.equal(told.status, 'taken_over', 'the bumped person was not told');
  assert.equal(told.taken_by_label, 'Claire');
  const riaSees = await state(W.ria);
  assert.equal(riaSees.status, 'held');
  assert.equal(riaSees.holder_label, 'Claire');
  assert.equal(riaSees.taken_by_label, 'Claire');
  assert.equal((await state(W.ben)).taken_by_label ?? null, null, 'someone who was not bumped was told');

  // "Put it back" stays grey while Claire edits: Ria cannot claim it.
  assert.equal((await acquire(W.ria, 'guests', 'Ria')).status, 'held_by_other', 'the bumped person took it back from a live host');

  // Claire stops; Ria claims it again and the notice clears.
  await stoppedFor('guests', 6);
  assert.equal((await acquire(W.ria, 'guests', 'Ria')).status, 'acquired');
  assert.equal((await state(W.ria)).taken_by_label ?? null, null, 'the take-over notice outlived the claim');
});

test('4 · release — the holder frees it at once; nobody frees a peer’s pen', async () => {
  const ria = await acquire(W.ria, 'guests', 'Ria');
  assert.ok(['acquired', 'refreshed'].includes(ria.status));
  assert.equal((await release(W.ben, ria.lock_id!)).released, 0, 'Ben freed Ria’s pen');
  assert.equal((await state(W.claire)).status, 'held');
  assert.equal((await release(W.ria, ria.lock_id!)).released, 1);
  assert.equal((await state(W.claire)).status, 'free');
});
