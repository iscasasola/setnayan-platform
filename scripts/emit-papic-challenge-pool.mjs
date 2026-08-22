#!/usr/bin/env node
/**
 * CLI over `apps/web/lib/papic-challenge-sql.ts` — print the generated
 * `papic_challenge_library` seed, or check a migration still matches it.
 *
 *   node --import tsx scripts/emit-papic-challenge-pool.mjs
 *   node --import tsx scripts/emit-papic-challenge-pool.mjs --check <migration.sql>
 *
 * ⚠ THIS IS FOR HUMANS. The GUARD is `apps/web/lib/papic-challenge-pool.test.ts`,
 * which runs in the unit suite. It lived here as a `ci.yml` step first and could
 * not run at all: `tsx` is a devDependency of `apps/web`, not of the repo root,
 * so `node --import tsx` from the root died with ERR_MODULE_NOT_FOUND on every
 * PR. All three ci.yml edits were correct; the runtime was not there.
 * 🔑 A guard that cannot execute is worse than no guard — it fails loudly for a
 * reason unrelated to what it guards, and teaches you to look past it.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { emitChallengeSeedSql } = await import(
  pathToFileURL(resolve(repoRoot, 'apps/web/lib/papic-challenge-sql.ts')).href
);

const { sql, count } = emitChallengeSeedSql();
const checkIdx = process.argv.indexOf('--check');

if (checkIdx === -1) {
  process.stdout.write(sql);
} else {
  const target = process.argv[checkIdx + 1];
  if (!target) {
    console.error('--check needs a migration path');
    process.exit(2);
  }
  const committed = readFileSync(resolve(repoRoot, target), 'utf8');
  if (!committed.includes(sql.trim())) {
    console.error(
      `✗ ${target} does not contain the current generated pool.\n` +
        `  Regenerate it: node --import tsx scripts/emit-papic-challenge-pool.mjs`,
    );
    process.exit(1);
  }
  console.log(`✓ ${target} matches the pool (${count} challenges)`);
}
