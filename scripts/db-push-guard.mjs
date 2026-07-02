#!/usr/bin/env node
// Safe wrapper around `supabase db push`. Refuses to apply a migration to prod
// that is NOT on origin/main AND NOT already in the ledger — i.e. an UNMERGED,
// UNAPPLIED migration. Pushing one of those is exactly how the pipeline-jamming
// orphans are born (a local `db push` from a feature worktree applies that
// branch's not-yet-merged migration to prod; its ledger row then has no file on
// main → `db push` refuses for everyone → later migrations silently strand).
//
// Since CI auto-applies every migration on merge (supabase-migrations.yml), you
// almost never need to push locally. When you do (e.g. unjamming, or CI is
// down), this makes it safe: it only proceeds when every to-be-applied migration
// is already merged — the same set CI would apply. For pre-merge VERIFICATION,
// don't push at all: run the migration in a rolled-back transaction (see
// supabase/migrations/README.md).
//
// Usage:  pnpm db:push [-- extra supabase flags]
//   Connection: $SUPABASE_DB_URL (required).
//   Any args after the script are passed through to `supabase db push`.

import { readdirSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^(\d{14})_.+\.sql$/;
const versionOf = (f) => VERSION_RE.exec(f.replace(/.*\//, ''))?.[1] ?? null;

function shSafe(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).toString().trim();
  } catch {
    return '';
  }
}

const dbUrl = process.env.SUPABASE_DB_URL || '';
if (!dbUrl) {
  console.error('✗ $SUPABASE_DB_URL is not set — cannot verify or apply. Aborting.');
  process.exit(2);
}

// Local migration versions (working tree).
const localVersions = readdirSync(join(repoRoot, 'supabase', 'migrations'))
  .map(versionOf)
  .filter(Boolean);

// origin/main versions (what's merged).
shSafe('git fetch --quiet origin main');
const mainVersions = new Set(
  shSafe('git ls-tree -r --name-only origin/main -- supabase/migrations')
    .split('\n')
    .map(versionOf)
    .filter(Boolean),
);

// Ledger versions (what's already applied to prod).
let ledgerVersions = new Set();
try {
  const raw = execSync(
    `supabase db query --db-url ${JSON.stringify(dbUrl)} -o json ` +
      JSON.stringify('select version from supabase_migrations.schema_migrations'),
    { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, env: { ...process.env, DO_NOT_TRACK: '1' } },
  ).toString();
  const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
  ledgerVersions = new Set((parsed.rows || []).map((r) => String(r.version)));
} catch (e) {
  console.error('✗ Could not read the prod ledger to verify safety. Aborting.');
  console.error(String(e.stderr || e.message || e).split('\n').slice(-2).join('\n'));
  process.exit(2);
}

// The danger set: local files that WOULD be applied (not in ledger) but are NOT
// merged (not on origin/main). Applying any of these creates an orphan.
const unmergedUnapplied = localVersions
  .filter((v) => !ledgerVersions.has(v) && !mainVersions.has(v))
  .sort();

if (unmergedUnapplied.length) {
  console.error('\n✗ db:push blocked — these local migrations are UNMERGED and UNAPPLIED:');
  for (const v of unmergedUnapplied) console.error(`    • ${v}`);
  console.error('\n  Pushing them would apply them to prod AHEAD of merge → they become orphans');
  console.error('  (ledger row, no file on main) that JAM `db push` for every branch.');
  console.error('\n  Do this instead:');
  console.error('    • Merge the migration — CI (supabase-migrations.yml) auto-applies it on merge.');
  console.error('    • Just verifying? Run it in a rolled-back transaction (supabase/migrations/README.md),');
  console.error('      don\'t push to prod.');
  console.error('    • Genuinely need to apply from here? Only from a clean, up-to-date main worktree.\n');
  process.exit(1);
}

// Safe: every to-be-applied migration is already merged. Proceed.
const passthrough = process.argv.slice(2);
const pending = localVersions.filter((v) => !ledgerVersions.has(v));
console.log(
  pending.length
    ? `✓ Safe to push — ${pending.length} pending migration(s), all merged to main. Applying…\n`
    : '✓ Nothing pending — ledger is up to date. (Running push as a no-op verify.)\n',
);

const res = spawnSync(
  'supabase',
  ['db', 'push', '--db-url', dbUrl, ...passthrough],
  { stdio: 'inherit', env: { ...process.env, DO_NOT_TRACK: '1' } },
);
process.exit(res.status ?? 1);
