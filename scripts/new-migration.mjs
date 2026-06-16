#!/usr/bin/env node
// Allocate a new Supabase migration with a collision-free, monotonic timestamp.
//
// Why this exists: migration filenames are `<14-digit-prefix>_<slug>.sql` and
// are applied in prefix sort order. Prefixes were hand-typed as YYYYMMDD000000,
// which (a) drift ahead of wall-clock and (b) collide when two people pick the
// same date. A duplicate prefix is the primary key in
// `supabase_migrations.schema_migrations`, so `supabase db push` crashes *after*
// one migration's DDL ran — prod ends up half-applied. The CI "migration
// timestamp guard" then blocks every open PR until it's fixed. This has bitten
// the repo 4×. This allocator hands out a prefix guaranteed to be unique vs all
// existing migrations AND to sort strictly after them, then writes an idempotent
// stub.
//
// Usage:  pnpm migration:new "add reception design column"
//   -> supabase/migrations/<prefix>_add_reception_design_column.sql

import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

const rawName = process.argv.slice(2).join(' ').trim();
if (!rawName) {
  console.error('✗ Provide a migration name, e.g.  pnpm migration:new "add foo column"');
  process.exit(1);
}

const slug = rawName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 80)
  .replace(/_+$/g, '');
if (!slug) {
  console.error('✗ Migration name must contain at least one letter or digit.');
  process.exit(1);
}

if (!existsSync(migrationsDir)) mkdirSync(migrationsDir, { recursive: true });

// Collect every 14-digit prefix we can see — local disk AND origin/main — so a
// migration that's been merged but not pulled still pushes our allocation past
// it (the load-bearing cross-branch gap). Best-effort: refresh origin/main
// first; offline / no-remote just uses what's already on disk.
const prefixSet = new Set();
const addPrefix = (name) => {
  const m = /^(\d{14})_/.exec(name);
  if (m) prefixSet.add(m[1]);
};
readdirSync(migrationsDir).forEach(addPrefix);
try {
  execSync('git fetch --quiet origin main', { stdio: 'ignore', timeout: 15000 });
} catch {
  /* offline / no remote — fall back to local view */
}
try {
  execSync('git ls-tree -r --name-only origin/main -- supabase/migrations', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .split('\n')
    .forEach((p) => addPrefix(p.replace(/.*\//, '')));
} catch {
  /* no origin/main ref locally — fine */
}

const maxExisting = [...prefixSet].reduce((a, b) => (BigInt(b) > a ? BigInt(b) : a), 0n);

// Real UTC datetime as a 14-digit integer (YYYYMMDDHHMMSS).
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const nowInt = BigInt(
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`,
);

// Sort strictly after everything known. Once wall-clock overtakes the drifted
// prefixes the real datetime wins (sub-second resolution); until then we
// sequence past the max. The random nudge spreads two people who allocate
// against the SAME main into different slots; the loop then GUARANTEES the
// prefix is unused by any migration we can see (local ∪ origin/main).
//
// Entropy is 1e6 (was 1e3): the only collision the visibility loop can't catch
// is two people allocating against the same main in the same instant — neither
// sees the other's file yet — so they must roll different nudges. 1e6 makes that
// ~1-in-a-million instead of 1-in-a-thousand.
//
// The `% 1_000_000n !== 0n` floor GUARANTEES the allocator never emits a
// `YYYYMMDD000000` round prefix. That's load-bearing: the hand-typed-prefix
// guard (scripts/check-migration-timestamps.mjs) rejects exactly those round
// prefixes on new migrations, so the allocator must never produce one itself.
const base = nowInt > maxExisting ? nowInt : maxExisting + 1n;
let candidate = base + BigInt(Math.floor(Math.random() * 1_000_000));
while (
  prefixSet.has(candidate.toString().padStart(14, '0')) ||
  candidate % 1_000_000n === 0n
) {
  candidate += 1n;
}
const prefix = candidate.toString().padStart(14, '0');

const file = join(migrationsDir, `${prefix}_${slug}.sql`);
if (existsSync(file)) {
  console.error(`✗ ${file} already exists — re-run to get a fresh timestamp.`);
  process.exit(1);
}

const stub = `-- ${rawName}
-- Created via \`pnpm migration:new\`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

`;

writeFileSync(file, stub);
console.log(`✓ Created supabase/migrations/${prefix}_${slug}.sql`);
if (nowInt <= maxExisting) {
  console.log(`  (sequenced after the latest known migration ${maxExisting} — wall-clock hasn't caught up to the prefixes yet)`);
}
console.log('  Unique against your local tree + origin/main. If a teammate is mid-flight with');
console.log('  their own brand-new migration RIGHT NOW, the CI guard is the final backstop.');
console.log('  Edit it (keep it idempotent), then apply with:');
console.log('    supabase db push --db-url "$SUPABASE_DB_URL"');
