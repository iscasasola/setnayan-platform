/**
 * 📰 ARTICLES LIVE ON THE CHAPTER STORE — asserted against the DATABASE, through real sessions
 * (migrations 20271350349649 + 20271350850404; owner rulings 2026-11-17, drawing v15, PR #7919).
 *
 * The browser can reach these tables directly (PostgREST + a public key), so the boundary is the POLICY and the
 * TRIGGER, never the screen. Each claim below is a thing a person could otherwise do:
 *   1. A new post gets a readable address from its title; a second post with the same title gets its own; the
 *      writer can neither type one nor change it later.
 *   2. A signed-in writer cannot make a post "Setnayan Journal", cannot un-remove a removed post.
 *   3. A supplier-linked account ALWAYS posts as its shop — the browser cannot choose or clear it — and so does a
 *      team member of a shop. A plain account posts as nobody's shop.
 *   4. Anyone (anon included) reads a published article; nobody reads a draft or a removed one.
 *   5. Replies: one level deep (no parent column); a signed-in reader replies to a published article only; the
 *      writer cannot move a reply, clear its shop, or restore a removed one; anon cannot write.
 *   6. posting_name is unique without regard to case and has a fixed shape.
 *   7. A reply can be reported (target 'chapter_reply', no event).
 *   8. The Journal import: nothing without an internal account; with one, every post lands once, as Journal,
 *      with its slug, and re-running inserts nothing more.
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
import { JOURNAL_STAGED_DATE } from '../../lib/journal-import-sql';

let replay: ReplayResult;
let db: PGlite;

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
async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

const BODY = 'We are torn between two venues.\n\nsetnayan.com/taal-vista-hotel';

let person = '';
let supplier = '';
let teammate = '';
let shop = '';

async function postAs(uid: string, title: string, extra: Record<string, string | boolean> = {}): Promise<{
  chapter_id: string; slug: string; is_journal: boolean; posted_as_vendor_id: string | null;
}> {
  await asUser(uid);
  const cols = ['user_id', 'title', 'kind', 'body', 'status', 'published_at', ...Object.keys(extra)];
  const vals: unknown[] = [uid, title, 'wedding', BODY, 'published', new Date().toISOString(), ...Object.values(extra)];
  const r = await db.query<{ chapter_id: string; slug: string; is_journal: boolean; posted_as_vendor_id: string | null }>(
    `INSERT INTO public.creator_chapters (${cols.join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING chapter_id, slug, is_journal, posted_as_vendor_id`,
    vals,
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec(`SET TIME ZONE 'UTC'`);
  person = await signUp('reader@test.local', 'customer');
  supplier = await signUp('shop@test.local', 'vendor');
  teammate = await signUp('helper@test.local', 'customer');
  await asOwner();
  shop = (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [supplier])).rows[0]!.v;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')`,
    [shop, teammate],
  );
});

after(async () => {
  await db?.close();
});

test('1 · a post gets its address from the title; twins get their own; nobody types or changes one', async () => {
  const a = await postAs(person, 'Garden or church in Tagaytay for 150 guests?');
  assert.equal(a.slug, 'garden-or-church-in-tagaytay-for-150-guests');
  const b = await postAs(person, 'Garden or church in Tagaytay for 150 guests?');
  assert.equal(b.slug, 'garden-or-church-in-tagaytay-for-150-guests-2');
  const typed = await postAs(person, 'Is a weekday wedding worth it?', { slug: 'best-months-to-get-married-philippines' });
  assert.equal(typed.slug, 'is-a-weekday-wedding-worth-it', 'a typed slug is ignored — it could squat a Journal address');

  await asUser(person);
  await db.query(`UPDATE public.creator_chapters SET slug = 'stolen', title = 'New title' WHERE chapter_id = $1`, [a.chapter_id]);
  await asOwner();
  const after1 = (await db.query<{ slug: string; title: string }>(`SELECT slug, title FROM public.creator_chapters WHERE chapter_id = $1`, [a.chapter_id])).rows[0]!;
  assert.equal(after1.title, 'New title', 'the writer still edits the title');
  assert.equal(after1.slug, 'garden-or-church-in-tagaytay-for-150-guests', 'but the shared address stays');
});

test('2 · a signed-in writer cannot claim the Journal byline, nor restore a removed post', async () => {
  const a = await postAs(person, 'Pretending to be Setnayan', { is_journal: true });
  assert.equal(a.is_journal, false);
  await asOwner();
  await db.query(`UPDATE public.creator_chapters SET removed_at = now() WHERE chapter_id = $1`, [a.chapter_id]);
  await asUser(person);
  await db.query(`UPDATE public.creator_chapters SET removed_at = NULL, is_journal = TRUE WHERE chapter_id = $1`, [a.chapter_id]);
  await asOwner();
  const r = (await db.query<{ removed: boolean; j: boolean }>(
    `SELECT removed_at IS NOT NULL AS removed, is_journal AS j FROM public.creator_chapters WHERE chapter_id = $1`, [a.chapter_id])).rows[0]!;
  assert.deepEqual(r, { removed: true, j: false });
});

test('3 · a shop account always posts as its shop — owner and team — and cannot clear it; a person posts as nobody', async () => {
  const own = await postAs(supplier, 'April weekends go first here');
  assert.equal(own.posted_as_vendor_id, shop);
  const team = await postAs(teammate, 'Our team’s tasting checklist');
  assert.equal(team.posted_as_vendor_id, shop, 'a team member of the shop speaks for the shop too');
  const plain = await postAs(person, 'Just a guest');
  assert.equal(plain.posted_as_vendor_id, null);
  const forged = await postAs(person, 'I am a shop now', { posted_as_vendor_id: shop });
  assert.equal(forged.posted_as_vendor_id, null, 'a person cannot speak for somebody else’s shop');
  await asUser(supplier);
  await db.query(`UPDATE public.creator_chapters SET posted_as_vendor_id = NULL WHERE chapter_id = $1`, [own.chapter_id]);
  await asOwner();
  const still = (await db.query<{ v: string | null }>(`SELECT posted_as_vendor_id AS v FROM public.creator_chapters WHERE chapter_id = $1`, [own.chapter_id])).rows[0]!;
  assert.equal(still.v, shop);
});

test('4 · anyone reads a published article; nobody else reads a draft or a removed one', async () => {
  const live = await postAs(person, 'Live for everyone');
  const removed = await postAs(person, 'Taken down');
  await asOwner();
  await db.query(`UPDATE public.creator_chapters SET removed_at = now() WHERE chapter_id = $1`, [removed.chapter_id]);
  await asUser(person);
  const draft = (await db.query<{ chapter_id: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind) VALUES ($1, 'Still writing', 'wedding') RETURNING chapter_id`, [person])).rows[0]!;

  await asAnon();
  const seen = (await db.query<{ chapter_id: string }>(
    `SELECT chapter_id FROM public.creator_chapters WHERE chapter_id = ANY($1::uuid[])`,
    [[live.chapter_id, removed.chapter_id, draft.chapter_id]],
  )).rows.map((r) => r.chapter_id);
  assert.deepEqual(seen, [live.chapter_id], 'anon sees the live article only');
  await asOwner();
});

test('5 · replies: one level, to live articles only, and the writer owns only the words', async () => {
  await asOwner();
  const cols = (await db.query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_schema='public' AND table_name='creator_chapter_replies'`)).rows.map((r) => r.c);
  assert.ok(!cols.some((c) => /parent/.test(c)), 'no parent column — a reply cannot answer a reply');

  const art = await postAs(person, 'Reply here');
  await asUser(supplier);
  const rep = (await db.query<{ reply_id: string; posted_as_vendor_id: string | null }>(
    `INSERT INTO public.creator_chapter_replies (chapter_id, user_id, body) VALUES ($1, $2, 'We open next year in June.')
     RETURNING reply_id, posted_as_vendor_id`, [art.chapter_id, supplier])).rows[0]!;
  assert.equal(rep.posted_as_vendor_id, shop, 'a shop replies as the shop');

  await asUser(person);
  const draft = (await db.query<{ chapter_id: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind) VALUES ($1, 'Draft', 'wedding') RETURNING chapter_id`, [person])).rows[0]!;
  await assert.rejects(
    db.query(`INSERT INTO public.creator_chapter_replies (chapter_id, user_id, body) VALUES ($1, $2, 'early')`, [draft.chapter_id, person]),
    /row-level security/,
    'no replies on a draft',
  );
  await assert.rejects(
    db.query(`INSERT INTO public.creator_chapter_replies (chapter_id, user_id, body) VALUES ($1, $2, 'as someone')`, [art.chapter_id, supplier]),
    /row-level security/,
    'nobody replies in somebody else’s name',
  );

  await asOwner();
  await db.query(`UPDATE public.creator_chapter_replies SET removed_at = now() WHERE reply_id = $1`, [rep.reply_id]);
  await asUser(supplier);
  await assert.rejects(
    db.query(`UPDATE public.creator_chapter_replies SET removed_at = NULL WHERE reply_id = $1`, [rep.reply_id]),
    /permission denied/,
    'the writer is granted the words, not the moderation column',
  );
  await db.query(`UPDATE public.creator_chapter_replies SET body = 'edited' WHERE reply_id = $1`, [rep.reply_id]);
  await asAnon();
  const visible = (await db.query(`SELECT 1 FROM public.creator_chapter_replies WHERE reply_id = $1`, [rep.reply_id])).rows.length;
  assert.equal(visible, 0, 'a removed reply is gone from the public read');
  await assert.rejects(
    db.query(`INSERT INTO public.creator_chapter_replies (chapter_id, user_id, body) VALUES ($1, $2, 'anon')`, [art.chapter_id, person]),
    /permission denied|row-level security/,
  );
  await asOwner();
});

test('6 · posting_name: one per name regardless of case, and a fixed shape', async () => {
  await asUser(person);
  await db.query(`UPDATE public.users SET posting_name = 'tagaytaybride' WHERE user_id = $1`, [person]);
  await asUser(teammate);
  await assert.rejects(
    db.query(`UPDATE public.users SET posting_name = 'TagaytayBride' WHERE user_id = $1`, [teammate]),
    /users_posting_name_shape|users_posting_name_key|duplicate/,
  );
  await assert.rejects(db.query(`UPDATE public.users SET posting_name = 'a b' WHERE user_id = $1`, [teammate]), /users_posting_name_shape/);
  await asOwner();
});

test('7 · a reply can be reported, with no event', async () => {
  await asOwner();
  const def = (await db.query<{ d: string }>(
    `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'user_reports_target_type_check'`)).rows[0]!.d;
  assert.match(def, /chapter_reply/);
  assert.match(def, /'vendor'/, 're-listed from the live constraint — nothing dropped');
  const ev = (await db.query<{ d: string }>(
    `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'user_reports_event_id_required_check'`)).rows[0]!.d;
  assert.match(ev, /chapter_reply/);
});

test('8 · the Journal import: nothing without an internal account; with one, every post once, as Journal', async () => {
  await asOwner();
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '20271350850404_the_journal_moves_into_articles.sql'), 'utf8');
  const journalCount = async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.creator_chapters WHERE is_journal`)).rows[0]!.n;

  // Arm 1 — no internal account: the import inserts nothing (never a row owned by a guess).
  await db.exec('BEGIN');
  await db.exec(`DELETE FROM public.creator_chapters WHERE is_journal`);
  await db.exec(`UPDATE public.users SET is_internal = FALSE WHERE is_internal`);
  await db.exec(sql);
  assert.equal(await journalCount(), 0, 'no internal account ⇒ nothing inserted');
  await db.exec('ROLLBACK');

  // Arm 2 — an internal account: every post, once, owned by it; a second run adds nothing.
  await db.exec(`DELETE FROM public.creator_chapters WHERE is_journal`);
  const owner = (await db.query<{ u: string }>(
    `SELECT user_id AS u FROM public.users WHERE is_internal ORDER BY created_at LIMIT 1`)).rows[0]?.u
    ?? (await (async () => {
      const id = await signUp('journal-owner@test.local', 'customer');
      await asOwner();
      await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [id]);
      return id;
    })());
  await asOwner();
  await db.exec(sql);
  await db.exec(sql);

  const rows = (await db.query<{ slug: string; status: string; tags: string[]; u: string }>(
    `SELECT slug, status, tags, user_id AS u FROM public.creator_chapters WHERE is_journal ORDER BY slug`)).rows;
  assert.equal(rows.length, ALL_BLOG_ARTICLES.length, 'every post, once');
  assert.ok(rows.every((r) => r.u === owner), 'owned by the internal account');
  const staged = ALL_BLOG_ARTICLES.filter((a) => a.publishedAt >= JOURNAL_STAGED_DATE).map((a) => a.slug).sort();
  assert.deepEqual(rows.filter((r) => r.status === 'draft').map((r) => r.slug), staged, 'staged posts stay unpublished');
  const venue = rows.find((r) => r.slug === 'how-to-choose-a-wedding-venue-philippines');
  assert.ok(venue?.tags.includes('venues'), 'onboarding can find its article by tag');

  await asAnon();
  assert.equal(await journalCount(), ALL_BLOG_ARTICLES.length - staged.length, 'anon reads every published post, no drafts');
  await asOwner();
});
