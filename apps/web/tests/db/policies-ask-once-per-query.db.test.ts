/**
 * GUARD — no public RLS policy may run a per-statement question once PER ROW.
 *
 * Migration 20271281556823 rewrote 548 policies so that auth.uid() & co.,
 * is_admin() / is_console_admin() and moderator_area_level(event_id, …) are
 * asked once per statement (see policy-asks-once.ts for the rewrite and why it
 * admits the same rows). This keeps it that way: on the FULL replayed schema,
 * every policy predicate must already be a fixed point of `askOnce`.
 *
 * WHY A GUARD AND NOT A HABIT. The usual way a policy is written in this repo
 * is to copy the latest CREATE POLICY for it out of an older migration file —
 * and every one of those older files still spells `auth.uid()` bare, because
 * applied migrations are never edited. Without this, the per-row calls come
 * back one copied policy at a time, invisibly: nothing about a bare call is
 * wrong, it is only slow (a guests read measured 21–27 ms with a user's JWT
 * against 1.5 ms as service_role, 2026-10-20).
 *
 * If this fails: write the call the way the message shows — `(SELECT auth.uid())`,
 * `(SELECT is_admin())`, or `event_id IN (SELECT l.event_id FROM
 * current_moderator_area_levels('<area>') l WHERE l.level …)`. Never widen
 * `askOnce` to make it pass, and never add an allow-list: a policy that truly
 * needs a per-row call (one whose argument is the row) is not one of these
 * three shapes and is not touched by this guard.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { askOnce, moderatorCallsAreMonotone } from './policy-asks-once';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});
after(async () => {
  await replay?.db.close();
});

type Pol = { tablename: string; policyname: string; qual: string | null; with_check: string | null };

async function pols(): Promise<Pol[]> {
  return (
    await replay.db.query<Pol>(
      `SELECT tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public'`,
    )
  ).rows;
}

test('every public policy asks auth.*, is_admin() and the delegate resolver once per statement', async () => {
  const all = await pols();
  assert.ok(all.length > 800, `read ${all.length} policies — the catalog query must not come back empty`);
  const slow: string[] = [];
  for (const p of all) {
    for (const clause of ['qual', 'with_check'] as const) {
      const e = p[clause];
      const want = askOnce(e);
      if (want !== e) slow.push(`public.${p.tablename} "${p.policyname}" ${clause}:\n    has:   ${e}\n    write: ${want}`);
    }
  }
  assert.equal(slow.length, 0, `${slow.length} predicates re-run a per-statement call for every row:\n${slow.slice(0, 15).join('\n')}`);
});

test('the guard can see a bare call (neutralisation)', () => {
  assert.notEqual(askOnce('(user_id = auth.uid())'), '(user_id = auth.uid())');
  assert.equal(askOnce('(user_id = ( SELECT auth.uid() AS uid))'), '(user_id = ( SELECT auth.uid() AS uid))');
  assert.notEqual(askOnce('(is_admin() OR (owner = 1))'), '(is_admin() OR (owner = 1))');
  assert.equal(askOnce('(( SELECT is_admin() AS is_admin) OR x)'), '(( SELECT is_admin() AS is_admin) OR x)');
  assert.equal(askOnce('is_admin_of(event_id)'), 'is_admin_of(event_id)', 'a different, row-taking function is not touched');
  assert.notEqual(
    askOnce("(moderator_area_level(event_id, 'guest_list'::text) IS NOT NULL)"),
    "(moderator_area_level(event_id, 'guest_list'::text) IS NOT NULL)",
  );
});

test('the monotone check refuses a resolver call under NOT / IS / a function', () => {
  const call = "moderator_area_level(event_id, 'seat_plan'::text) = 'edit'::text";
  assert.deepEqual(moderatorCallsAreMonotone(`((a = 1) OR (${call}))`), []);
  assert.deepEqual(moderatorCallsAreMonotone(`((a = 1) AND ((b = 2) OR (${call})))`), []);
  assert.notDeepEqual(moderatorCallsAreMonotone(`(NOT (${call}))`), []);
  assert.notDeepEqual(moderatorCallsAreMonotone(`((${call}) IS NOT TRUE)`), []);
  assert.notDeepEqual(moderatorCallsAreMonotone(`COALESCE((${call}), false)`), []);
  assert.notDeepEqual(moderatorCallsAreMonotone(`(moderator_area_level(event_id, 'x'::text) <> 'edit'::text)`), []);
});
