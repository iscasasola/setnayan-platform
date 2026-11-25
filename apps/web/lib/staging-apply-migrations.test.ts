/**
 * THE STAGING MIGRATION APPLY, HELD — scripts/staging/apply-migrations{,-core}.ts by behaviour.
 *
 *   target     production's ref anywhere in the URL is refused; STAGING=1, a real non-production project, no
 *              transaction pooler; the runner refuses by RUNNING it, before it opens anything
 *   ledger     the Supabase CLI's own table and row shape; a name with a quote cannot break the insert
 *   plan       what the ledger holds is never touched; the expected out-of-order list is the replay's pinned one
 *   dry run    one READ ONLY transaction, rolled back — no statement that writes
 *   run        on a scripted database: a back-numbered file lands right after the file that unblocks it; a file
 *              Postgres refuses inside a transaction runs bare and RESUMES where it stopped (at its own BEGIN when
 *              it failed inside one); a transient error is retried in place, never deferred; a lost connection
 *              stops the run; a known skip is recorded and listed, an unknown failure is not
 *
 * The real corpus runs through the same `applyPendingMigrations` over PGlite in
 * tests/db/the-staging-migration-apply-matches-the-replay.db.test.ts.
 *
 * SABOTAGE (each seen red, restored): resume a bare file from statement 0 (the ADD-VALUE-twice case goes red) ·
 * defer a lock timeout instead of retrying it in place (the file lands out of order) · drop the raw-ref check from
 * `applyTarget` (the password-carries-the-ref case goes red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  LEDGER_DDL,
  LEDGER_EXISTS_SQL,
  LEDGER_READ_SQL,
  OWNER_PRECONDITION_SQL,
  SESSION_SQL,
  StopRun,
  applyPendingMigrations,
  applyTarget,
  exitCodeFor,
  formatPlan,
  formatReport,
  leadingKeyword,
  ledgerInsertSql,
  migrationName,
  planMigrations,
  readPlan,
  splitStatements,
  type SqlClient,
} from '../../../scripts/staging/apply-migrations-core';
import { ALLOWED_SKIP, EXPECTED_OUT_OF_ORDER } from '../tests/db/migration-order';

const ROOT = resolve(import.meta.dirname, '../../..');
const TSX = join(ROOT, 'node_modules/.bin/tsx');
const PROD = 'njrupjnvkjkitfctetvi';
const BRANCH = 'meqimglsccdsizwxydbn';
const pooler = (ref: string, port = 5432) => `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-1.pooler.supabase.com:${port}/postgres`;

/* ── target ───────────────────────────────────────────────────────────────────────────────────────────────────── */

test('the target: production is refused wherever its ref appears, and only a real staging branch passes', () => {
  const ok = (dbUrl: string, staging: string | undefined = '1') => applyTarget({ staging, dbUrl });

  assert.deepEqual(ok(pooler(BRANCH)), { ok: true, ref: BRANCH, local: false });
  assert.deepEqual(ok(`postgresql://postgres:pw@db.${BRANCH}.supabase.co:5432/postgres`), { ok: true, ref: BRANCH, local: false });
  assert.deepEqual(ok('postgresql://postgres:postgres@127.0.0.1:54322/postgres'), { ok: true, ref: null, local: true });

  for (const prod of [
    pooler(PROD),
    `postgresql://postgres:pw@db.${PROD}.supabase.co:5432/postgres`,
    // the ref where no parser looks: the password, the query string, upper case
    `postgresql://postgres.${BRANCH}:${PROD}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
    `${pooler(BRANCH)}?options=${PROD}`,
    pooler(PROD.toUpperCase()),
  ]) {
    const t = ok(prod);
    assert.equal(t.ok, false, prod);
    assert.match((t as { why: string }).why, /PRODUCTION/);
  }

  assert.match((applyTarget({ staging: undefined, dbUrl: pooler(BRANCH) }) as { why: string }).why, /STAGING=1/, 'a default parameter must not stand in for the variable');
  assert.match((ok(pooler(BRANCH), 'true') as { why: string }).why, /STAGING=1/, 'a writer reads STAGING narrowly');
  assert.match((ok(pooler(BRANCH, 6543)) as { why: string }).why, /TRANSACTION pooler/);
  assert.match((ok('postgresql://postgres:pw@db.example.com:5432/postgres') as { why: string }).why, /names no Supabase project/);
  assert.match((ok('') as { why: string }).why, /not set/);
});

function run(env: Record<string, string>): { status: number | null; out: string } {
  const r = spawnSync(TSX, [join(ROOT, 'scripts/staging/apply-migrations.ts'), '--dry-run'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('the runner refuses production before it opens a connection — run, not read', () => {
  const prod = run({ STAGING: '1', STAGING_DB_URL: pooler(PROD) });
  assert.equal(prod.status, 2, prod.out);
  assert.match(prod.out, /REFUSED — the database URL contains PRODUCTION's ref/);
  assert.doesNotMatch(prod.out, /✔ target/);
  assert.doesNotMatch(prod.out, /:pw@/, 'the URL (and its password) is never printed');

  const unset = run({ STAGING_DB_URL: pooler(BRANCH) });
  assert.equal(unset.status, 2, unset.out);
  assert.match(unset.out, /STAGING=1 is not set/);
});

/* ── ledger ───────────────────────────────────────────────────────────────────────────────────────────────────── */

test("the ledger is the Supabase CLI's own table, and a row cannot be broken by a quote", () => {
  assert.equal(
    LEDGER_DDL,
    [
      'CREATE SCHEMA IF NOT EXISTS supabase_migrations',
      'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY)',
      'ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN IF NOT EXISTS statements text[]',
      'ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN IF NOT EXISTS name text',
    ].join(';\n'),
  );
  assert.equal(migrationName('20260530010000_iteration_0006_v2_1_amendment_2.sql'), 'iteration_0006_v2_1_amendment_2');
  assert.equal(
    ledgerInsertSql('20260101000000_o_brien.sql', ["SELECT 'it''s'", 'SELECT 2']),
    "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('20260101000000', 'o_brien', ARRAY['SELECT ''it''''s''', 'SELECT 2']::text[])",
  );
  assert.match(ledgerInsertSql('20260101000000_empty.sql', []), /'\{\}'::text\[\]\)$/);
});

/* ── statements ───────────────────────────────────────────────────────────────────────────────────────────────── */

test('statements split on top-level semicolons only', () => {
  const sql = [
    '-- a comment; with a semicolon',
    'CREATE TABLE a (x text DEFAULT \'x;y\');',
    '/* block; /* nested; */ still comment; */',
    "SELECT E'it\\'s; fine', \"we;ird\" FROM a;",
    'CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN PERFORM 1; END $fn$;',
    'DO $$ BEGIN RAISE NOTICE \'%\', 1; END $$;',
    'SELECT $1::int AS p',
    ';;',
    '-- trailing comment only',
  ].join('\n');
  assert.deepEqual(splitStatements(sql), [
    "-- a comment; with a semicolon\nCREATE TABLE a (x text DEFAULT 'x;y')",
    "/* block; /* nested; */ still comment; */\nSELECT E'it\\'s; fine', \"we;ird\" FROM a",
    'CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $fn$ BEGIN PERFORM 1; END $fn$',
    "DO $$ BEGIN RAISE NOTICE '%', 1; END $$",
    'SELECT $1::int AS p',
  ]);
  assert.equal(leadingKeyword('-- why\n/* note */  begin;'), 'begin');
  assert.equal(leadingKeyword('COMMIT'), 'commit');
});

/* ── plan ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

test('the plan: the ledger is never re-applied, and the out-of-order list is the replay’s pinned one', () => {
  const [late, unblocker] = Object.entries(EXPECTED_OUT_OF_ORDER)[0]!;
  const skip = [...ALLOWED_SKIP.keys()][0]!;
  const files = ['20260101000000_first.sql', '20260102000000_second.sql', late, unblocker, skip].sort();
  const plan = planMigrations(files, [
    { version: '20260101000000', name: 'first' },
    { version: '20260102000000', name: 'renamed_since' },
    { version: '20990101000000', name: 'from_elsewhere' },
  ]);
  assert.deepEqual(plan.alreadyApplied, ['20260101000000_first.sql', '20260102000000_second.sql']);
  assert.deepEqual(plan.pending, [late, unblocker, skip].sort());
  assert.deepEqual(plan.ledgerOnly, ['20990101000000']);
  assert.deepEqual(plan.nameMismatch, [{ file: '20260102000000_second.sql', ledgerName: 'renamed_since' }]);
  assert.deepEqual(plan.expectedOutOfOrder, [{ file: late, landsAfter: unblocker }]);
  assert.deepEqual(plan.mayBeSkipped.map((s) => s.file), [skip]);
  assert.equal(plan.ownerPrecondition, true);
  assert.match(formatPlan(plan, false), /to apply {28}3/);

  const nothing = planMigrations(['20260101000000_first.sql'], [{ version: '20260101000000', name: '' }]);
  assert.deepEqual(nothing.pending, []);
  assert.equal(nothing.ownerPrecondition, false, 'nothing to apply → nothing is written, not even the owner row');
  assert.deepEqual(nothing.nameMismatch, [], 'a ledger row with no name is not a mismatch');
});

/* ── a scripted database ──────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A database small enough to reason about. A migration is a list of statements in a tiny language:
 *   MAKE x · NEED x (42P01 unless x exists) · NOTX (25001 inside a multi-statement query) · ENUMADD v (42710 if v
 *   exists) · FLAKY k (55P03 the first k times) · DROP (the connection dies) · BEGIN / COMMIT · INSERT (a ledger row)
 * Postgres' transaction rules, kept: a multi-statement query is one implicit transaction (all or none); one statement
 * on its own commits; an explicit BEGIN opens a block that spans queries until COMMIT, and a failure inside it is
 * undone by the ROLLBACK that follows.
 */
class FakeDb implements SqlClient {
  /** Committed state: objects (`x`, `enum:v`) and ledger rows (`ledger:<version>` → name). */
  committed = new Map<string, string>();
  /** The open explicit block, if any. */
  tx: Map<string, string> | null = null;
  log: string[] = [];
  flaky = new Map<string, number>();
  ownerRows = 0;

  has = (obj: string) => this.committed.has(obj);
  seedLedger = (version: string, name: string) => this.committed.set(`ledger:${version}`, name);
  ledgerVersions = () => [...this.committed.keys()].filter((k) => k.startsWith('ledger:')).map((k) => k.slice(7)).sort();
  ledgerName = (version: string) => this.committed.get(`ledger:${version}`);

  async query(text: string): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.log.push(text);
    if ([SESSION_SQL, LEDGER_DDL, 'BEGIN TRANSACTION READ ONLY'].includes(text)) return { rows: [] };
    if (text === 'ROLLBACK') return ((this.tx = null), { rows: [] });
    if (text === OWNER_PRECONDITION_SQL) return (this.ownerRows++, { rows: [] });
    if (text === LEDGER_EXISTS_SQL) return { rows: [{ present: true }] };
    if (text === LEDGER_READ_SQL) return { rows: this.ledgerVersions().map((version) => ({ version, name: this.ledgerName(version) })) };
    if (/^SELECT to_regclass\('(cron\.job|auth\.users)'\)/.test(text)) return { rows: [{ present: false }] };

    const stmts = splitStatements(text);
    let w = new Map(this.tx ?? this.committed);
    const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
    for (const s of stmts) {
      const [op, arg] = s.split(/\s+/);
      if (op === 'BEGIN') this.tx = w;
      else if (op === 'COMMIT') {
        this.committed = w;
        this.tx = null;
        w = new Map(w);
      } else if (op === 'MAKE') w.set(arg!, '');
      else if (op === 'NEED' && !w.has(arg!)) throw fail('42P01', `relation "${arg}" does not exist`);
      else if (op === 'NOTX' && stmts.length > 1) throw fail('25001', 'CREATE INDEX CONCURRENTLY cannot run inside a transaction block');
      else if (op === 'ENUMADD') {
        if (w.has(`enum:${arg}`)) throw fail('42710', `enum label "${arg}" already exists`);
        w.set(`enum:${arg}`, '');
      } else if (op === 'FLAKY') {
        const left = this.flaky.get(s) ?? Number(arg);
        this.flaky.set(s, left - 1);
        if (left > 0) throw fail('55P03', 'canceling statement due to lock timeout');
      } else if (op === 'DROP') throw new Error('Connection terminated unexpectedly');
      else if (op === 'INSERT') {
        const m = /VALUES \('([^']+)', '([^']*)'/.exec(s)!;
        if (w.has(`ledger:${m[1]}`)) throw fail('23505', 'duplicate key value violates unique constraint');
        w.set(`ledger:${m[1]}`, m[2]!);
      }
    }
    if (this.tx) this.tx = w;
    else this.committed = w;
    return { rows: [] };
  }
}

const corpus = (files: Record<string, string>) => ({ files: Object.keys(files).sort(), readFile: (f: string) => files[f]! });

test('a back-numbered file lands right after the file that unblocks it, and every row reaches the ledger', async () => {
  const db = new FakeDb();
  db.seedLedger('001', 'already');
  const { files, readFile } = corpus({
    '001_already.sql': 'MAKE base;',
    '002_needs_catalog.sql': 'NEED catalog; MAKE seeded;',
    '003_makes_catalog.sql': 'MAKE catalog;',
    '004_reprice.sql': 'NEED seeded; MAKE repriced;',
  });
  const events: string[] = [];
  const r = await applyPendingMigrations({ client: db, files, readFile, retryDelayMs: 0, onEvent: (e) => events.push(`${e.kind}:${e.file}`) });

  assert.deepEqual(r.applied, ['003_makes_catalog.sql', '002_needs_catalog.sql', '004_reprice.sql']);
  assert.deepEqual(r.outOfOrder.map((o) => `${o.file} -> ${o.landedAfter}`), ['002_needs_catalog.sql -> 003_makes_catalog.sql']);
  assert.equal(r.outOfOrder[0]?.reason, 'relation "catalog" does not exist');
  assert.deepEqual(r.stillFailing, []);
  assert.deepEqual(db.ledgerVersions(), ['001', '002', '003', '004']);
  assert.equal(db.ledgerName('002'), 'needs_catalog');
  assert.ok(!db.log.some((q) => q.includes('MAKE base')), 'a version the ledger holds is never sent again');
  assert.equal(db.ownerRows, 1, 'the owner precondition runs once, before the first file');
  assert.deepEqual(events.filter((e) => e.startsWith('deferred')), ['deferred:002_needs_catalog.sql'], 'a deferral is reported once, not per retry');
  assert.equal(r.unexpectedOutOfOrder.length, 1, 'a landing the replay does not pin is flagged (this fake corpus is not the real one)');
  assert.equal(exitCodeFor(r), 3);

  const again = await applyPendingMigrations({ client: db, files, readFile, retryDelayMs: 0 });
  assert.deepEqual(again.plan.pending, [], 'a second run finds nothing to do');
  assert.deepEqual(again.applied, []);
});

test('a file Postgres refuses inside a transaction runs bare, and resumes where it stopped', async () => {
  const db = new FakeDb();
  const { files, readFile } = corpus({
    '001_concurrent.sql': 'MAKE before; NOTX; MAKE after;',
    // goes bare, commits ENUMADD + NOTX, then stops on a table 003 makes. Resuming from statement 0 would add the
    // enum value twice and fail forever — the resume point is what lets it finish.
    '002_bare_then_blocked.sql': 'ENUMADD c; NOTX; NEED later; MAKE used_c;',
    '003_makes_later.sql': 'MAKE later;',
    // inside its own BEGIN … COMMIT a failure undoes the block, so the resume point is the BEGIN, not the statement
    '004_block.sql': 'NOTX; BEGIN; MAKE in_block; NEED fifth; COMMIT;',
    '005_makes_fifth.sql': 'MAKE fifth;',
  });
  const events: string[] = [];
  const r = await applyPendingMigrations({ client: db, files, readFile, retryDelayMs: 0, onEvent: (e) => events.push(`${e.kind}:${e.file}`) });

  assert.deepEqual(r.stillFailing, [], JSON.stringify(r.stillFailing));
  assert.deepEqual(r.bare, ['001_concurrent.sql', '002_bare_then_blocked.sql', '004_block.sql']);
  assert.deepEqual(r.applied, ['001_concurrent.sql', '003_makes_later.sql', '002_bare_then_blocked.sql', '005_makes_fifth.sql', '004_block.sql']);
  for (const o of ['before', 'after', 'enum:c', 'used_c', 'in_block']) assert.ok(db.has(o), o);
  assert.equal(db.log.filter((q) => q === 'ENUMADD c').length, 1, 'the committed statement of a bare file is never re-run');
  assert.equal(db.log.filter((q) => q === 'BEGIN').length, 2, 'a failure inside the file’s own block resumes at its BEGIN');
  assert.deepEqual(db.ledgerVersions(), ['001', '002', '003', '004', '005']);
  assert.deepEqual(events.filter((e) => e.startsWith('bare')), ['bare:001_concurrent.sql', 'bare:002_bare_then_blocked.sql', 'bare:004_block.sql']);
});

test('a transient failure is retried in place — never deferred, so it never moves', async () => {
  const db = new FakeDb();
  const { files, readFile } = corpus({
    '001_flaky.sql': 'FLAKY 2; MAKE one;',
    '002_next.sql': 'NEED one;',
  });
  const r = await applyPendingMigrations({ client: db, files, readFile, retryDelayMs: 0 });
  assert.deepEqual(r.applied, ['001_flaky.sql', '002_next.sql']);
  assert.deepEqual(r.outOfOrder, []);

  const stubborn = new FakeDb();
  const c2 = corpus({ '001_flaky.sql': 'FLAKY 9; MAKE one;', '002_next.sql': 'MAKE two;' });
  await assert.rejects(applyPendingMigrations({ client: stubborn, ...c2, retryDelayMs: 0 }), (e: unknown) => {
    assert.ok(e instanceof StopRun);
    assert.equal(e.file, '001_flaky.sql');
    return true;
  });
  assert.ok(!stubborn.ledgerVersions().includes('002'), 'it stopped rather than moving on past a file it could not apply');
});

test('a lost connection stops the run; the ledger keeps what was applied, and the next run resumes', async () => {
  const db = new FakeDb();
  const files = { '001_ok.sql': 'MAKE one;', '002_drop.sql': 'DROP;', '003_ok.sql': 'MAKE three;' };
  await assert.rejects(applyPendingMigrations({ client: db, ...corpus(files), retryDelayMs: 0 }), StopRun);
  assert.deepEqual(db.ledgerVersions(), ['001']);

  files['002_drop.sql'] = 'MAKE two;';
  const r = await applyPendingMigrations({ client: db, ...corpus(files), retryDelayMs: 0 });
  assert.deepEqual(r.plan.alreadyApplied, ['001_ok.sql']);
  assert.deepEqual(r.applied, ['002_drop.sql', '003_ok.sql']);
});

test('a known skip is recorded and listed; an unknown failure is reported and NOT recorded', async () => {
  const skip = [...ALLOWED_SKIP.keys()].sort()[0]!;
  const db = new FakeDb();
  const r = await applyPendingMigrations({
    client: db,
    ...corpus({ [skip]: 'NEED never_there;', '30000101000000_broken.sql': 'NEED also_never;', '30000102000000_fine.sql': 'MAKE x;' }),
    retryDelayMs: 0,
  });
  assert.deepEqual(r.skipped.map((s) => [s.file, s.error]), [[skip, 'relation "never_there" does not exist']]);
  assert.deepEqual(r.stillFailing, [{ file: '30000101000000_broken.sql', error: 'relation "also_never" does not exist' }]);
  assert.ok(db.ledgerVersions().includes(skip.split('_')[0]!), 'production’s ledger holds the known skip, so the branch’s does too');
  assert.ok(!db.ledgerVersions().includes('30000101000000'), 'a real failure is never written down as applied');
  assert.equal(exitCodeFor(r), 1);
  assert.match(formatReport(r), /still failing\s+\n\s+30000101000000_broken\.sql\n\s+relation "also_never" does not exist/);
});

test('the dry run is one READ ONLY transaction, rolled back, and sends nothing that writes', async () => {
  const db = new FakeDb();
  db.seedLedger('001', 'one');
  const { plan } = await readPlan(db, ['001_one.sql', '002_two.sql']);
  assert.deepEqual(plan.pending, ['002_two.sql']);
  assert.equal(db.log[0], 'BEGIN TRANSACTION READ ONLY');
  assert.equal(db.log.at(-1), 'ROLLBACK');
  for (const q of db.log.slice(1, -1)) assert.match(q, /^SELECT /, q);
});
