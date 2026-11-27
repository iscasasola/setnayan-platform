/**
 * LIVE ARTICLES SAY ONLY "HOSTS PAY 0% COMMISSION." · THE TEST STORY LEAVES — DB verification (executed).
 *
 * Owner rulings 27 Nov 2026 (content finalization, rows L · A · B, P6 and P33). The Journal posts are rows in
 * `creator_chapters`, written once by the applied import 20271355899662, so every later correction is a NEW
 * migration that replaces one exact passage of one named post. This suite runs the real files, in order, against
 * the replayed schema:
 *
 *   1. THE POINT — import, then every post-import migration listed in `JOURNAL_EDITS_AFTER_IMPORT`: every Journal
 *      row now reads exactly what the corrected source renders (title and body), all 91 of them.
 *   2. ONLY THE NAMED PASSAGE — a post an admin already rewrote is left alone, and a second run changes nothing
 *      (not even `updated_at`).
 *   3. THE TEST STORY LEAVES — the member post `our-batanes-wedding-told-in-full` is taken down (`removed_at`), so
 *      the public read no longer returns it; another member's post is untouched.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { ALL_BLOG_ARTICLES } from '../../lib/blog';
import { JOURNAL_EDITS_AFTER_IMPORT } from '../../lib/journal-edits-after-import';
import { journalRowText } from '../../lib/journal-import-sql';

const IMPORT = '20271355899662_the_journal_moves_into_articles.sql';
const THIS = '20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql';
const BATANES = 'our-batanes-wedding-told-in-full';

let replay: ReplayResult;
let db: PGlite;

const read = (file: string) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await asOwner();
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
}
async function signUp(email: string): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function postAs(uid: string, title: string): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ slug: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, published_at)
     VALUES ($1, $2, 'wedding', $3, 'published', now()) RETURNING slug`,
    [uid, title, 'We got married in Batanes.\n\nThis is the telling.'],
  );
  await asOwner();
  return r.rows[0]!.slug;
}

type Row = { slug: string; title: string; body: string; updated_at: string };
async function journalRows(): Promise<Map<string, Row>> {
  await asOwner();
  const r = await db.query<Row>(
    `SELECT slug, title, body, updated_at::text AS updated_at FROM public.creator_chapters WHERE is_journal ORDER BY slug`,
  );
  return new Map(r.rows.map((x) => [x.slug, x]));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec(`SET TIME ZONE 'UTC'`);
  const owner = await signUp('journal-owner@test.local');
  await asOwner();
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [owner]);
});

after(async () => {
  await db?.close();
});

test('1 · import, then every post-import edit in order: every Journal row reads what the corrected source renders', async () => {
  await asOwner();
  await db.exec(`DELETE FROM public.creator_chapters WHERE is_journal`);
  await db.exec(read(IMPORT));
  const edits = [...new Set(JOURNAL_EDITS_AFTER_IMPORT.map((e) => e.migration))].sort();
  assert.ok(edits.includes(THIS), 'this migration carries listed edits');
  for (const file of edits) await db.exec(read(file));

  const rows = await journalRows();
  assert.equal(rows.size, ALL_BLOG_ARTICLES.length, 'every post, once');
  for (const a of ALL_BLOG_ARTICLES) {
    const row = rows.get(a.slug);
    assert.ok(row, `${a.slug}: missing`);
    assert.deepEqual({ title: row.title, body: row.body }, journalRowText(a), `${a.slug}: the row and the source differ`);
  }

  // The rulings, read off the rows themselves.
  const zero = rows.get('what-zero-commission-means-for-couples')!;
  assert.equal(zero.title, 'How Setnayan pricing works for hosts');
  assert.doesNotMatch(zero.body, /booking fee|What suppliers do pay|For Suppliers/i, 'the booking fee is never explained to hosts');
  for (const row of rows.values()) {
    const text = `${row.title}\n${row.body}`;
    assert.doesNotMatch(text, /zero commission|commission-free|no booking commission|no commission|with 0% commission/i, `${row.slug}: 0% wording other than the one sentence`);
    for (const m of text.matchAll(/[^.\n•]*0% commission[^.\n]*\.?/g)) {
      assert.equal(m[0].trim(), 'Hosts pay 0% commission.', `${row.slug}: "${m[0].trim()}" is not the exact sentence`);
    }
    assert.doesNotMatch(text, /stays free|never have to pay|never required to buy/i, `${row.slug}: a free-forever promise`);
    assert.doesNotMatch(text, /\bcelebrations?\b/i, `${row.slug}: "celebration" outside a brand line`);
  }
  assert.match(rows.get('how-to-save-money-on-your-wedding-philippines')!.title, /^23 honest ways/);
});

test('2 · only the named passage: an admin rewrite is left alone, and a second run changes nothing', async () => {
  await asOwner();
  await db.query(
    `UPDATE public.creator_chapters SET body = 'An admin rewrote this one.' WHERE is_journal AND slug = 'free-event-hub-how-it-helps'`,
  );
  const beforeRun = await journalRows();
  await db.exec(read(THIS));
  const afterRun = await journalRows();
  assert.equal(afterRun.get('free-event-hub-how-it-helps')!.body, 'An admin rewrote this one.');
  for (const [slug, row] of beforeRun) {
    assert.deepEqual(afterRun.get(slug), row, `${slug}: a second run touched it`);
  }
});

test('3 · the test story leaves the public read; another member’s post stays', async () => {
  const member = await signUp('batanes@test.com');
  const neighbour = await signUp('neighbour@test.local');
  await asOwner();
  await db.query(`UPDATE public.users SET posting_name = 'batanes.member' WHERE user_id = $1`, [member]);
  await db.query(`UPDATE public.users SET posting_name = 'neighbour.one' WHERE user_id = $1`, [neighbour]);
  assert.equal(await postAs(member, 'Our Batanes wedding, told in full'), BATANES);
  const other = await postAs(neighbour, 'Our Tagaytay wedding');

  const publicSlugs = async () => {
    await asAnon();
    const r = await db.query<{ slug: string }>(
      `SELECT slug FROM public.creator_chapters WHERE slug = ANY($1::text[])`,
      [[BATANES, other]],
    );
    await asOwner();
    return r.rows.map((x) => x.slug).sort();
  };
  assert.deepEqual(await publicSlugs(), [BATANES, other].sort(), 'both are public before');

  await db.exec(read(THIS));
  await asOwner();
  const removed = (await db.query<{ slug: string; gone: boolean }>(
    `SELECT slug, removed_at IS NOT NULL AS gone FROM public.creator_chapters WHERE slug = ANY($1::text[]) ORDER BY slug`,
    [[BATANES, other]],
  )).rows;
  assert.deepEqual(
    Object.fromEntries(removed.map((r) => [r.slug, r.gone])),
    { [BATANES]: true, [other]: false },
  );
  assert.deepEqual(await publicSlugs(), [other], 'the test story is off the public read');

  // A second run keeps the first take-down time.
  const stamp = async () => (await db.query<{ t: string }>(
    `SELECT removed_at::text AS t FROM public.creator_chapters WHERE slug = $1`, [BATANES])).rows[0]!.t;
  const first = await stamp();
  await db.exec(read(THIS));
  assert.equal(await stamp(), first);
});
