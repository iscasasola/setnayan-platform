/**
 * tests/db/samahan-stories-24h.db.test.ts — Samahan Stories keep their three
 * database-enforced promises (owner 2026-08-24, the Setlog concept):
 *
 *   1. MEMBERS ONLY — a non-member reads zero stories, and cannot even tell
 *      the table has rows for that community.
 *   2. ONE PER HOUR — the UNIQUE (community_id, user_id, hour_bucket) index
 *      refuses a second story in the same clock hour, from the service role
 *      itself (the app cannot out-vote it).
 *   3. GONE IN 24 HOURS — an expired story is invisible to a member THROUGH
 *      RLS, before any sweep has run. The sweep only reclaims bytes.
 *
 * Plus the write-surface rule: authenticated has NO insert/update/delete on
 * the table — posting goes through the service-role route (screen + R2).
 * Assertions are mostly NEGATIVE on purpose: the happy path would pass with
 * every door open.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let member = '';
let outsider = '';
let community = '';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    );
    return r.rows[0]!.id;
  };
  member = await mk('member@stories.test');
  outsider = await mk('outsider@stories.test');
  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Barkada Stories', $1)
     RETURNING community_id`,
    [member],
  );
  community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'organizer')`,
    [community, member],
  );
});

after(async () => {
  await db.close();
});

test('a member reads a live story; a non-member reads nothing', async () => {
  // Seeded as the service role — the only writer the product has.
  await db.query(
    `INSERT INTO public.samahan_stories
       (community_id, user_id, r2_object_key, poster_r2_key, duration_ms, screened_at)
     VALUES ($1, $2, 'r2://setnayan-media/samahan/x/a.mp4',
             'r2://setnayan-media/samahan/x/a-poster.jpg', 2500, NOW())`,
    [community, member],
  );

  await asUser(member);
  const mine = await db.query(
    `SELECT story_id FROM public.samahan_stories WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(mine.rows.length, 1, 'a member must see the live story');

  await asUser(outsider);
  const theirs = await db.query(
    `SELECT story_id FROM public.samahan_stories WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.equal(theirs.rows.length, 0, 'a non-member must see nothing');
});

test('one story per member per clock hour — the DB refuses the second', async () => {
  let refused = '';
  try {
    await db.query(
      `INSERT INTO public.samahan_stories
         (community_id, user_id, r2_object_key, poster_r2_key, duration_ms, screened_at)
       VALUES ($1, $2, 'r2://setnayan-media/samahan/x/b.mp4',
               'r2://setnayan-media/samahan/x/b-poster.jpg', 3000, NOW())`,
      [community, member],
    );
  } catch (e) {
    refused = e instanceof Error ? e.message : String(e);
  }
  assert.match(
    refused,
    /samahan_stories_one_per_hour_idx|duplicate key/i,
    'the second story in the same hour must hit the unique index',
  );

  // The NEXT hour is allowed — the rule is a rhythm, not a lifetime cap.
  const r = await db.query<{ story_id: string }>(
    `INSERT INTO public.samahan_stories
       (community_id, user_id, r2_object_key, poster_r2_key, duration_ms, screened_at,
        hour_bucket, created_at)
     VALUES ($1, $2, 'r2://setnayan-media/samahan/x/c.mp4',
             'r2://setnayan-media/samahan/x/c-poster.jpg', 3000, NOW(),
             date_trunc('hour', NOW() + INTERVAL '1 hour'), NOW())
     RETURNING story_id`,
    [community, member],
  );
  assert.equal(r.rows.length, 1, 'the next hour must be accepted');
});

test('an expired story is invisible to its own community — RLS, not the sweep', async () => {
  await db.query(
    `INSERT INTO public.samahan_stories
       (community_id, user_id, r2_object_key, poster_r2_key, duration_ms, screened_at,
        hour_bucket, created_at, expires_at)
     VALUES ($1, $2, 'r2://setnayan-media/samahan/x/old.mp4',
             'r2://setnayan-media/samahan/x/old-poster.jpg', 2000, NOW(),
             date_trunc('hour', NOW() - INTERVAL '25 hours'),
             NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 hour')`,
    [community, member],
  );

  await asUser(member);
  const visible = await db.query<{ r2_object_key: string }>(
    `SELECT r2_object_key FROM public.samahan_stories WHERE community_id = $1`,
    [community],
  );
  await reset();
  assert.ok(visible.rows.length > 0, 'live stories still render (the filter is not a blanket)');
  assert.ok(
    visible.rows.every((r) => !r.r2_object_key.includes('/old.mp4')),
    'the expired story must not be among them',
  );

  // The row still EXISTS for the sweep to find (privileged read).
  const raw = await db.query(
    `SELECT id FROM public.samahan_stories WHERE r2_object_key LIKE '%/old.mp4'`,
  );
  assert.equal(raw.rows.length, 1, 'expiry hides the row; only the sweep deletes it');
});

test('authenticated cannot write the table at all — post/edit/delete are the route’s', async () => {
  const attempts: Array<[string, string]> = [
    [
      'insert',
      `INSERT INTO public.samahan_stories
         (community_id, user_id, r2_object_key, poster_r2_key, duration_ms, screened_at)
       VALUES ('${community}', '${member}', 'r2://x/f.mp4', 'r2://x/f.jpg', 2000, NOW())`,
    ],
    ['update', `UPDATE public.samahan_stories SET duration_ms = 1 WHERE community_id = '${community}'`],
    ['delete', `DELETE FROM public.samahan_stories WHERE community_id = '${community}'`],
  ];
  for (const [verb, sql] of attempts) {
    await asUser(member);
    let failed = '';
    let rowCount = -1;
    try {
      const res = await db.query(sql);
      rowCount = res.affectedRows ?? 0;
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    } finally {
      await reset();
    }
    // Either the GRANT refuses loudly, or RLS matches zero rows — both are
    // "nothing changed". A positive rowCount is the only failure.
    assert.ok(
      failed !== '' || rowCount === 0,
      `${verb} by an authenticated member must change nothing (failed='${failed}', rows=${rowCount})`,
    );
  }
});
