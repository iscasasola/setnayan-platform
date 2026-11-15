/**
 * ARTICLES HOLD THEIR RULES IN THE SCHEMA — proved against the full replayed
 * schema (migration `…_articles_topics_and_replies.sql`; DECISION_LOG 2026-11-16).
 *
 * Each claim is a fact the database refuses to break, not a convention a page
 * keeps:
 *   1. ONE CODE PER PERSON PER TOPIC — a second code for the same person in the
 *      same topic is refused; two people cannot share a code in one topic; the
 *      same person gets a separate row (and so a separate code) in another topic.
 *   2. A REPLY NEEDS ITS AUTHOR'S CODE — no code row, no reply.
 *   3. ANONYMOUS TO READERS — a signed-in reader who is not Setnayan can select
 *      NOTHING from the four tables (Pattern F), so the real account is never
 *      reachable from a browser; an admin can.
 *   4. THE COUNT FOLLOWS THE THREAD — a reply raises reply_count; removing it
 *      lowers it; a removed post stays as a row (its place in the thread).
 *   5. REPORTS — 'article_topic' / 'article_reply' are reportable with no event;
 *      and a shop report ('vendor', event_id NULL) is accepted too.
 *
 * Not vacuous: each refusal is preceded by the accepted case it differs from.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let alice: string;
let bob: string;
let admin: string;
let topicA: string;
let topicB: string;

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function refused(sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    await db.query('SAVEPOINT s');
    await db.query(sql, params);
    await db.query('RELEASE SAVEPOINT s');
    return false;
  } catch {
    await db.query('ROLLBACK TO SAVEPOINT s').catch(() => {});
    return true;
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec('BEGIN');
  alice = await newUser('articles-alice@example.test');
  bob = await newUser('articles-bob@example.test');
  admin = await newUser('articles-admin@example.test');
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [admin]);
  topicA = (
    await db.query<{ topic_id: string }>(
      `INSERT INTO public.article_topics (author_user_id, title, body) VALUES ($1, 'Is a first look worth it?', 'We are split.') RETURNING topic_id`,
      [alice],
    )
  ).rows[0]!.topic_id;
  topicB = (
    await db.query<{ topic_id: string }>(
      `INSERT INTO public.article_topics (author_user_id, title) VALUES ($1, 'Debut ideas') RETURNING topic_id`,
      [bob],
    )
  ).rows[0]!.topic_id;
});
after(async () => {
  await db?.exec('ROLLBACK').catch(() => {});
  await db?.close();
});

test('a topic is live the moment it is written (no approval state)', async () => {
  const r = await db.query<{ removed_at: string | null; public_id: string }>(
    `SELECT removed_at, public_id FROM public.article_topics WHERE topic_id = $1`,
    [topicA],
  );
  assert.equal(r.rows[0]!.removed_at, null);
  assert.match(r.rows[0]!.public_id, /^S89A-[0-9A-Z]{10}$/);
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name IN ('article_topics','article_replies')`,
  );
  const names = cols.rows.map((c) => c.column_name);
  for (const gate of ['approved_at', 'status', 'is_approved', 'pending']) {
    assert.ok(!names.includes(gate), `a "${gate}" column would make posts wait for the team — ruling 1 says live at once`);
  }
});

test('one code per person per topic, never shared, a fresh one in another topic', async () => {
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'3F','guest')`, [topicA, alice]),
    false,
    'the first code for a person in a topic is accepted',
  );
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'9Q','guest')`, [topicA, alice]),
    true,
    'a second code for the same person in the same topic must be refused',
  );
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'3F','supplier')`, [topicA, bob]),
    true,
    'two people may not share a code in one topic',
  );
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'K2','supplier')`, [topicA, bob]),
    false,
  );
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'A7','guest')`, [topicB, alice]),
    false,
    'the same person gets their own row in another topic',
  );
  assert.equal(
    await refused(`INSERT INTO public.article_topic_codes (topic_id, user_id, code, author_kind) VALUES ($1,$2,'ZZ','admin')`, [topicB, bob]),
    true,
    'the kind is guest or supplier only',
  );
});

test('a reply needs its author to hold the topic code; the count follows live replies', async () => {
  assert.equal(
    await refused(`INSERT INTO public.article_replies (topic_id, author_user_id, body) VALUES ($1,$2,'no code yet')`, [topicB, bob]),
    true,
    'a reply from somebody with no code in the topic must be refused',
  );
  const reply = (
    await db.query<{ reply_id: string }>(
      `INSERT INTO public.article_replies (topic_id, author_user_id, body) VALUES ($1,$2,'We did it.') RETURNING reply_id`,
      [topicA, bob],
    )
  ).rows[0]!.reply_id;
  const count = async () =>
    (await db.query<{ n: number }>(`SELECT reply_count AS n FROM public.article_topics WHERE topic_id = $1`, [topicA])).rows[0]!.n;
  assert.equal(await count(), 1);
  await db.query(`UPDATE public.article_replies SET removed_at = NOW(), removed_by = $2 WHERE reply_id = $1`, [reply, admin]);
  assert.equal(await count(), 0, 'a removed reply leaves the count');
  const still = await db.query(`SELECT 1 FROM public.article_replies WHERE reply_id = $1`, [reply]);
  assert.equal(still.rows.length, 1, 'a removed reply keeps its place (the "Removed by Setnayan" line)');
});

test('a reader who is not Setnayan can read nothing — the account is never reachable', async () => {
  for (const table of ['article_topics', 'article_topic_codes', 'article_replies', 'article_posting_pauses']) {
    const rls = await db.query<{ on: boolean }>(`SELECT relrowsecurity AS on FROM pg_class WHERE relname = $1`, [table]);
    assert.equal(rls.rows[0]?.on, true, `${table} must have RLS on`);
    const seen = await asUser(alice, () => db.query(`SELECT * FROM public.${table}`));
    assert.equal(seen.rows.length, 0, `a signed-in reader selected ${table} directly — the real account would leak`);
  }
  const adminSees = await asUser(admin, () => db.query(`SELECT author_user_id FROM public.article_topics`));
  assert.ok(adminSees.rows.length >= 2, 'Setnayan (admin) sees who posted');
});

test('the queue takes a topic and a reply report with no event, and a shop report too', async () => {
  for (const t of ['article_topic', 'article_reply', 'vendor']) {
    assert.equal(
      await refused(
        `INSERT INTO public.user_reports (reporter_user_id, event_id, target_type, target_id, reason) VALUES ($1, NULL, $2, 'x', 'spam')`,
        [bob, t],
      ),
      false,
      `a '${t}' report with no event must be accepted`,
    );
  }
  assert.equal(
    await refused(
      `INSERT INTO public.user_reports (reporter_user_id, event_id, target_type, target_id, reason) VALUES ($1, NULL, 'photo', 'x', 'spam')`,
      [bob],
    ),
    true,
    'a photo report still needs its event',
  );
});

test('a pause names one account once', async () => {
  assert.equal(await refused(`INSERT INTO public.article_posting_pauses (user_id, paused_by) VALUES ($1,$2)`, [bob, admin]), false);
  assert.equal(await refused(`INSERT INTO public.article_posting_pauses (user_id, paused_by) VALUES ($1,$2)`, [bob, admin]), true);
});
