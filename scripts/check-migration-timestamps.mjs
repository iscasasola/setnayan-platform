#!/usr/bin/env node
// Migration-prefix guard — the single source of truth for BOTH rules, run by
// the CI "migration timestamp guard" job, the .githooks/pre-push hook, and
// `pnpm migration:check`. Exit 0 = clean, 1 = violation.
//
//   RULE 1 — UNIQUE: no two migration files share a 14-digit prefix. A duplicate
//     is the PK in supabase_migrations.schema_migrations, so `supabase db push`
//     crashes AFTER one migration's DDL ran — prod ends up half-applied.
//
//   RULE 2 — ALLOCATED: a NEW migration (one not yet on origin/main) must NOT use
//     a hand-typed `YYYYMMDD000000` round prefix. Hand-typed prefixes are how the
//     dup-collisions actually happen — two parallel branches independently pick
//     the same round date, each passes CI alone, then collide on merge (the repo
//     has hit this repeatedly; a 2026-06-17 session hit it TWICE in one sitting,
//     each needing manual ledger surgery). The allocator (`pnpm migration:new`)
//     hands out a collision-resistant, never-round prefix; this rule forces it
//     for new work. Existing migrations are grandfathered (they're on main).
//
// Pure rule functions are exported for unit tests; the CLI runs only when this
// file is executed directly (so importing it in a test has no side effects).

import { readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Prefixes shared by 2+ migration files (RULE 1 violations). */
export function duplicatePrefixes(filenames) {
  const counts = new Map();
  for (const f of filenames) {
    const p = /^(\d{14})_/.exec(f)?.[1];
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([p]) => p)
    .sort();
}

/** A 14-digit prefix is "hand-typed round" iff its last 6 digits are all zero. */
export function isHandTypedRoundPrefix(prefix) {
  return /^\d{8}000000$/.test(prefix);
}

/**
 * New migrations (basename present locally, ABSENT from main) that use a
 * hand-typed round prefix (RULE 2 violations). `mainFilenames` null/empty just
 * means "can't tell what's new" → caller skips the rule.
 */
export function handTypedNewMigrations(localFilenames, mainFilenames) {
  const mainSet = new Set(mainFilenames ?? []);
  const out = [];
  for (const f of localFilenames) {
    const p = /^(\d{14})_/.exec(f)?.[1];
    if (!p || mainSet.has(f)) continue; // unparsable, or grandfathered on main
    if (isHandTypedRoundPrefix(p)) out.push({ file: f, prefix: p });
  }
  return out;
}

/** Migration basenames on origin/main, or null if that ref can't be read. */
function migrationBasenamesOnOriginMain() {
  // Best-effort: a checkout without an origin/main ref (offline dev, a CI step
  // that didn't fetch it) returns null → RULE 2 is skipped, RULE 1 still runs.
  for (const ref of ['origin/main', 'FETCH_HEAD']) {
    try {
      return execSync(`git ls-tree -r --name-only ${ref} -- supabase/migrations`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .split('\n')
        .map((p) => p.replace(/.*\//, ''))
        .filter(Boolean);
    } catch {
      /* try the next ref */
    }
  }
  return null;
}

function main() {
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'supabase',
    'migrations',
  );
  if (!existsSync(migrationsDir)) {
    console.log('✓ No supabase/migrations directory — nothing to check.');
    process.exit(0);
  }
  const files = readdirSync(migrationsDir).filter((f) => /^\d{14}_/.test(f));

  const dups = duplicatePrefixes(files);
  const mainNames = migrationBasenamesOnOriginMain();
  // CRITICAL: with no origin/main ref we CAN'T tell a new migration from a
  // grandfathered one, so SKIP rule 2 entirely — otherwise every existing
  // round-prefix migration would be flagged. RULE 1 always runs.
  const handTyped = mainNames === null ? [] : handTypedNewMigrations(files, mainNames);

  let ok = true;

  if (dups.length > 0) {
    ok = false;
    console.error('✗ RULE 1 — duplicate Supabase migration timestamp prefix(es):');
    for (const p of dups) {
      console.error(`    ${p}:`);
      for (const f of files.filter((f) => f.startsWith(`${p}_`)).sort()) {
        console.error(`      - supabase/migrations/${f}`);
      }
    }
    console.error(
      '  A duplicate prefix half-applies prod on `supabase db push` and blocks every PR.',
    );
    console.error('  Fix: give one a fresh prefix → `pnpm migration:new "<name>"`.\n');
  }

  if (handTyped.length > 0) {
    ok = false;
    console.error('✗ RULE 2 — hand-typed round prefix on new migration(s):');
    for (const { file } of handTyped) console.error(`      - supabase/migrations/${file}`);
    console.error(
      '  A `YYYYMMDD000000` prefix is hand-typed — these collide across parallel branches',
    );
    console.error(
      '  (the dup-collision root cause). Let the allocator hand out a safe, never-round',
    );
    console.error('  prefix, then move your SQL into the file it creates:');
    console.error('    pnpm migration:new "<name>"\n');
  }

  if (ok) {
    const note =
      mainNames === null ? ' (RULE 2 skipped — origin/main ref unavailable)' : '';
    console.log(
      `✓ ${files.length} migrations: unique prefixes + allocator-sourced${note}.`,
    );
    process.exit(0);
  }
  process.exit(1);
}

// CLI only when invoked directly — importing this module (e.g. from a test) is
// side-effect-free.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
