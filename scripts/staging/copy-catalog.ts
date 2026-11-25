#!/usr/bin/env tsx
/**
 * scripts/staging/copy-catalog.ts — copy production's NON-PERSONAL admin tables onto a staging copy. Read-only on
 * production, always.
 *
 * Production's price sheet, switches and vocabulary (the tables in copy-catalog-core.ts `COPY_TABLES`, each with its
 * reason) are read through scripts/lib/read-only-db.mjs — the repo's one read-only door to the live catalogue, also
 * used by print-prices.mjs — which makes a write impossible three ways over: it refuses any SQL that is not a single
 * SELECT, wraps it in `begin transaction read only … rollback`, and opens the session with
 * `default_transaction_read_only=on`. This file sends production nothing else.
 *
 * The staging side is guarded like the seed (`stagingTarget`: STAGING=1 and a non-production project), and the
 * whole copy lands in ONE transaction there: every table or none.
 *
 * USAGE (repo root; psql on PATH). Run it BEFORE the seed, so the seed's orders carry production's prices:
 *   STAGING=1 \
 *   PROD_READ_DB_URL='<a read-only connection to production>' \
 *   STAGING_DB_URL='postgresql://postgres.<branch-ref>:<pw>@<pooler-host>:5432/postgres' \
 *   pnpm exec tsx scripts/staging/copy-catalog.ts [--dry-run]
 *
 *   --dry-run   read production and the staging metadata, print what WOULD land; write nothing anywhere
 */
import { spawnSync } from 'node:child_process';
import { readRows, scrub as scrubDb } from '../lib/read-only-db.mjs';
import { COPY_TABLES, buildUpsertSql, metaSql, refusalFor, type TableMeta } from './copy-catalog-core';
import { stagingTarget, supabaseRefOf } from './seed-core';

function fail(msg: string, code = 1): never {
  console.error(`✖ copy-catalog: ${msg}`);
  process.exit(code);
}

/** psql against the STAGING copy only (the production side never comes through here). */
function stagingPsql(dbUrl: string, args: string[], input: string | undefined, what: string): string {
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', dbUrl, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? '20' },
  });
  if (r.error) fail((r.error as NodeJS.ErrnoException).code === 'ENOENT' ? 'psql is not installed (macOS: brew install libpq)' : scrubDb(r.error.message));
  if (r.status !== 0) fail(`${what} failed: ${scrubDb((r.stderr || r.stdout || '').trim()).slice(-1200)}`);
  return r.stdout;
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const prodUrl = process.env.PROD_READ_DB_URL ?? '';
  const stagingUrl = process.env.STAGING_DB_URL ?? '';
  if (!prodUrl || !stagingUrl) fail('PROD_READ_DB_URL and STAGING_DB_URL are both required', 2);

  // ⛔ The WRITE side must be a staging copy …
  const target = stagingTarget({ staging: process.env.STAGING, dbUrl: stagingUrl });
  if (!target.ok) fail(`REFUSED — ${target.why}. Nothing was read or written.`, 2);
  // … and the READ side must be somewhere else (copying a database onto itself is a mistake, not a copy).
  const sourceRef = supabaseRefOf(prodUrl);
  if (sourceRef && sourceRef === target.ref) fail('REFUSED — the source and the target are the same project', 2);
  console.log(`✔ read from: ${sourceRef ? `project ${sourceRef}` : 'the given read URL'} (SELECT only)  →  write to: ${target.local ? 'this machine' : `staging project ${target.ref}`}`);

  // 1 · The staging side's own shape (a read).
  const metaOut = stagingPsql(stagingUrl, ['-A', '-t', '-c', metaSql(COPY_TABLES.map((t) => t.table))], undefined, 'reading the staging schema');
  const metaLine = metaOut.split('\n').map((l) => l.trim()).find((l) => l.startsWith('['));
  const metas = new Map<string, TableMeta>((JSON.parse(metaLine ?? '[]') as TableMeta[]).map((m) => [m.table, m]));

  // 2 · Production, read-only, table by table.
  const statements: string[] = [];
  const report: string[] = [];
  const readEnv = { PATH: process.env.PATH, HOME: process.env.HOME, PRICES_DB_URL: prodUrl } as NodeJS.ProcessEnv;
  for (const spec of COPY_TABLES) {
    const refusal = refusalFor(metas.get(spec.table), spec);
    if (refusal) fail(`REFUSED — ${refusal}. Nothing was written.`);
    const read = readRows(`SELECT * FROM public.${spec.table}`, { env: readEnv });
    if (!read.ok) fail(`reading production's ${spec.table}: ${read.reason}`);
    const sql = buildUpsertSql(spec, metas.get(spec.table)!, read.rows);
    if (sql) statements.push(sql);
    report.push(`  ${spec.table.padEnd(28)} ${String(read.rows.length).padStart(5)} rows   ${spec.why}`);
  }
  console.log(report.join('\n'));

  if (dryRun) {
    console.log('— dry run: nothing written —');
    return;
  }
  // 3 · The staging copy, ONE transaction: every table or none.
  stagingPsql(stagingUrl, ['-1', '-f', '-'], statements.join('\n\n'), 'writing the staging copy');
  console.log(`✔ copied ${statements.length} tables onto the staging copy (one transaction)`);
}

main();
