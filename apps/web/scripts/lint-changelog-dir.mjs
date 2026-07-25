#!/usr/bin/env node
/**
 * lint-changelog-dir.mjs
 *
 * Fails when a `changelog.d/` directory exists ANYWHERE in the repo other than
 * the one at the repo root. Per-PR changelog fragments have exactly one home —
 * `<repoRoot>/changelog.d/` — because that is the only directory
 * `scripts/changelog-collect.mjs` reads.
 *
 * WHY THIS GUARD EXISTS (2026-07-25 · 172 fragments were silently dropped):
 * The collector hardcodes its fragment directory:
 *
 *     const fragDir = join(root, 'changelog.d');   // scripts/changelog-collect.mjs
 *
 * A fragment written to any OTHER `changelog.d/` is never read, never folded
 * into `CHANGELOG.md`, and never deleted — so it sits in the tree looking
 * exactly like a healthy pending fragment while contributing nothing. There is
 * no error, no warning, and no missing-file to notice: the failure mode is pure
 * silence, which is why it ran for months. By 2026-07-25 two orphan directories
 * had accumulated **172 stranded fragments** (167 in `apps/web/changelog.d/`,
 * 5 in `apps/changelog.d/`) whose content never reached the changelog. Both
 * were migrated into the root directory with `git mv`; this guard is what stops
 * a third one from forming.
 *
 * The trap is easy to fall into and gives no feedback when you do: `apps/web`
 * is where nearly all the code lives, so an author running commands from that
 * directory — or an agent resolving a relative `changelog.d/<slug>.md` against
 * its own cwd — creates the orphan directory on the way past. Neither orphan
 * had a README or a sibling `CHANGELOG.md`, so neither served any per-package
 * purpose; they were pure cwd accidents.
 *
 * Why a guard and not a doc fix: `changelog.d/README.md` and the repo
 * `CLAUDE.md` ALREADY said "create the file here / at `changelog.d/<slug>.md`"
 * the whole time the 172 fragments were piling up. Documentation cannot catch a
 * mistake whose only symptom is silence — a check that fails loudly can.
 *
 * HOW IT CHECKS — a bounded filesystem walk:
 *   1. Resolve the repo root (this file is at apps/web/scripts/, so ../../..).
 *   2. Walk the tree, skipping heavy/generated directories (node_modules, .git,
 *      .next, target, …) that can never hold a hand-written fragment.
 *   3. Report every `changelog.d/` found that is not the root one, with the
 *      count of `.md` files stranded inside it.
 *
 * The walk is filesystem-based, not `git ls-files`, so it also catches an
 * orphan that has been created but not yet committed — i.e. it fails locally,
 * before the fragment is ever pushed to a branch where the content would be
 * silently ignored.
 *
 * Usage:
 *   node apps/web/scripts/lint-changelog-dir.mjs
 *   pnpm --filter web lint:changelog-dir
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/web/scripts → apps/web → apps → <repoRoot>
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const CANONICAL = join(REPO_ROOT, 'changelog.d');

/** Directories that can never contain a hand-written changelog fragment. */
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

/** Collect every directory named `changelog.d` under `dir`. */
function findChangelogDirs(dir, found = []) {
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
    if (name === 'changelog.d') {
      found.push(full);
      continue; // fragments are flat — no need to descend
    }
    findChangelogDirs(full, found);
  }
  return found;
}

/** Count `.md` files sitting in a directory. */
function countMarkdown(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

const offenders = findChangelogDirs(REPO_ROOT)
  .filter((d) => resolve(d) !== CANONICAL)
  .sort();

if (offenders.length) {
  console.error(
    `✗ lint-changelog-dir: ${offenders.length} changelog.d director${
      offenders.length === 1 ? 'y' : 'ies'
    } outside the repo root:\n`,
  );
  let stranded = 0;
  for (const dir of offenders) {
    const n = countMarkdown(dir);
    stranded += n;
    const rel = relative(REPO_ROOT, dir) + sep;
    console.error(`  ${rel} — ${n} stranded fragment${n === 1 ? '' : 's'}`);
  }
  const subject =
    stranded === 0
      ? 'any fragment written there will'
      : stranded === 1
        ? 'this fragment will'
        : `these ${stranded} fragments will`;
  console.error(
    `\nscripts/changelog-collect.mjs reads ONLY <repoRoot>/changelog.d, so ` +
      `${subject} never\nreach CHANGELOG.md — and nothing will warn you. This exact ` +
      `silent drop\nstranded 172 fragments in apps/web/changelog.d and ` +
      `apps/changelog.d before\n2026-07-25.\n\n` +
      `Fix: move the fragment(s) into the ROOT directory and delete the orphan dir:\n` +
      `  git mv <dir>/*.md changelog.d/ && rmdir <dir>\n\n` +
      `Write every new fragment as <repoRoot>/changelog.d/<branch-slug>.md — note\n` +
      `that path is relative to the REPO ROOT, not to apps/web. See ` +
      `changelog.d/README.md.`,
  );
  process.exit(1);
}

console.log('✓ lint-changelog-dir: changelog.d/ exists only at the repo root.');
