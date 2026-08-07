#!/usr/bin/env node
/**
 * lint-migrations-dir.mjs
 *
 * Fails when a `supabase/migrations/` directory exists ANYWHERE in the repo
 * other than the one at the repo root. Migrations have exactly one home —
 * `<repoRoot>/supabase/migrations/` — because that is the only directory
 * `supabase db push` reads.
 *
 * WHY THIS GUARD EXISTS (2026-08-07 · one live feature broken for weeks):
 * An orphan `apps/supabase/migrations/` held two files. One of them,
 * `20270115000000_kwento_voice_depth.sql`, added `photo_messages.voice_depth`
 * and was never applied — `db push` has never looked in that directory and
 * never will. The matching application code shipped in the same commit and DID
 * go live, so the route began sending an RPC argument (`p_voice_depth`) that the
 * production function did not accept.
 *
 * PostgREST resolves an RPC by its exact set of NAMED arguments, so one unknown
 * name means NO candidate matches. Every guest who wrote a message on a photo
 * got a generic `save_failed`. Nothing threw in our code, nothing was logged as
 * a schema problem, and CI stayed green throughout — CI never calls the live
 * database. Both halves of the change looked done.
 *
 * 🔑 THE FAILURE MODE IS SILENCE, IN BOTH DIRECTIONS. A migration in the wrong
 * directory does not error; it simply never runs. And it looks *exactly* like a
 * healthy pending migration sitting in the tree — which is worse than missing,
 * because a reader counts it as done. Two of that orphan dir's columns were
 * quietly rescued a year later by a migration literally named
 * `reconcile_columns_the_code_already_uses.sql`; `voice_depth` was missed by
 * that sweep and stayed broken.
 *
 * This is the same shape as the orphan `changelog.d/` directories that stranded
 * 172 fragments before 2026-07-25 — see the sibling guard
 * `lint-changelog-dir.mjs`, whose reasoning applies here almost word for word.
 * The trap is identical: `apps/web` is where nearly all the code lives, so an
 * author or agent resolving a relative `supabase/migrations/<file>.sql` against
 * its own cwd creates the orphan directory on the way past, with no feedback.
 *
 * Why a guard and not a doc fix: the repo `CLAUDE.md` already documents
 * `supabase/migrations/` and `pnpm migration:new` as the way to add one, the
 * whole time that file sat unapplied. Documentation cannot catch a mistake whose
 * only symptom is silence — a check that fails loudly can.
 *
 * HOW IT CHECKS — a bounded filesystem walk:
 *   1. Resolve the repo root (this file is at apps/web/scripts/, so ../../..).
 *   2. Walk the tree, skipping heavy/generated dirs that can never hold a
 *      hand-written migration.
 *   3. Report every `supabase/migrations/` found that is not the root one, with
 *      the count of `.sql` files stranded inside it.
 *
 * ⚠ It matches on the PARENT being named `supabase`, not on the directory name
 * `migrations` alone. Plenty of unrelated tooling has a `migrations/` folder,
 * and a guard that cries wolf teaches you to skim past the one time it is right.
 *
 * The walk is filesystem-based, not `git ls-files`, so it also catches an orphan
 * created but not yet committed — it fails locally, before the migration is
 * pushed to a branch where it would be silently ignored.
 *
 * Usage:
 *   node apps/web/scripts/lint-migrations-dir.mjs
 *   pnpm --filter web lint:migrations-dir
 */

import { readdirSync } from 'node:fs';
import { join, resolve, dirname, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/web/scripts → apps/web → apps → <repoRoot>
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const CANONICAL = join(REPO_ROOT, 'supabase', 'migrations');

/** Directories that can never contain a hand-written migration. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'out',
  'coverage',
  'target', // src-tauri/target
  'playwright-report',
  'test-results',
  'Pods',
]);

/** Collect every `<something>/supabase/migrations` directory under `dir`. */
function findMigrationDirs(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found; // unreadable dir — nothing to assert
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    // Only a `migrations` dir whose PARENT is `supabase` counts. Unrelated
    // tooling keeps its own `migrations/` folders and they are not our concern.
    if (name === 'migrations' && basename(dir) === 'supabase') {
      found.push(full);
      continue; // migration files are flat — no need to descend
    }
    findMigrationDirs(full, found);
  }
  return found;
}

/** Count `.sql` files sitting in a directory. */
function countSql(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.sql')).length;
  } catch {
    return 0;
  }
}

const offenders = findMigrationDirs(REPO_ROOT)
  .filter((d) => resolve(d) !== CANONICAL)
  .sort();

if (offenders.length) {
  console.error(
    `✗ lint-migrations-dir: ${offenders.length} supabase/migrations director${
      offenders.length === 1 ? 'y' : 'ies'
    } outside the repo root:\n`,
  );
  let stranded = 0;
  for (const dir of offenders) {
    const n = countSql(dir);
    stranded += n;
    console.error(
      `  ${relative(REPO_ROOT, dir) + sep} — ${n} unapplied migration${n === 1 ? '' : 's'}`,
    );
  }
  const subject =
    stranded === 0
      ? 'any migration written there will'
      : stranded === 1
        ? 'this migration will'
        : `these ${stranded} migrations will`;
  console.error(
    `\n\`supabase db push\` reads ONLY <repoRoot>/supabase/migrations, so ` +
      `${subject}\nnever be applied — and nothing will warn you. It will simply sit ` +
      `there looking\nexactly like a healthy pending migration.\n\n` +
      `That is not hypothetical: apps/supabase/migrations/ hid ` +
      `photo_messages.voice_depth\nthis way. The route shipped, the column never ` +
      `did, and because PostgREST\nresolves an RPC by its exact named arguments, ` +
      `EVERY guest message save returned\n\`save_failed\` — silently, with green CI.\n\n` +
      `Fix: allocate a real migration at the repo root and move the SQL into it:\n` +
      `  pnpm migration:new <slug>        # never hand-type the timestamp\n` +
      `then delete the orphan directory.\n\n` +
      `See the sibling guard apps/web/scripts/lint-changelog-dir.mjs — same shape,\n` +
      `same silence, 172 stranded changelog fragments.`,
  );
  process.exit(1);
}

console.log('✓ lint-migrations-dir: supabase/migrations/ exists only at the repo root.');
