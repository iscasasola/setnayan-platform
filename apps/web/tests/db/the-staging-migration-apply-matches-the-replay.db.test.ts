/**
 * THE STAGING BRANCH'S MIGRATIONS FINISH THE WAY THE REPLAY DOES — scripts/staging/apply-migrations.ts, on the real
 * corpus, on every pull request.
 *
 * 🚨 THE FAULT (measured 25 Nov 2026 on the `final-check` preview branch): Supabase branching applies in strict
 * version order, applied 116 files, and stopped on `20260530010000` (`relation "public.vendor_billing_catalog" does
 * not exist`). The script picks up from exactly that state. So this test builds exactly that state first — strict
 * order, one ledger row per file, stop at the first failure — and then runs the script's own `applyPendingMigrations`
 * over it, through a `SqlClient` that is PGlite instead of `pg`. The only differences from the branch are the
 * transport and the replay's documented shims (`preprocess`: no pg_cron / pg_net / pgvector in PGlite).
 *
 * What it holds:
 *   · strict order stops where the real branch stopped (so the starting state is the branch's, not a guess);
 *   · the script skips everything the ledger holds and applies the rest with nothing left failing;
 *   · it lands out of order exactly what the replay pins (EXPECTED_OUT_OF_ORDER), and nothing after the corpus;
 *   · every version in the checkout is in the ledger afterwards (what `list_migrations` on the branch will show);
 *   · a second run applies nothing;
 *   · the database it builds IS the replay's: same schema (columns, functions, policies, constraints, triggers) and
 *     the same admin catalogue rows — the 2026-08-31 defect was an OLD file overwriting the price sheet, so the price
 *     rows are compared, not just the shape;
 *   · a file Postgres refuses inside a transaction (an enum value added and used at once: SQLSTATE 55P04) runs bare
 *     and resumes at the statement it stopped on — on real Postgres semantics, not a model.
 *
 * Cost: one strict pass over the first 117 files, one full run (the unconditional drain the branch needs), one
 * replay to compare against.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { BOOTSTRAP, createReplayedDb, preprocess } from './replay-migrations';
import { EXPECTED_OUT_OF_ORDER, MIGRATIONS_DIR, versionOf } from './migration-order';
import {
  applyPendingMigrations,
  ledgerInsertSql,
  splitStatements,
  type ApplyReport,
  type SqlClient,
} from '../../../../scripts/staging/apply-migrations-core';

const FILES = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
/** The file as the replay reads it: `preprocess` swaps the three extensions PGlite lacks, and nothing else. */
const readFile = (f: string) => preprocess(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));

/** PGlite behind the script's one-method client. A query with no params is a simple multi-statement query, like pg's. */
function client(db: PGlite): SqlClient {
  return {
    async query(text, params) {
      if (params) return { rows: (await db.query<Record<string, unknown>>(text, params)).rows };
      const res = await db.exec(text);
      return { rows: (res.at(-1)?.rows ?? []) as Array<Record<string, unknown>> };
    },
  };
}

async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec('CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;');
  await db.exec(BOOTSTRAP);
  return db;
}

/** What a Supabase preview branch does: every file in version order with its ledger row, stopping at the first failure. */
async function branchStrictOrder(db: PGlite): Promise<{ applied: number; stoppedAt: string; error: string }> {
  await db.exec(
    'CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY, statements text[], name text);',
  );
  for (let i = 0; i < FILES.length; i++) {
    const f = FILES[i]!;
    try {
      await db.exec(`${readFile(f)}\n;\n${ledgerInsertSql(f, splitStatements(readFile(f)))};`);
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});
      return { applied: i, stoppedAt: f, error: (e instanceof Error ? e.message : String(e)).split('\n')[0]! };
    }
  }
  return { applied: FILES.length, stoppedAt: '', error: '' };
}

/** Schema + admin catalogue, minus what differs between any two builds (generated ids, timestamps). */
const FINGERPRINT_SQL = `
WITH stable AS (
  SELECT 'col ' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') AS x
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_replay_migrations'
  UNION ALL SELECT 'fn ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  UNION ALL SELECT 'pol ' || schemaname || '.' || tablename || '.' || policyname || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
    FROM pg_policies WHERE schemaname IN ('public', 'storage')
  UNION ALL SELECT 'con ' || conrelid::regclass::text || '.' || conname || ' ' || pg_get_constraintdef(oid)
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace
  UNION ALL SELECT 'trg ' || tgrelid::regclass::text || '.' || tgname FROM pg_trigger WHERE NOT tgisinternal
)
SELECT count(*)::int AS n, md5(string_agg(x, E'\\n' ORDER BY x)) AS h FROM stable`;

const CATALOG_TABLES = ['vendor_billing_catalog', 'platform_retail_catalog_v2', 'platform_settings'];
const catalogSql = (table: string) => `
SELECT count(*)::int AS n, md5(string_agg(j::text, E'\\n' ORDER BY j::text)) AS h
  FROM (SELECT (SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(t))
                 WHERE NOT (jsonb_typeof(value) = 'string' AND (
                   value #>> '{}' ~ '^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:' OR
                   value #>> '{}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))) AS j
          FROM public.${table} t) s`;

let db: PGlite;
let branch: { applied: number; stoppedAt: string; error: string };
let report: ApplyReport;
let ms = 0;

test.before(async () => {
  db = await freshDb();
  branch = await branchStrictOrder(db);
  const t0 = Date.now();
  report = await applyPendingMigrations({ client: client(db), files: FILES, readFile, retryDelayMs: 0 });
  ms = Date.now() - t0;
  console.log(
    `# staging apply: ${report.plan.alreadyApplied.length} already in the ledger, ${report.applied.length} applied in ${ms} ms, ` +
      `${report.skipped.length} known skips, ${report.outOfOrder.length} out of order, ${report.stillFailing.length} still failing`,
  );
});

test.after(async () => {
  await db?.close();
});

test('strict version order stops where the real branch stopped', () => {
  assert.equal(branch.stoppedAt, '20260530010000_iteration_0006_v2_1_amendment_2.sql');
  assert.equal(branch.error, 'relation "public.vendor_billing_catalog" does not exist');
  assert.equal(branch.applied, 116, 'the branch reported 116 applied, up to and including 20260530000000');
});

test('the script finishes the branch: the ledger is skipped, nothing is left failing, nothing lands after the corpus', () => {
  assert.equal(report.plan.alreadyApplied.length, branch.applied);
  assert.deepEqual(report.stillFailing, [], JSON.stringify(report.stillFailing, null, 2));
  assert.equal(report.applied.length + report.skipped.length, report.plan.pending.length);
  assert.deepEqual(report.outOfOrder.filter((o) => o.viaFinalPass), []);
  const got: Record<string, string> = {};
  for (const o of report.outOfOrder) got[o.file] = o.landedAfter;
  assert.deepEqual(got, EXPECTED_OUT_OF_ORDER, 'the branch must land out of order exactly what the replay pins');
  assert.deepEqual(report.unexpectedOutOfOrder, []);
  assert.deepEqual(report.bare, [], 'no file in this corpus needs to run outside a transaction today');
});

test('afterwards the ledger holds every version in the checkout, and a second run applies nothing', async () => {
  const held = new Set(
    (await db.query<{ version: string }>('SELECT version FROM supabase_migrations.schema_migrations')).rows.map((r) => r.version),
  );
  assert.deepEqual(FILES.filter((f) => !held.has(versionOf(f))), []);
  const again = await applyPendingMigrations({ client: client(db), files: FILES, readFile, retryDelayMs: 0 });
  assert.deepEqual(again.plan.pending, []);
  assert.deepEqual(again.applied, []);
});

test('the database it builds is the replay’s — schema and admin catalogue', async () => {
  const replay = await createReplayedDb({ bookingsAsMigrated: true });
  try {
    const mine = (await db.query<{ n: number; h: string }>(FINGERPRINT_SQL)).rows[0]!;
    const theirs = (await replay.db.query<{ n: number; h: string }>(FINGERPRINT_SQL)).rows[0]!;
    assert.ok(mine.n > 1000, `the fingerprint covers only ${mine.n} objects — too few to mean anything`);
    assert.deepEqual(mine, theirs, 'schema differs from the replay');
    for (const t of CATALOG_TABLES) {
      const a = (await db.query<{ n: number; h: string }>(catalogSql(t))).rows[0]!;
      const b = (await replay.db.query<{ n: number; h: string }>(catalogSql(t))).rows[0]!;
      assert.ok(a.n > 0, `${t} is empty — nothing compared`);
      assert.deepEqual(a, b, `${t} differs from the replay — an older file won somewhere`);
    }
  } finally {
    await replay.db.close();
  }
});

test('a file Postgres refuses inside a transaction runs bare and resumes where it stopped — real Postgres', async () => {
  const pg = await PGlite.create();
  try {
    const files: Record<string, string> = {
      '001_type.sql': `CREATE TYPE public.mood AS ENUM ('a');`,
      // in one transaction: 55P04 "unsafe use of new enum value". Bare: commits ADD VALUE, then stops on a table
      // 003 creates. A retry from statement 0 would add 'c' twice (42710) forever.
      '002_add_and_use.sql': `ALTER TYPE public.mood ADD VALUE 'c';\nSELECT 'c'::public.mood;\nINSERT INTO public.later (m) VALUES ('c');`,
      '003_later.sql': `CREATE TABLE public.later (m public.mood);`,
    };
    const c = client(pg);
    await pg.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE);');
    const r = await applyPendingMigrations({ client: c, files: Object.keys(files), readFile: (f) => files[f]!, retryDelayMs: 0 });
    assert.deepEqual(r.stillFailing, [], JSON.stringify(r.stillFailing));
    assert.deepEqual(r.bare, ['002_add_and_use.sql']);
    assert.deepEqual(r.applied, ['001_type.sql', '003_later.sql', '002_add_and_use.sql']);
    assert.deepEqual((await pg.query<{ m: string }>('SELECT m::text FROM public.later')).rows, [{ m: 'c' }]);
  } finally {
    await pg.close();
  }
});
