/**
 * ❓ QUESTIONS FOR THE COUPLE — EVERY SUPPLIER (migrations replayed).
 *
 * Covers 20271312612416_questions_every_supplier (owner 2026-11-04, "Yes, every supplier"). The answers can hold
 * what a supplier must never say out loud, so the audience is still the product:
 *
 *   • an ask (`event_question_requests`) is sent by the supplier ONLY into an event they already talk to (a
 *     `chat_threads` row) — never into a stranger's event;
 *   • the second answer-read lane is ASKED AND OWN QUESTION — a supplier who asked never reads another supplier's
 *     answers (the host's "what I must not say" stays the host's);
 *   • the ask carries no question text and no answer — the split stays three tables;
 *   • no anon, no coordinator, no DELETE.
 *
 * Asserted on the catalog (PGlite has no JWT), the same way emcee-questionnaire-audience.db.test.ts does.
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

test('the ask carries no question text and no answer', async () => {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='event_question_requests'`,
  );
  const cols = r.rows.map((x) => x.column_name).sort();
  assert.ok(cols.includes('event_id') && cols.includes('vendor_profile_id'), 'event_question_requests must exist');
  assert.ok(!cols.some((c) => c.includes('prompt') || c.includes('answer')), `the ask grew content: ${cols.join(', ')}`);
});

test('RLS is on, anon holds nothing, and an ask is never deleted', async () => {
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.event_question_requests'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
  const grants = await db.query<{ grantee: string; priv: string }>(
    `SELECT grantee, privilege_type AS priv FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='event_question_requests' AND grantee IN ('anon','authenticated')`,
  );
  assert.ok(!grants.rows.some((g) => g.grantee === 'anon'), 'the default ACL was not revoked for anon');
  assert.ok(!grants.rows.some((g) => g.priv === 'DELETE'), 'an ask must not be deletable — the couple may have answered');
  for (const p of await policies('event_question_requests')) {
    assert.ok(!p.roles.includes('anon'), `${p.policyname} names anon`);
    assert.ok(p.cmd !== 'DELETE' && p.cmd !== 'ALL', `${p.policyname} opens ${p.cmd}`);
  }
});

test('a supplier sends only into an event they already talk to', async () => {
  const writes = (await policies('event_question_requests')).filter((p) => p.cmd === 'INSERT' || p.cmd === 'UPDATE');
  assert.equal(writes.length, 2, 'expected the supplier insert + update policies');
  for (const p of writes) {
    assert.match(p.with_check, /current_vendor_ids/, `${p.policyname}: own row only`);
    assert.match(p.with_check, /chat_threads/, `${p.policyname}: only into an event with a conversation`);
  }
});

test('the asked-supplier answer lane is ASKED AND OWN QUESTION', async () => {
  const lane = (await policies('event_question_answers')).find(
    (p) => p.policyname === 'event_question_answers_asked_vendor_select',
  );
  assert.ok(lane, 'the asked lane must exist');
  assert.equal(lane.cmd, 'SELECT', 'a supplier must never write the couple’s answers');
  assert.match(lane.qual, /event_question_requests/, 'asked, not merely known');
  assert.ok(
    lane.qual.includes('vendor_questions') && (lane.qual.match(/current_vendor_ids/g) ?? []).length >= 2,
    'without the ownership half, a supplier who asked reads every other supplier’s answers',
  );
  // The booked lane is unchanged beside it.
  const booked = (await policies('event_question_answers')).find(
    (p) => p.policyname === 'event_question_answers_booked_vendor_select',
  );
  assert.ok(booked && booked.qual.includes('current_vendor_booked_event_ids'));
});

test('still no coordinator lane on the answers or the asks', async () => {
  for (const table of ['event_question_answers', 'event_question_requests']) {
    for (const p of await policies(table)) {
      assert.ok(!/moderator|coordinator/i.test(`${p.qual} ${p.with_check}`), `${table}.${p.policyname} admits a coordinator`);
    }
  }
});
