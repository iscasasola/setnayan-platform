/**
 * 📚 THE PLANNED LIBRARY IMPORTS ONCE · THE 2 PM FACTS ARE REAL (owner, 28 Nov 2026; migration 20271365405436).
 * What the unit tests cannot see, on the replayed schema:
 *
 *   1 · The import migration `scripts/social/import-library.ts` writes inserts each planned post once: run twice,
 *       the rows stay four; a planned post pulled by hand stays pulled and is not re-inserted.
 *   2 · `slot` refuses anything but the four slots; `library` and `live_update` are allowed source types.
 *   3 · `social_live_week_facts` counts real events in the window only (no sample event, no event outside it) and
 *       lists only live, non-demo, not-opted-out suppliers verified in the window; service_role only.
 *
 * Sabotage (measured): dropping the NOT EXISTS guard from the generated SQL turns 1 red (the pulled row comes back);
 * dropping `is_demo IS FALSE` from the function turns 3 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { libraryMigrationSql, libraryRowsFromCsv } from '../../lib/social/library-import';

let replay: ReplayResult;
let db: PGlite;

const fixture = readFileSync(join(__dirname, '..', '..', 'lib', 'social', '__fixtures__', 'library-v2-sample.csv'), 'utf8');
const importSql = libraryMigrationSql(libraryRowsFromCsv(fixture).rows, 'library-v2-sample.csv');

async function count(where = `source_type = 'library'`): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.social_posts WHERE ${where}`);
  return r.rows[0]!.n;
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the slots', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · the library import inserts each planned post once, and a pulled one stays pulled', async () => {
  await db.exec(importSql);
  assert.equal(await count(), 4);
  await db.exec(importSql);
  assert.equal(await count(), 4, 'a second run inserted planned posts again');

  const holiday = await db.query<{ slot: string; at: string; first_comment: string | null; status: string }>(
    `SELECT slot, to_char(scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS at, first_comment, status
       FROM public.social_posts WHERE source_type = 'library' AND slot = 'holiday'`,
  );
  assert.deepEqual(holiday.rows, [{ slot: 'holiday', at: '2026-12-25T04:00', first_comment: null, status: 'scheduled' }]);

  await db.exec(`UPDATE public.social_posts SET status = 'pulled' WHERE source_type = 'library' AND slot = 'evening'`);
  await db.exec(importSql);
  assert.equal(await count(), 4, 'a pulled planned post was re-inserted');
  assert.equal(await count(`source_type = 'library' AND status = 'pulled'`), 1);
});

test('2 · slot takes only the four slots; library and live_update are source types', async () => {
  await assert.rejects(
    db.exec(`INSERT INTO public.social_posts (source_type, source_ref, slot) VALUES ('announcement', 'x-1', 'noon')`),
    /social_posts_slot_check/,
  );
  await db.exec(`INSERT INTO public.social_posts (source_type, source_ref, slot) VALUES ('live_update', 'live:2026-12-01', 'afternoon')`);
  await assert.rejects(
    db.exec(`INSERT INTO public.social_posts (source_type, source_ref, slot) VALUES ('live_update', 'live:2026-12-01', 'afternoon')`),
    /social_posts_source_unique/,
  );
});

test('3 · the week facts are real: no sample event, no demo or opted-out shop; service_role only', async () => {
  const facts = async () =>
    (
      await db.query<{ v: { events_held: number; shops_verified: Array<{ business_name: string }> } }>(
        `SELECT public.social_live_week_facts('2026-11-24'::date, '2026-12-01'::date, '2026-11-24T00:00:00Z'::timestamptz) AS v`,
      )
    ).rows[0]!.v;
  const before = await facts();

  await db.exec(`
    INSERT INTO public.events (event_type, display_name, event_date, is_sample, ceremony_type, venue_setting) VALUES
      ('wedding', 'Held this week', '2026-11-28', FALSE, 'civil', 'garden'),
      ('wedding', 'Sample this week', '2026-11-28', TRUE, 'civil', 'garden'),
      ('wedding', 'Held last month', '2026-10-28', FALSE, 'civil', 'garden'),
      ('wedding', 'Today, not yet held', '2026-12-01', FALSE, 'civil', 'garden');
  `);
  const live = await newUser('live-shop@test.test');
  const demo = await newUser('demo-shop@test.test');
  const optedOut = await newUser('optout-shop@test.test');
  for (const [uid, name, isDemo, optOut] of [
    [live, 'Hiraya Studio', false, false],
    [demo, 'Demo Studio', true, false],
    [optedOut, 'Quiet Studio', false, true],
  ] as const) {
    await db.query(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
       VALUES ($1, $2, 'Cebu', ARRAY['photography']::text[])
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name`,
      [uid, name],
    );
    await db.query(
      `UPDATE public.vendor_profiles
          SET verification_state = 'verified', public_visibility = 'verified', last_verified_at = '2026-11-27T00:00:00Z',
              is_demo = $2, social_feature_opt_out = $3
        WHERE user_id = $1`,
      [uid, isDemo, optOut],
    );
  }

  const after = await facts();
  assert.equal(after.events_held - before.events_held, 1, 'only the real event held inside the window counts');
  const names = after.shops_verified.map((s) => s.business_name);
  assert.ok(names.includes('Hiraya Studio'));
  assert.ok(!names.includes('Demo Studio'), 'a demo shop was listed');
  assert.ok(!names.includes('Quiet Studio'), 'an opted-out shop was listed');

  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`SELECT public.social_live_week_facts('2026-11-24'::date, '2026-12-01'::date, now())`),
      /permission denied/,
    );
  } finally {
    await db.exec(`RESET ROLE`);
  }
});
