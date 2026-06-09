#!/usr/bin/env node
// Mirror of the CI "migration timestamp guard" (.github/workflows/ci.yml): fail
// if two migrations share a 14-digit timestamp prefix. Exposed as
// `pnpm migration:check` for a friendly manual run; the pre-push hook enforces
// the same rule (in pure sh) so a collision is caught locally, before it reaches
// a PR where it blocks every open PR's merge. Exit 0 = clean, 1 = duplicate.

import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
if (!existsSync(migrationsDir)) {
  console.log('✓ No supabase/migrations directory — nothing to check.');
  process.exit(0);
}

const files = readdirSync(migrationsDir);
const prefixes = files.map((f) => /^(\d{14})_/.exec(f)?.[1]).filter(Boolean);

const counts = new Map();
for (const p of prefixes) counts.set(p, (counts.get(p) ?? 0) + 1);
const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p).sort();

if (dups.length === 0) {
  console.log(`✓ All ${prefixes.length} migrations have unique 14-digit timestamp prefixes.`);
  process.exit(0);
}

console.error('✗ Duplicate Supabase migration timestamp prefix(es) found:');
for (const p of dups) {
  console.error(`    ${p}:`);
  for (const f of files.filter((f) => f.startsWith(`${p}_`)).sort()) {
    console.error(`      - supabase/migrations/${f}`);
  }
}
console.error('');
console.error('  A duplicate prefix half-applies prod on `supabase db push` and blocks every PR.');
console.error('  Fix: rename one to a fresh prefix — `pnpm migration:new "<name>"` —');
console.error('  or bump the later/dependent one to <prefix>+1, then re-run `pnpm migration:check`.');
process.exit(1);
