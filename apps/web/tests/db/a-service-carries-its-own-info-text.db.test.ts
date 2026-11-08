/**
 * a-service-carries-its-own-info-text.db.test.ts — 🔒 a service's one-line ⓘ definition is written in Admin ›
 * Categories and nowhere else, and an unwritten one is EMPTY (plan Track D, item D4).
 *
 * Ruling: DECISION_LOG 2026-11-06 "EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ WITH A ONE-LINE
 * DEFINITION" — owner: "add (i) for each so we can define the categories and service so they know where they should
 * locate themselves." The row: "Services have NO field … one nullable text column, plus the same 'ⓘ text' field on
 * the service row in Admin › Categories."
 *
 * Runs the REAL core (`setServiceInfoTextCore`, the one the drawer's `info-text` door calls for a service) against the
 * replayed schema through `supabase-over-pglite.ts`, and holds:
 *   1. the column exists, nullable, and EVERY service starts empty (no definition is seeded — "write NO definitions");
 *   2. a save writes `canonical_service_schemas.hint_en`, spaces collapsed, with one audit row;
 *   3. blank clears it back to NULL (= no ⓘ);
 *   4. over 120 characters is refused by the core AND by the column's CHECK;
 *   5. an unknown service and a combined (merged_into) service are refused.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import type { AdminDb } from '../../app/admin/categories/_components/taxonomy-writes';

type Writes = typeof import('../../app/admin/categories/_components/taxonomy-writes');
let W: Writes;
let db: PGlite;
let admin: AdminDb;
let ACTOR = '';
let SERVICE = '';

before(async () => {
  db = (await createReplayedDb()).db;
  admin = makeAdminClient(db) as unknown as AdminDb;
  ACTOR = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('service-info-admin@setnayan.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  // A live (not combined) service from the seed.
  SERVICE = (
    await db.query<{ k: string }>(
      `SELECT s.canonical_service AS k FROM public.canonical_service_schemas s
         JOIN public.canonical_service_taxonomy t USING (canonical_service)
        WHERE t.merged_into IS NULL ORDER BY s.canonical_service LIMIT 1`,
    )
  ).rows[0]!.k;
  W = await import('../../app/admin/categories/_components/taxonomy-writes');
});
after(async () => {
  await db?.close();
});

const hintOf = async (k: string) =>
  (await db.query<{ h: string | null }>(`SELECT hint_en AS h FROM public.canonical_service_schemas WHERE canonical_service = $1`, [k])).rows[0]?.h;

test('the column exists, nullable, and every service starts EMPTY — no definition is written for the owner', async () => {
  const c = (
    await db.query<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'canonical_service_schemas' AND column_name = 'hint_en'`,
    )
  ).rows[0];
  assert.deepEqual(c, { is_nullable: 'YES', data_type: 'text' }, 'canonical_service_schemas.hint_en is missing or not a nullable text');
  const total = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.canonical_service_schemas`)).rows[0]!.n;
  assert.ok(total > 50, 'the service seed did not replay — nothing was checked');
  const written = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.canonical_service_schemas WHERE hint_en IS NOT NULL`)).rows[0]!.n;
  assert.equal(written, 0, 'a migration wrote service definitions — they are the owner’s to write in Admin › Categories');
});

test('a save writes the one line (spaces collapsed) and records one audit row', async () => {
  /* 🧪 SABOTAGE TARGET: the core's update of canonical_service_schemas.hint_en. */
  const r = await W.setServiceInfoTextCore(admin, ACTOR, SERVICE, '  Takes   the photos\non the day.  ');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(await hintOf(SERVICE), 'Takes the photos on the day.');
  const audits = (
    await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'taxonomy.set_service_info_text' AND target_id = $1`,
      [SERVICE],
    )
  ).rows[0]!.n;
  assert.equal(audits, 1);
  const again = await W.setServiceInfoTextCore(admin, ACTOR, SERVICE, 'Takes the photos on the day.');
  assert.deepEqual(again, { ok: true, message: 'No change.' });
});

test('blank clears it back to NULL — the service then shows no ⓘ', async () => {
  const r = await W.setServiceInfoTextCore(admin, ACTOR, SERVICE, '   ');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(await hintOf(SERVICE), null);
});

test('over 120 characters is refused — by the core, and by the column itself', async () => {
  const long = 'x'.repeat(121);
  const r = await W.setServiceInfoTextCore(admin, ACTOR, SERVICE, long);
  assert.equal(r.ok, false);
  assert.equal(await hintOf(SERVICE), null, 'a refused line was written');
  const ok120 = await W.setServiceInfoTextCore(admin, ACTOR, SERVICE, 'y'.repeat(120));
  assert.ok(ok120.ok, '120 characters must fit');
  await assert.rejects(
    db.query(`UPDATE public.canonical_service_schemas SET hint_en = $1 WHERE canonical_service = $2`, [long, SERVICE]),
    /canonical_service_schemas_hint_en_length/,
  );
});

test('an unknown service and a combined one are refused', async () => {
  const unknown = await W.setServiceInfoTextCore(admin, ACTOR, 'no_such_service_d4', 'A line.');
  assert.equal(unknown.ok, false);
  const [{ k: from }, { k: into }] = (
    await db.query<{ k: string }>(
      `SELECT s.canonical_service AS k FROM public.canonical_service_schemas s
         JOIN public.canonical_service_taxonomy t USING (canonical_service)
        WHERE t.merged_into IS NULL AND s.canonical_service <> $1 ORDER BY s.canonical_service LIMIT 2`,
      [SERVICE],
    )
  ).rows as [{ k: string }, { k: string }];
  await db.query(`UPDATE public.canonical_service_taxonomy SET merged_into = $1 WHERE canonical_service = $2`, [into, from]);
  const combined = await W.setServiceInfoTextCore(admin, ACTOR, from, 'A line.');
  assert.equal(combined.ok, false);
  assert.equal(await hintOf(from), null);
});
