/**
 * THE EMCEE'S QUESTIONS — who may read a couple's answers (migrations replayed).
 *
 * Covers 20271233982952_emcee_questionnaire (register row DAY-7). The answers
 * include "what the emcee must NOT say" — the estranged parent, the unannounced
 * pregnancy — so the audience is the product:
 *
 *   • the couple, via `current_couple_event_ids()` — never the member-wide
 *     `current_event_ids()`, which would hand it to every invited guest;
 *   • the host who ASKED, only while booked — both halves, so a booked caterer
 *     cannot read the host's answers;
 *   • NOT a coordinator (spec § 11 Q4: "only with approval", not built).
 *
 * Asserted on the catalog, not by acting as each role: PGlite has no JWT, so
 * `auth.uid()` cannot be impersonated (same reason as
 * song-desk-read-audience.db.test.ts). These are the exact predicates and grants
 * Postgres enforces in prod, read back after a full replay.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.db?.close?.();
});

type Policy = { policyname: string; cmd: string; roles: string; qual: string; with_check: string };

async function policies(table: string): Promise<Policy[]> {
  const r = await db.query<Policy>(
    `SELECT policyname, cmd, roles::text AS roles,
            coalesce(qual, '') AS qual, coalesce(with_check, '') AS with_check
     FROM pg_policies WHERE schemaname='public' AND tablename=$1`,
    [table],
  );
  return r.rows;
}

test('the question set carries no event — nothing about a couple can travel with it', async () => {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='vendor_questions'`,
  );
  const cols = r.rows.map((x) => x.column_name);
  assert.ok(cols.includes('prompt'), 'vendor_questions must exist after replay');
  assert.ok(
    !cols.some((c) => c.includes('event') || c === 'answer'),
    `vendor_questions grew a per-wedding column (${cols.join(', ')}) — answers must stay in event_question_answers`,
  );
});

for (const table of ['vendor_questions', 'event_question_answers']) {
  test(`anon holds NO privilege on ${table}`, async () => {
    const r = await db.query<{ priv: string }>(
      `SELECT privilege_type AS priv FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name=$1 AND grantee='anon'`,
      [table],
    );
    assert.deepEqual(r.rows, [], `the default ACL was not revoked on ${table}`);
  });

  test(`RLS is enabled on ${table} and no policy names anon`, async () => {
    const rls = await db.query<{ on: boolean }>(
      `SELECT relrowsecurity AS on FROM pg_class
       WHERE oid = ('public.' || $1)::regclass`,
      [table],
    );
    assert.equal(rls.rows[0]!.on, true);
    for (const p of await policies(table)) {
      assert.ok(!p.roles.includes('anon'), `${table}.${p.policyname} names anon`);
    }
  });
}

test('the couple lane is the COUPLE, not every event member', async () => {
  const couple = (await policies('event_question_answers')).filter((p) =>
    p.policyname.includes('_host_'),
  );
  assert.equal(couple.length, 2, 'expected the couple select + write policies');
  for (const p of couple) {
    const text = `${p.qual} ${p.with_check}`;
    assert.ok(text.includes('current_couple_event_ids'), `${p.policyname} must use the couple set`);
    assert.ok(
      !/current_event_ids\(\)/.test(text),
      `${p.policyname} uses current_event_ids() — every invited guest would read "what not to say"`,
    );
  }
});

test('a booked vendor reads only answers to questions they wrote', async () => {
  const lane = (await policies('event_question_answers')).find(
    (p) => p.policyname === 'event_question_answers_booked_vendor_select',
  );
  assert.ok(lane, 'the booked-vendor read lane must exist from the first migration (spec § 8)');
  assert.equal(lane.cmd, 'SELECT', 'a vendor must never write the couple’s answers');
  assert.ok(lane.qual.includes('current_vendor_booked_event_ids'), 'booked, not merely known');
  assert.ok(
    lane.qual.includes('vendor_questions') && lane.qual.includes('current_vendor_ids'),
    'without the ownership half, any booked supplier reads the host’s answers',
  );
});

test('no coordinator lane exists — the approval it needs is not built', async () => {
  for (const p of await policies('event_question_answers')) {
    const text = `${p.qual} ${p.with_check}`;
    assert.ok(
      !/moderator|coordinator/i.test(text),
      `${p.policyname} admits a coordinator — spec § 11 Q4 requires an approval first`,
    );
  }
});
