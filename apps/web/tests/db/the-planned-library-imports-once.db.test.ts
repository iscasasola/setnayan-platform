/**
 * 📚 THE PLANNED LIBRARY IMPORTS ONCE · THE 2 PM FACTS ARE REAL (owner, 28 Nov 2026; migration 20271365405436).
 * What the unit tests cannot see, on the replayed schema:
 *
 *   1 · The import migration `scripts/social/import-library.ts` writes inserts each planned post once: run twice,
 *       the rows stay four; a planned post pulled by hand stays pulled and is not re-inserted.
 *   2 · `slot` refuses anything but the four slots; `library` and `live_update` are allowed source types.
 *   2b · ONE POST PER SLOT is a database rule: a second live row on the same slot instant is refused (23505),
 *        a pulled row frees it, an unslotted legacy row is not held to it, and the library import moves an unsent
 *        auto-post off a planned slot (and skips a planned slot a sent post already holds) instead of aborting.
 *   2c · `scheduled_on_fb` is a status, holds its slot under the same index, and `facebook_post_id` is stored.
 *   3 · `social_live_week_facts` counts real events in the window only (no sample event, no event outside it) and
 *       lists only live, non-demo, not-opted-out suppliers verified in the window; service_role only.
 *
 *   0 · Library v2 (20271366752632) lands one post per planned slot — 399 mornings and 399 evenings, every day
 *       28 Nov 2026 – 31 Dec 2027, 31 holiday extras, 1 afternoon — run twice it inserts nothing more, and a slot that
 *       passed before the migration ran is left out (never queued late).
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
const importSql = libraryMigrationSql(
  libraryRowsFromCsv(fixture, { imagesBase: 'https://media.example/library' }).rows,
  'library-v2-sample.csv',
);

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

// The real library v2 import (20271366752632_social_library_v2.sql, generated from the specs corpus
// social/library-v2.csv). The replay above already ran it; it leaves out slots that passed before it ran, so the
// full set is proved by re-running it with that one filter line taken out.
const V2_FILE = '20271366752632_social_library_v2.sql';
const v2Sql = readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', V2_FILE), 'utf8');
const V2_PAST_FILTER = '\nWHERE v.scheduled_for > now();';

test('0 · library v2 lands once: 399 mornings, 399 evenings, 31 holidays, 1 afternoon, each on its Manila hour', async () => {
  assert.ok(v2Sql.includes(V2_PAST_FILTER), 'the v2 import no longer leaves out passed slots');
  const bySlot = async () =>
    Object.fromEntries(
      (
        await db.query<{ slot: string; n: number }>(
          `SELECT slot, count(*)::int AS n FROM public.social_posts WHERE source_type = 'library' GROUP BY slot ORDER BY slot`,
        )
      ).rows.map((r) => [r.slot, r.n]),
    );
  // What the replay's run kept: only slots still ahead of it, and no planned post already behind now().
  const late = await count(`source_type = 'library' AND scheduled_for <= now() - interval '1 hour'`);
  assert.equal(late, 0, 'the import queued a planned post whose slot had already passed');
  const futureAfterReplay = await count(`source_type = 'library' AND scheduled_for > now() + interval '1 hour'`);

  await db.exec(v2Sql.replace(V2_PAST_FILTER, ';'));
  const full = { afternoon: 1, evening: 399, holiday: 31, morning: 399 };
  assert.deepEqual(await bySlot(), full, 'the full library did not land one post per planned slot');
  await db.exec(v2Sql.replace(V2_PAST_FILTER, ';'));
  await db.exec(v2Sql);
  assert.deepEqual(await bySlot(), full, 'a second run imported planned posts again');
  assert.equal(
    await count(`source_type = 'library' AND scheduled_for > now() + interval '1 hour'`),
    futureAfterReplay,
    'the replay run left out a slot that was still ahead',
  );

  const shape = await db.query<{ slot: string; hours: string; days: number; first: string; last: string; statuses: string }>(
    `SELECT slot,
            string_agg(DISTINCT to_char(scheduled_for AT TIME ZONE 'UTC' + interval '8 hours', 'HH24:MI'), ',') AS hours,
            count(DISTINCT (scheduled_for AT TIME ZONE 'UTC' + interval '8 hours')::date)::int AS days,
            to_char(min(scheduled_for AT TIME ZONE 'UTC' + interval '8 hours'), 'YYYY-MM-DD') AS first,
            to_char(max(scheduled_for AT TIME ZONE 'UTC' + interval '8 hours'), 'YYYY-MM-DD') AS last,
            string_agg(DISTINCT status, ',') AS statuses
       FROM public.social_posts WHERE source_type = 'library' GROUP BY slot ORDER BY slot`,
  );
  assert.deepEqual(
    shape.rows.map((r) => [r.slot, r.hours, r.statuses]),
    [
      ['afternoon', '14:00', 'scheduled'],
      ['evening', '20:00', 'scheduled'],
      ['holiday', '12:00', 'scheduled'],
      ['morning', '08:00', 'scheduled'],
    ],
  );
  // 8 AM and 8 PM every day from 28 Nov 2026 to 31 Dec 2027 (399 days), one each.
  for (const kind of ['morning', 'evening']) {
    const r = shape.rows.find((x) => x.slot === kind)!;
    assert.deepEqual([r.days, r.first, r.last], [399, '2026-11-28', '2027-12-31'], `${kind} does not cover every day`);
  }
  // The copy is carried as written; images wait for hosting, so the flush posts the branded card for now.
  const sample = await db.query<{ body: string; title: string; link_url: string; media_url: string | null; media_urls: string[] | null }>(
    `SELECT body, title, link_url, media_url, media_urls FROM public.social_posts
      WHERE source_type = 'library' AND scheduled_for = '2026-11-28T00:00:00Z'`,
  );
  assert.equal(sample.rows.length, 1);
  assert.ok(sample.rows[0]!.body.startsWith('The list is in Excel. The quote is in Messenger.'));
  assert.equal(sample.rows[0]!.title, 'Introduce Setnayan · Plan it, free');
  assert.equal(sample.rows[0]!.link_url, 'https://setnayan.com/start');
  assert.equal(await count(`source_type = 'library' AND (media_url IS NOT NULL OR media_urls IS NOT NULL)`), 0);

  // The fixture tests below reuse the same planned slots: start them on an empty plan.
  await db.exec(`DELETE FROM public.social_posts WHERE source_type = 'library'`);
});

test('0b · a passed slot is left out when the import runs', async () => {
  const csv = 'Date,Time (Manila),Caption (primary text)\n2020-01-01,08:00,"Long gone"\n2099-01-01,08:00,"Far ahead"\n';
  await db.exec(libraryMigrationSql(libraryRowsFromCsv(csv).rows, 'past.csv', { skipPastSlots: true }));
  const r = await db.query<{ body: string }>(`SELECT body FROM public.social_posts WHERE source_type = 'library' ORDER BY body`);
  assert.deepEqual(r.rows.map((x) => x.body), ['Far ahead']);
  await db.exec(`DELETE FROM public.social_posts WHERE source_type = 'library'`);
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

  const photos = await db.query<{ media_urls: string[] | null; media_url: string | null }>(
    `SELECT media_urls, media_url FROM public.social_posts WHERE source_type = 'library' ORDER BY scheduled_for`,
  );
  assert.deepEqual(
    photos.rows[0]?.media_urls?.map((u) => u.split('/').pop()),
    ['01.jpg', '02.jpg', '03.jpg'],
    'the multi-photo order did not survive the insert',
  );
  assert.equal(photos.rows[1]?.media_urls, null);

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

test('2b · one post per slot is held by the database; the import gives a planned slot to the plan', async () => {
  const at = '2027-01-05T06:00:00Z'; // 14:00 Manila
  const ins = (ref: string, status = 'scheduled', slot: string | null = 'afternoon', type = 'vendor_feature') =>
    db.query(
      `INSERT INTO public.social_posts (source_type, source_ref, slot, scheduled_for, status) VALUES ($1, $2, $3, $4, $5)`,
      [type, ref, slot, at, status],
    );
  await ins('slot-a');
  // Two concurrent flushes giving a second row the same slot: the second write is refused.
  await assert.rejects(ins('slot-b'), /social_posts_one_post_per_slot/);
  await db.query(`INSERT INTO public.social_posts (source_type, source_ref) VALUES ('vendor_feature', 'slot-c')`);
  await assert.rejects(
    db.query(`UPDATE public.social_posts SET scheduled_for = $1, slot = 'afternoon' WHERE source_ref = 'slot-c'`, [at]),
    /social_posts_one_post_per_slot/,
  );
  // A pulled row frees the slot; a legacy row with no slot is not held to it.
  await db.query(`UPDATE public.social_posts SET status = 'pulled' WHERE source_ref = 'slot-a'`);
  await ins('slot-b');
  await ins('legacy-1', 'scheduled', null);

  // The import: an unsent auto-post on a planned instant moves off it; a SENT post keeps its slot and the
  // planned row is skipped — the migration never aborts.
  const sent = '2027-01-06T06:00:00Z';
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, slot, scheduled_for, status) VALUES ('vendor_feature', 'sent-1', 'afternoon', $1, 'published')`,
    [sent],
  );
  const csv =
    'Date,Time (Manila),Caption (primary text)\n2027-01-05,14:00,"Planned A"\n2027-01-06,14:00,"Planned B"\n';
  await db.exec(libraryMigrationSql(libraryRowsFromCsv(csv).rows, 'slots.csv'));
  const rows = await db.query<{ source_ref: string; source_type: string; at: string | null }>(
    `SELECT source_ref, source_type, to_char(scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS at
       FROM public.social_posts WHERE source_ref IN ('slot-b', 'sent-1') OR (source_type = 'library' AND body LIKE 'Planned %')
      ORDER BY source_ref`,
  );
  const byRef = Object.fromEntries(rows.rows.map((r) => [r.source_ref, r]));
  assert.equal(byRef['slot-b']?.at, null, 'the unsent auto-post kept the planned slot');
  assert.equal(byRef['sent-1']?.at, '2027-01-06T06:00', 'a sent post lost its slot');
  const planned = rows.rows.filter((r) => r.source_type === 'library');
  assert.deepEqual(planned.map((r) => r.at), ['2027-01-05T06:00'], 'the planned post on the free slot landed; the one on a sent slot was skipped');
});

test('2c · scheduled_on_fb is a status, it holds its slot, and Facebook\'s id is stored', async () => {
  const at = '2027-01-07T00:00:00Z'; // 08:00 Manila
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, slot, scheduled_for, status, facebook_post_id)
     VALUES ('library', 'fb-held', 'morning', $1, 'scheduled_on_fb', '123_456')`,
    [at],
  );
  // A post waiting on Facebook's schedule still holds its slot against every other row.
  await assert.rejects(
    db.query(
      `INSERT INTO public.social_posts (source_type, source_ref, slot, scheduled_for, status) VALUES ('vendor_feature', 'fb-rival', 'morning', $1, 'scheduled')`,
      [at],
    ),
    /social_posts_one_post_per_slot/,
  );
  const r = await db.query<{ facebook_post_id: string }>(`SELECT facebook_post_id FROM public.social_posts WHERE source_ref = 'fb-held'`);
  assert.equal(r.rows[0]?.facebook_post_id, '123_456');
  // A pulled post Facebook still holds has its own status, and it frees the slot like a pull.
  await db.query(`UPDATE public.social_posts SET status = 'takedown_needed' WHERE source_ref = 'fb-held'`);
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, slot, scheduled_for, status) VALUES ('vendor_feature', 'fb-next', 'morning', $1, 'scheduled')`,
    [at],
  );
  await assert.rejects(
    db.query(`UPDATE public.social_posts SET status = 'queued_on_fb' WHERE source_ref = 'fb-held'`),
    /social_posts_status_check/,
  );
});
