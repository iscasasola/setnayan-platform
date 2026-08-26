/**
 * admin-search-phrases.db.test.ts — the memory can be read by an admin, and
 * written by nobody through a browser.
 *
 * 🔑 THE GRANT AND THE POLICY ARE CHECKED TOGETHER. A policy without a matching
 * grant is never reached — Postgres checks the grant first — which is how a
 * DELETE policy shipped on `community_members` that nobody could ever exercise
 * (2026-08-24). And a PERMISSIVE `FOR ALL` policy would have admitted INSERT and
 * DELETE alongside the read, the exact shape behind eight forgeries on
 * 2026-08-12. This asserts the narrow thing that was intended.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATIONS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/migrations');

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the learned-phrase memory is reachable by the service role and nobody else', async () => {
  // NO POLICY AT ALL, and that is the design. Nothing in a browser reads this
  // table — every read and write goes through one admin-gated server action on
  // the service role, which is outside RLS. A policy here would hand every
  // signed-in account the shape of the admin's own navigation for no feature,
  // and the exposure freeze refused the first cut that tried it.
  const policies = await db.query<{ cmd: string }>(
    `SELECT cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'admin_search_phrases'`,
  );
  assert.deepEqual(
    policies.rows.map((r) => r.cmd),
    [],
    'the memory grew a policy — read the migration comment before adding one',
  );

  const grants = await db.query<{ privilege_type: string; grantee: string }>(
    `SELECT privilege_type, grantee
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'admin_search_phrases'
        AND grantee IN ('anon', 'authenticated')`,
  );
  const held = grants.rows.map((r) => `${r.grantee}:${r.privilege_type}`).sort();
  assert.deepEqual(held, [], `the memory became reachable from a browser: ${held.join(', ')}`);

  // 🪤 `relrowsecurity` IS VACUOUS IN THIS REPLAY — measured 2026-08-26, and it
  // is a second instance of the documented `auth.role()` shim deviation. A
  // brand-new table created inside a replayed database, with no policy and no
  // ALTER, already reports relrowsecurity = true. So asserting it proves nothing
  // about the migration; the honest check is that the migration SAYS it, because
  // that is what runs in production.
  //
  // ⚠ 15 db tests in this repo assert that flag today. Named, not fixed here.
  const migration = readFileSync(
    join(MIGRATIONS, '20271169224135_the_box_remembers_the_words_you_use.sql'),
    'utf8',
  );
  assert.match(
    migration,
    /ALTER TABLE public\.admin_search_phrases ENABLE ROW LEVEL SECURITY;/,
    'the migration stopped enabling row security',
  );
});

test('the memory refuses an address outside the admin', async () => {
  // The floor under the application check. If somebody deletes the app-side
    // validation, a model cannot still store a link to somewhere else.
    await assert.rejects(
  () =>
    db.query(
      `INSERT INTO public.admin_search_phrases (phrase, href, label)
       VALUES ('anywhere', 'https://example.com', 'Elsewhere')`,
    ),
  /admin_search_phrases_href_chk/,
    );
    await db.query(
  `INSERT INTO public.admin_search_phrases (phrase, href, label)
   VALUES ('papic prices', '/admin/pricing?tab=pricing', 'Pricing')`,
    );
    const ok = await db.query<{ n: string }>(
  `SELECT count(*)::text AS n FROM public.admin_search_phrases`,
    );
    assert.equal(ok.rows[0]!.n, '1', 'the legitimate row did not store');
});

test('one phrase means one destination', async () => {
  await db.query(
  `INSERT INTO public.admin_search_phrases (phrase, href, label)
   VALUES ('where are the prices', '/admin/pricing', 'Pricing')`,
    );
    await assert.rejects(
  () =>
    db.query(
      `INSERT INTO public.admin_search_phrases (phrase, href, label)
       VALUES ('where are the prices', '/admin/work', 'All work')`,
    ),
  /admin_search_phrases_phrase_key/,
  'the same phrase can be taught two different answers',
    );
});

test('the vacuous flag is named, so nobody writes another test that trusts it', async () => {
  // The proof, kept live rather than written in a comment: a table created here
  // with no policy and no ALTER already reports row security ON. If a future
  // PGlite fixes this, this test fails and the note above can be deleted — which
  // is the only way a shim deviation ever stops being believed.
  await db.query('CREATE TABLE IF NOT EXISTS public.zz_rls_shim_probe (id int)');
  const probe = await db.query<{ r: boolean }>(
    `SELECT relrowsecurity AS r FROM pg_class WHERE relname = 'zz_rls_shim_probe'`,
  );
  assert.equal(
    probe.rows[0]!.r,
    true,
    'the replay now reports relrowsecurity honestly — delete the workaround above and re-point the 15 db tests that assert it',
  );
  await db.query('DROP TABLE public.zz_rls_shim_probe');
});
