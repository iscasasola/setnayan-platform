#!/usr/bin/env tsx
/**
 * scripts/staging/apply-migrations.ts — finish the migrations on the final-check STAGING branch. Never production.
 *
 * A Supabase preview branch applies `supabase/migrations` in strict version order and stops at the first back-numbered
 * file (measured 25 Nov 2026: 116 applied, then `20260530010000` needs a table `20260631000000` creates). This applies
 * every file the branch's ledger does not hold, in the order the repo's replay proves on every pull request — the
 * ONE ordering engine, `replayInFilenameOrder` (apps/web/tests/db/migration-order.ts). Everything else (the ledger,
 * per-file transactions, bare files, the report) is in ./apply-migrations-core.ts and is explained there.
 *
 *   1. ⛔ refuses unless STAGING=1, and refuses any URL that contains production's ref or names no non-production
 *      Supabase project (`applyTarget`) — before a connection is opened, before the database driver is even loaded;
 *   2. --dry-run: opens ONE read-only transaction, reads the ledger, prints the target ref and the plan (how many to
 *      apply, the out-of-order landings to expect, the known skips), rolls back. Writes nothing;
 *   3. otherwise applies, printing progress, then the report: applied · still failing (with the error) · skipped per
 *      ALLOWED_SKIP · out of order. Exit 0 clean · 1 files still failing · 2 refused · 3 something landed where the
 *      replay does not · 4 the run stopped (connection lost) — run it again, it resumes from the ledger.
 *
 * USAGE (repo root, after `pnpm install`; no psql needed):
 *   STAGING=1 STAGING_DB_URL='postgresql://postgres.<branch-ref>:<pw>@<pooler-host>:5432/postgres' \
 *   pnpm exec tsx scripts/staging/apply-migrations.ts --dry-run
 *
 * The URL is the BRANCH's (session pooler, port 5432, or the direct connection). It is never printed: only its
 * project ref is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR } from '../../apps/web/tests/db/migration-order';
import { scrub as scrubDb } from '../lib/read-only-db.mjs';
import {
  applyPendingMigrations,
  applyTarget,
  exitCodeFor,
  formatPlan,
  formatReport,
  readPlan,
  StopRun,
  type SqlClient,
} from './apply-migrations-core';

function scrub(text: string): string {
  const url = process.env.STAGING_DB_URL ?? '';
  return scrubDb(url ? text.split(url).join('<STAGING_DB_URL>') : text);
}

function fail(msg: string, code = 1): never {
  console.error(`✖ apply-migrations: ${scrub(msg)}`);
  process.exit(code);
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  const dbUrl = process.env.STAGING_DB_URL ?? '';

  // ⛔ 1 · THE TARGET — nothing is loaded or opened before this passes.
  const target = applyTarget({ staging: process.env.STAGING, dbUrl });
  if (!target.ok) fail(`REFUSED — ${target.why}. Nothing was run.`, 2);
  console.log(`✔ target: ${target.local ? 'this machine' : `Supabase project ${target.ref}`} (not production)`);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const readFile = (f: string) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');

  // TLS is set below, not by the URL: node-postgres treats `sslmode=require` as verify-full, which a pooler URL
  // copied with `?sslmode=require` would fail on. The connection is still encrypted.
  const conn = new URL(dbUrl);
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) conn.searchParams.delete(k);

  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: conn.toString(),
    application_name: 'setnayan-staging-apply-migrations',
    connectionTimeoutMillis: 20_000,
    // Supabase requires TLS; a local stack (this machine) does not offer it.
    ssl: target.local ? undefined : { rejectUnauthorized: false },
  });
  client.on('error', () => {
    /* a dropped connection surfaces on the next query as a StopRun; never crash the process from here */
  });
  await client.connect();
  const sql: SqlClient = { query: (text, params) => client.query(text, params) };

  try {
    if (dryRun) {
      const { plan, ownerPresent } = await readPlan(sql, files);
      console.log('— dry run: one read-only transaction, rolled back; nothing written —');
      console.log(formatPlan(plan, ownerPresent));
      console.log(plan.pending.length ? '  next: the same command without --dry-run' : '  nothing to apply');
      return;
    }

    const started = Date.now();
    const report = await applyPendingMigrations({
      client: sql,
      files,
      readFile,
      onEvent: (e) => {
        if (e.kind === 'applied' && (e.count % 100 === 0 || e.count === e.of)) console.log(`  … applied ${e.count}/${e.of}`);
        if (e.kind === 'deferred') console.log(`  ↷ deferred ${e.file} — ${scrub(e.error)}`);
        if (e.kind === 'bare') console.log(`  ⚙ ${e.file} cannot run in a transaction (${e.code}) — running it statement by statement`);
        if (e.kind === 'retry-in-place') console.log(`  ⟳ ${e.file} hit ${e.code}, trying again in place (${e.attempt})`);
      },
    });
    console.log(`— done in ${Math.round((Date.now() - started) / 1000)} s —`);
    console.log(scrub(formatReport(report)));
    const code = exitCodeFor(report);
    if (code === 0) console.log('✔ every migration is applied. Next: check list_migrations on the BRANCH, then copy-catalog (FINAL-CHECK-KIT § 2 step 3).');
    process.exitCode = code;
  } catch (e) {
    if (e instanceof StopRun) {
      fail(`${e.message}\n  The ledger holds every file applied before it — run the same command again to resume.`, 4);
    }
    throw e;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
