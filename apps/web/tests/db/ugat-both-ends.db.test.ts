/**
 * tests/db/ugat-both-ends.db.test.ts — EVERY CONNECTION HAS BOTH ENDS.
 *
 * The third half of the Ugat guards. `ugat-schema-claims` proves the map never
 * says anything false; `ugat-concept-coverage` proves it never misses a new
 * subsystem. This proves that what exists on one side of a connection has a
 * live counterpart on the other — an RPC has a caller, a table has a writer, a
 * notification type has an emitter, a component has a mount, and a read error
 * on a money or connection path is recorded, not dropped. Five orphan classes;
 * the rules and their fixtures live in lib/ugat/both-ends.ts and its unit test.
 *
 * ── WHY THIS RUNS HERE ─────────────────────────────────────────────────────
 * Two of the five classes need the DATABASE, not the repo: an RPC's caller is
 * as often an RLS policy or another function body as it is `.rpc()`, and a
 * TypeScript grep cannot see either (a real revoke on that false "no caller"
 * broke every private Realtime channel for weeks — memory, 2026-08). So the SQL
 * side is read from pg_catalog after the full migration replay. And
 * `test:db:ci` runs inside the REQUIRED "typecheck + lint" check, so this
 * gates merges with nothing to wire and nothing to forget.
 *
 * ── THE BASELINE IS A RANKED DEBT LIST, NOT PERMISSION ─────────────────────
 * `ugat-both-ends.baseline.txt` holds what was already orphaned on day one,
 * grouped by user impact (money > booking > couple > supplier > admin) because
 * the controller turns the top of it into build sessions. This test is green
 * on arrival and red on any NEW orphan. Fixing one prints "paid down" — delete
 * the line, or regenerate with UPDATE_BOTH_ENDS_BASELINE=1 from apps/web.
 * Adding a line by hand is the wrong answer to a red run: join the two ends,
 * or delete the end nobody needs, and say which in the PR.
 *
 * ── WHAT A ZERO MEANS ──────────────────────────────────────────────────────
 * Every count is printed and floored. A sweep that found nothing — wrong cwd,
 * a renamed folder, a parser that stopped seeing calls — must fail loudly, not
 * pass quietly. The floors sit far under today's numbers and exist only so
 * "nothing to find" and "never looked" stop being the same green.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createReplayedDb } from './replay-migrations';
import {
  diffBaseline,
  findComponentOrphans,
  findNoticeOrphans,
  findRpcOrphans,
  findSilentDrops,
  findTableOrphans,
  formatBaseline,
  formatGrown,
  indexLiterals,
  indexWriters,
  parseAllowlist,
  parseBaseline,
  parseNotificationUnion,
  rankFindings,
  type Catalog,
  type OrphanFinding,
  type SourceFile,
} from '../../lib/ugat/both-ends';

/** tests/db → apps/web. Floored below, because two levels from the wrong start lands somewhere real. */
const WEB = path.resolve(__dirname, '..', '..');
const BASELINE = path.join(__dirname, 'ugat-both-ends.baseline.txt');
const ROOTS = ['app', 'lib', 'components'];
const EXTRA = ['middleware.ts', 'instrumentation.ts', 'instrumentation-client.ts'];
const REGISTRY = ['lib/notifications.ts', 'lib/notification-emit.ts'];

function walk(dir: string, out: string[]) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
}

function readSources(): { sources: SourceFile[]; tests: SourceFile[] } {
  const abs: string[] = [];
  for (const r of ROOTS) if (fs.existsSync(path.join(WEB, r))) walk(path.join(WEB, r), abs);
  for (const e of EXTRA) if (fs.existsSync(path.join(WEB, e))) abs.push(path.join(WEB, e));
  const sources: SourceFile[] = [];
  const tests: SourceFile[] = [];
  for (const a of abs) {
    const rel = path.relative(WEB, a).split(path.sep).join('/');
    const f = { path: rel, text: fs.readFileSync(a, 'utf8') };
    (/\.(test|spec)\.tsx?$/.test(rel) ? tests : sources).push(f);
  }
  return { sources, tests };
}

async function introspect(db: Awaited<ReturnType<typeof createReplayedDb>>['db']): Promise<Catalog & { enumLabels: string[] }> {
  const fns = await db.query<{ name: string; src: string; trg: boolean }>(
    `SELECT p.proname AS name, p.prosrc AS src, (pg_get_function_result(p.oid) = 'trigger') AS trg
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')`,
  );
  const policies = await db.query<{ table: string; name: string; qual: string | null; with_check: string | null }>(
    `SELECT tablename AS "table", policyname AS name, qual, with_check FROM pg_policies`,
  );
  const triggers = await db.query<{ table: string; name: string; fn: string }>(
    `SELECT c.relname AS "table", t.tgname AS name, p.proname AS fn
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal`,
  );
  const views = await db.query<{ owner: string; def: string }>(
    `SELECT 'view ' || viewname AS owner, definition AS def FROM pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`,
  );
  const cron = await db.query<{ owner: string; def: string }>(`SELECT 'cron job ' || jobname AS owner, command AS def FROM cron.job`);
  const defaults = await db.query<{ owner: string; def: string }>(
    `SELECT 'default ' || c.relname || '.' || a.attname AS owner, pg_get_expr(d.adbin, d.adrelid) AS def
       FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
       JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'`,
  );
  const checks = await db.query<{ owner: string; def: string }>(
    `SELECT 'check ' || c.relname || '.' || con.conname AS owner, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'c'`,
  );
  const tables = await db.query<{ name: string }>(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
  );
  const rowCounts: Record<string, number> = {};
  for (const t of tables.rows) {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."${t.name}"`);
    rowCounts[t.name] = r.rows[0]?.n ?? 0;
  }
  const labels = await db.query<{ l: string }>(
    `SELECT e.enumlabel AS l FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'notification_type'`,
  );
  return {
    functions: fns.rows.map((f) => ({ name: f.name, src: f.src, returnsTrigger: f.trg })),
    policies: policies.rows.map((p) => ({ table: p.table, name: p.name, qual: p.qual, withCheck: p.with_check })),
    triggers: triggers.rows,
    expressions: [...views.rows, ...cron.rows, ...defaults.rows, ...checks.rows],
    tables: tables.rows.map((t) => t.name),
    rowCounts,
    enumLabels: labels.rows.map((r) => r.l),
  };
}

function sweep(catalog: Catalog & { enumLabels: string[] }, sources: SourceFile[], tests: SourceFile[]) {
  const index = indexLiterals(sources);
  const rpc = findRpcOrphans(catalog, index);
  const tables = findTableOrphans(catalog, indexWriters(sources, catalog));
  const byPath = new Map(sources.map((s) => [s.path, s.text]));
  const notices = findNoticeOrphans(
    {
      union: parseNotificationUnion(byPath.get('lib/notifications.ts') ?? ''),
      emailAllowlist: parseAllowlist(byPath.get('lib/notification-emit.ts') ?? '', 'EMAIL_ENABLED_TYPES'),
      pushAllowlist: parseAllowlist(byPath.get('lib/notification-emit.ts') ?? '', 'PUSH_ENABLED_TYPES'),
      enumLabels: catalog.enumLabels,
      registryPaths: REGISTRY,
    },
    index,
  );
  const candidates = sources.map((s) => s.path).filter((p) => /(^|\/)_components\/[^/]+\.tsx$/.test(p) || /^components\/.*\.tsx$/.test(p));
  const components = findComponentOrphans({ files: byPath, testFiles: new Map(tests.map((t) => [t.path, t.text])), candidates });
  const drops = findSilentDrops(sources);
  const findings: OrphanFinding[] = rankFindings([...rpc.findings, ...tables.findings, ...notices.findings, ...components.findings, ...drops.findings]);
  return { index, rpc, tables, notices, components, drops, findings };
}

test('every connection has both ends — no NEW orphan beyond the ranked baseline', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());
  const catalog = await introspect(db);
  const { sources, tests } = readSources();
  const r = sweep(catalog, sources, tests);

  // ── ANTI-VACUITY: print what was searched, then floor it ──────────────────
  // Measured 2026-09-18 from apps/web: 1,436 migrations · 572 public functions ·
  // 418 tables · 87 union members · ~3,850 source files · ~960 _components.
  console.log(
    `# both-ends: ${applied} migrations · ${catalog.functions.length} functions · ${catalog.tables.length} tables · ` +
      `${sources.length} source files (${r.index.files} indexed) · ${r.components.stats.candidates} components · ${r.components.stats.entries} entries\n` +
      `#   rpc: ${r.rpc.stats.candidates} candidates, ${r.rpc.stats.appCalled} app-called, ${r.rpc.stats.sqlCalled} sql-called → ${r.rpc.stats.orphans} orphans\n` +
      `#   tables: ${r.tables.stats.candidates} candidates, ${r.tables.stats.appWritten} app-written, ${r.tables.stats.sqlWritten} sql-written, ${r.tables.stats.seeded} seeded → ${r.tables.stats.orphans} orphans\n` +
      `#   notices: ${r.notices.stats.union} union, ${r.notices.stats.emitted} emitted, ${r.notices.stats.enumLabels} enum labels → ${r.notices.stats.orphans} orphans` +
      (r.notices.stats.emittedNotAllowlisted.length ? ` (tray-only, on no allowlist: ${r.notices.stats.emittedNotAllowlisted.join(', ')})` : '') +
      `\n#   components: ${r.components.stats.reachable} reachable → ${r.components.stats.orphans} orphans (${r.components.stats.inert} inert imports, ${r.components.stats.constantGated} behind a constant)\n` +
      `#   silent drops: ${r.drops.stats.calls} Supabase calls in ${r.drops.stats.files} files → ${r.drops.stats.orphans} sites`,
  );
  assert.ok(applied > 500, `expected a full replay, only ${applied} applied`);
  assert.ok(catalog.functions.length > 400, `only ${catalog.functions.length} functions — replay looks partial`);
  assert.ok(catalog.tables.length > 350, `only ${catalog.tables.length} tables — replay looks partial`);
  assert.ok(sources.length > 3000, `only ${sources.length} source files — is WEB really apps/web? (${WEB})`);
  assert.ok(r.rpc.stats.appCalled > 200, `only ${r.rpc.stats.appCalled} functions found called from the app — the literal index has stopped seeing calls`);
  assert.ok(r.rpc.stats.sqlCalled > 150, `only ${r.rpc.stats.sqlCalled} functions found called from SQL — the catalog read is broken`);
  assert.ok(r.tables.stats.appWritten > 250, `only ${r.tables.stats.appWritten} tables found written by the app`);
  assert.ok(r.notices.stats.union > 60, `only ${r.notices.stats.union} NotificationType members parsed — did the union move?`);
  assert.ok(r.notices.stats.emitted > 40, `only ${r.notices.stats.emitted} types found emitted`);
  assert.ok(r.components.stats.candidates > 800, `only ${r.components.stats.candidates} components — has _components/ moved?`);
  assert.ok(r.components.stats.entries > 300, `only ${r.components.stats.entries} Next.js entries — ENTRY_RE has stopped matching`);
  assert.ok(r.drops.stats.calls > 4500, `only ${r.drops.stats.calls} Supabase calls recognised by the scanner`);

  if (process.env.UPDATE_BOTH_ENDS_BASELINE === '1') {
    fs.writeFileSync(
      BASELINE,
      formatBaseline(r.findings, [
        '# EVERY CONNECTION HAS BOTH ENDS — orphans inherited on 2026-09-18, ranked by user impact.',
        '# Read by tests/db/ugat-both-ends.db.test.ts (inside the REQUIRED typecheck + lint check).',
        '# class<TAB>key<TAB>count<TAB>evidence. The evidence column is for the reader; the ratchet compares class+key+count.',
        '#',
        '# This is DEBT, not permission. Green today means "no NEW orphan", not "nothing is orphaned".',
        '# Fix one → the test prints "paid down" → delete the line (or UPDATE_BOTH_ENDS_BASELINE=1 from apps/web).',
        '# Never add a line by hand: join the two ends, or delete the end nobody needs, and say which in the PR.',
        '#',
        '# Classes: rpc-no-caller · table-no-writer · notice-no-emitter · component-no-mount · result-dropped-silently.',
        '# Tiers:   money > booking lifecycle > couple-facing > supplier-facing > admin > unclassified — a keyword sort, not a verdict.',
      ]),
    );
    return;
  }

  assert.ok(fs.existsSync(BASELINE), `${BASELINE} is missing — generate it with UPDATE_BOTH_ENDS_BASELINE=1`);
  const baseline = parseBaseline(fs.readFileSync(BASELINE, 'utf8'));
  assert.ok(baseline.size > 100, `baseline holds only ${baseline.size} lines — was it truncated?`);
  const { grown, paidDown } = diffBaseline(r.findings, baseline);
  assert.deepEqual(
    grown,
    [],
    `\nA connection is missing one of its ends. Both halves may be built; the join is not:\n\n${formatGrown(grown)}\n\n` +
      `rpc-no-caller: call it, or drop the function. table-no-writer: mount the writer, or the table is a wish.\n` +
      `notice-no-emitter: emit it, or remove the type. component-no-mount: mount it from a page, or delete it.\n` +
      `result-dropped-silently: log, throw or return the reason — a bare return hides the failure from everyone.\n` +
      `Do NOT add a line to tests/db/ugat-both-ends.baseline.txt; that file is the debt we inherited.\n`,
  );
  if (paidDown.length) console.log(`# ${paidDown.length} baseline entries are now paid down — delete them:\n#   ${paidDown.join('\n#   ')}`);
});

test('the guard can go red — a synthetic orphan of each DB-side class is NOT silently accepted', async (t) => {
  // Everything above proves the sweep is green today; this proves green means
  // something. The canaries are injected into the INPUTS the way real drift
  // would arrive — a function nobody names, a table nobody writes — and each
  // must surface. The negatives beside them prove the detector is not merely
  // flagging everything.
  const { db } = await createReplayedDb();
  t.after(() => db.close());
  const catalog = await introspect(db);
  const { sources } = readSources();
  const index = indexLiterals(sources);

  const poisoned: Catalog = {
    ...catalog,
    functions: [
      ...catalog.functions,
      { name: 'canary_rpc_nobody_calls', src: 'select 1' },
      { name: 'canary_rpc_policy_calls', src: 'select true' },
      { name: 'canary_trigger_fn_unbound', src: 'begin return new; end', returnsTrigger: true },
      { name: 'canary_writer', src: 'begin insert into public.canary_table_sql_writes(a) values (1); end' },
    ],
    policies: [...catalog.policies, { table: 'events', name: 'canary_policy', qual: 'canary_rpc_policy_calls(id)', withCheck: null }],
    tables: [...catalog.tables, 'canary_table_nobody_writes', 'canary_table_sql_writes', 'canary_table_seeded'],
    rowCounts: { ...catalog.rowCounts, canary_table_seeded: 3 },
  };
  const rpc = findRpcOrphans(poisoned, index).findings.map((f) => f.key);
  assert.ok(rpc.includes('canary_rpc_nobody_calls'), 'a function nothing names must be an orphan');
  assert.ok(rpc.includes('canary_trigger_fn_unbound'), 'a trigger function with no trigger must be an orphan');
  assert.ok(!rpc.includes('canary_rpc_policy_calls'), 'a function an RLS policy calls is NOT an orphan — the TS-grep blind spot');
  assert.ok(!rpc.includes('canary_writer'), 'a function referenced nowhere but writing a table is still an orphan only by name; here it is one — and that is correct');

  const tables = findTableOrphans(poisoned, indexWriters(sources, poisoned)).findings.map((f) => f.key);
  assert.ok(tables.includes('canary_table_nobody_writes'), 'a table nothing writes must be an orphan');
  assert.ok(!tables.includes('canary_table_sql_writes'), 'a table a SQL body writes is NOT an orphan');
  assert.ok(!tables.includes('canary_table_seeded'), 'a table a migration seeded is NOT an orphan');
});

test('every baseline line is well-formed and carries evidence', () => {
  if (!fs.existsSync(BASELINE)) return;
  for (const [key, e] of parseBaseline(fs.readFileSync(BASELINE, 'utf8'))) {
    const [cls, name] = key.split('\t');
    assert.ok(['rpc-no-caller', 'table-no-writer', 'notice-no-emitter', 'component-no-mount', 'result-dropped-silently'].includes(cls ?? ''), `unknown class in "${key}"`);
    assert.ok((name ?? '').length > 0 && e.count >= 1 && e.evidence.length >= 12, `baseline line "${key}" needs a key, a count and real evidence`);
  }
});
