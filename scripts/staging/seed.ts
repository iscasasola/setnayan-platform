#!/usr/bin/env tsx
/**
 * scripts/staging/seed.ts — seed a STAGING copy of Setnayan for the final check. Never production.
 *
 * Owner, 24 Nov 2026: 8 cloud checkers at once on a staging copy (a Supabase preview branch + a Vercel preview with
 * test sign-ins). The controller creates the branch; this script fills it:
 *
 *   1. ⛔ refuses unless STAGING=1, and unless the database, the API and the service key all name ONE Supabase
 *      project that is not production (`stagingTarget`, scripts/staging/seed-core.ts) — or this machine;
 *   2. seals the database (seal.sql): every pg_cron job off, the notify webhook refused if it could reach production;
 *   3. creates the 10 test sign-ins (scripts/staging/accounts.ts) through the Supabase admin API with GENERATED
 *      passwords, so the real `on_auth_user_created` trigger provisions each account as a real sign-up does — and
 *      writes them to scripts/staging/accounts.local.json (git-ignored, owner-only) BEFORE anything else can fail;
 *   4. runs seed.sql (one transaction, the settings preamble first) and prints what it made.
 *
 * The same seal + seed run on every pull request against the replayed schema
 * (apps/web/tests/db/the-staging-seed-runs-clean.db.test.ts), so a migration that would break it is caught there.
 *
 * USAGE (repo root; psql on PATH — macOS: `brew install libpq`):
 *   STAGING=1 \
 *   STAGING_DB_URL='postgresql://postgres.<branch-ref>:<pw>@<pooler-host>:5432/postgres' \
 *   STAGING_SUPABASE_URL='https://<branch-ref>.supabase.co' \
 *   STAGING_SERVICE_ROLE_KEY='<the BRANCH service key>' \
 *   [STAGING_EMAIL_SINK='qa@your-test-inbox.example'  --plus-sink]  [STAGING_COVER_URL='https://…/cover.jpg'] \
 *   pnpm exec tsx scripts/staging/seed.ts [--dry-run]
 *
 *   --dry-run    check the target and print the plan; create nothing, write nothing
 *   --plus-sink  sign-ins become `<sink>+<account>@…` (the test inbox itself) instead of `@final-check.test`
 *
 * No secret is ever printed: URLs are reduced to their project ref, keys are never echoed, and passwords go only
 * into the local file.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGING_ACCOUNTS, accountEmail, accountEmails, plusSinkEmail, type StagingAccountKey } from './accounts';
import { DEFAULT_COVER, SEED_SUMMARY_SQL, seedSettingsSql, stagingTarget } from './seed-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ACCOUNTS_FILE = path.join(HERE, 'accounts.local.json');

function fail(msg: string, code = 1): never {
  console.error(`✖ staging seed: ${msg}`);
  process.exit(code);
}

/** Remove anything shaped like a connection string or a key from a message before it is printed. */
function scrub(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '<db-url>')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<jwt>')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '<secret-key>');
}

function psql(dbUrl: string, args: string[], what: string): string {
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', dbUrl, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? '20' },
  });
  if (r.error) fail((r.error as NodeJS.ErrnoException).code === 'ENOENT' ? 'psql is not installed (macOS: brew install libpq, then add its bin to PATH)' : scrub(r.error.message));
  if (r.status !== 0) fail(`${what} failed:\n${scrub((r.stderr || r.stdout || '').trim())}`);
  if (r.stderr.trim()) process.stderr.write(scrub(r.stderr));
  return r.stdout;
}

async function createAccount(api: string, serviceKey: string, email: string, password: string, fullName: string): Promise<void> {
  const res = await fetch(new URL('/auth/v1/admin/users', api), {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  if (!res.ok) {
    const body = scrub(await res.text()).slice(0, 300);
    fail(`the auth server refused to create ${email} (${res.status}: ${body}). If it already exists, this branch was seeded before — reset the branch to seed again.`);
  }
}

async function main(): Promise<void> {
  const argv = new Set(process.argv.slice(2));
  const dryRun = argv.has('--dry-run');
  const dbUrl = process.env.STAGING_DB_URL ?? '';
  const apiUrl = process.env.STAGING_SUPABASE_URL ?? '';
  const serviceKey = process.env.STAGING_SERVICE_ROLE_KEY ?? '';
  if (!dbUrl || !apiUrl || !serviceKey) fail('STAGING_DB_URL, STAGING_SUPABASE_URL and STAGING_SERVICE_ROLE_KEY are all required', 2);

  // ⛔ 1 · THE TARGET
  const target = stagingTarget({ staging: process.env.STAGING, dbUrl, apiUrl, serviceKey });
  if (!target.ok) fail(`REFUSED — ${target.why}. Nothing was run.`, 2);
  console.log(`✔ target: ${target.local ? 'this machine' : `Supabase project ${target.ref}`} (not production)`);

  const sink = (process.env.STAGING_EMAIL_SINK ?? '').trim();
  if (argv.has('--plus-sink') && !sink) fail('--plus-sink needs STAGING_EMAIL_SINK', 2);
  const emails = accountEmails((k: StagingAccountKey) => (argv.has('--plus-sink') ? plusSinkEmail(k, sink) : accountEmail(k)));
  const cover = (process.env.STAGING_COVER_URL ?? '').trim() || DEFAULT_COVER;
  if (cover !== DEFAULT_COVER && !/^https:\/\/[^\s]+$/.test(cover)) fail('STAGING_COVER_URL must be one https URL', 2);

  if (dryRun) {
    console.log('— dry run: nothing created, nothing written —');
    for (const a of STAGING_ACCOUNTS) console.log(`  would create  ${emails[a.key].padEnd(44)}  area ${a.area ?? 'all'} · ${a.role}`);
    console.log(`  would seal the database, then run seed.sql (cover: ${cover === DEFAULT_COVER ? 'the repo placeholder' : 'STAGING_COVER_URL'})`);
    return;
  }
  if (fs.existsSync(ACCOUNTS_FILE)) fail(`${path.relative(process.cwd(), ACCOUNTS_FILE)} already exists — move it away first (it holds the last run's passwords)`, 2);

  // 2 · THE SEAL — before any row is written
  psql(dbUrl, ['-f', path.join(HERE, 'seal.sql')], 'sealing the database');
  console.log('✔ sealed: pg_cron off, the notify webhook cannot reach production');

  // 3 · THE ACCOUNTS — passwords on disk first, then the sign-ins
  const accounts = STAGING_ACCOUNTS.map((a) => ({ ...a, email: emails[a.key], password: randomBytes(18).toString('base64url') }));
  const file = {
    note: 'STAGING TEST SIGN-INS — never commit this file. Hand each checker only their own row.',
    generated_at: new Date().toISOString(),
    target: { project_ref: target.ref, api_url: apiUrl },
    accounts: accounts.map(({ key, area, role, email, password }) => ({ key, area, role, email, password })),
  };
  fs.writeFileSync(ACCOUNTS_FILE, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  for (const a of accounts) await createAccount(apiUrl, serviceKey, a.email, a.password, a.fullName);
  console.log(`✔ ${accounts.length} sign-ins created; passwords in ${path.relative(process.cwd(), ACCOUNTS_FILE)} (mode 600)`);

  // 4 · THE SEED — one transaction, settings first
  const settings = seedSettingsSql({ accounts: emails, cover });
  psql(dbUrl, ['-1', '-c', settings, '-f', path.join(HERE, 'seed.sql')], 'seed.sql');
  const out = psql(dbUrl, ['-A', '-t', '-c', SEED_SUMMARY_SQL], 'the summary');
  const line = out.split('\n').map((l) => l.trim()).find((l) => l.startsWith('{'));
  if (!line) fail('the summary returned nothing');
  const summary = JSON.parse(line) as { counts: Record<string, number>; events: unknown[]; guest_links: unknown[] };
  fs.writeFileSync(ACCOUNTS_FILE, `${JSON.stringify({ ...file, ...summary }, null, 2)}\n`, { mode: 0o600 });
  console.log('✔ seeded:', JSON.stringify(summary.counts));
  console.log('  next: hand each checker their own row of the file — build-sessions/FINAL-CHECK-KIT.md, step 6');
}

main().catch((e: unknown) => fail(scrub(e instanceof Error ? e.message : String(e))));
