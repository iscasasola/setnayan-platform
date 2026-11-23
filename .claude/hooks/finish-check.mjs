#!/usr/bin/env node
// Stop hook: the light finish check (owner pick, 22 Nov 2026).
//
// A session cannot finish a turn with broken code it changed. It runs ONLY when the session's
// checkout has changed app code, and it checks only what is cheap enough to run on every finish
// without crashing the 16 GB Mac:
//   1. the house design lint scripts (radius, frames, masthead, bottom nav, icons, field template,
//      server-action budget, no engineering notes, label contrast): ~17 s, no install needed;
//   2. eslint on the changed .ts/.tsx files only (skipped with a note when node_modules is absent).
// The full typecheck (13 GB heap) and the production build (8 GB) deliberately stay in
// `pnpm preflight` and CI. Running them on every finish, in 5 sessions at once, would exhaust the
// machine and run after every chat reply. That was option (b), declined.
//
// Exit 0 = may finish. Exit 2 = blocked: stderr goes back to the model to fix.
// A passing state is remembered by content hash, so a chat reply after a green check costs nothing.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Run exactly as .github/workflows/ci.yml runs them (same cwd, same env), so green here = green there.
const LINTS = [
  { name: 'lint-radius', cwd: 'root', env: { RADIUS_LINT_STRICT: '1' } },
  { name: 'lint-no-card', cwd: 'root' },
  { name: 'lint-page-masthead', cwd: 'web' },
  { name: 'lint-bottom-nav', cwd: 'root' },
  { name: 'lint-nav-icon-source', cwd: 'root' },
  { name: 'lint-field-template', cwd: 'root' },
  { name: 'lint-server-action-budget', cwd: 'root' },
  { name: 'lint-no-engineering-notes-in-ui', cwd: 'web' },
  { name: 'lint-label-on-fill-contrast', cwd: 'root' },
];
const CODE = /^apps\/web\/(app|components|lib|scripts)\/.+\.(ts|tsx|mts|mjs|css)$/;
const ESLINTABLE = /\.(ts|tsx)$/;
const MAX_ESLINT_FILES = 80;

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }
if (input.stop_hook_active) process.exit(0); // already blocked once this turn: never loop

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...args) => {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
if (!git('rev-parse', '--is-inside-work-tree')) process.exit(0);
if (!existsSync(join(root, 'apps/web/scripts'))) process.exit(0); // not this repo's layout

// Changed = differs from where this branch left main (committed or not), plus untracked files.
const base = git('merge-base', 'HEAD', 'origin/main') || 'HEAD';
const changed = new Set(
  [
    git('diff', '--name-only', '--diff-filter=ACMR', base),
    git('ls-files', '--others', '--exclude-standard'),
  ].join('\n').split('\n').map((s) => s.trim()).filter((f) => CODE.test(f) && existsSync(join(root, f))),
);
if (changed.size === 0) process.exit(0); // nothing of ours to check: docs, chat, reads

const files = [...changed].sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const stamp = hash.digest('hex');
const okPath = git('rev-parse', '--git-path', 'setnayan-finish-check.ok');
const okFile = okPath ? (okPath.startsWith('/') ? okPath : join(root, okPath)) : '';
if (okFile && existsSync(okFile) && readFileSync(okFile, 'utf8').trim() === stamp) process.exit(0);

const web = join(root, 'apps/web');
const failures = [];
for (const { name, cwd, env } of LINTS) {
  const script = join(web, 'scripts', `${name}.mjs`);
  if (!existsSync(script)) continue;
  const r = spawnSync(process.execPath, [script], {
    cwd: cwd === 'web' ? web : root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120_000,
  });
  if (r.status !== 0) failures.push(`✗ ${name}\n${(r.stdout + r.stderr).trim().split('\n').slice(-15).join('\n')}`);
}

const eslintBin = join(web, 'node_modules/.bin/eslint');
const lintable = files.filter((f) => ESLINTABLE.test(f) && f.startsWith('apps/web/')).map((f) => f.slice('apps/web/'.length));
let eslintNote = '';
if (lintable.length && existsSync(eslintBin)) {
  const batch = lintable.slice(0, MAX_ESLINT_FILES);
  // apps/web keeps .eslintrc.json (what `next lint` reads); ESLint 9 needs the legacy switch for it.
  const r = spawnSync(eslintBin, ['--quiet', '--no-error-on-unmatched-pattern', ...batch], {
    cwd: web, encoding: 'utf8', timeout: 180_000,
    env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false', NODE_NO_WARNINGS: '1' },
  });
  if (r.status !== 0) failures.push(`✗ eslint (changed files)\n${(r.stdout + r.stderr).trim().split('\n').slice(-30).join('\n')}`);
  if (lintable.length > MAX_ESLINT_FILES) eslintNote = ` (eslint checked the first ${MAX_ESLINT_FILES} of ${lintable.length})`;
} else if (lintable.length) {
  eslintNote = ' (eslint skipped: no node_modules in this checkout)';
}

if (failures.length) {
  process.stderr.write(
    `FINISH CHECK FAILED on ${files.length} changed file(s). Fix these before finishing ` +
      `(CLAUDE.md §3, .claude/rules/design-and-wiring.md):\n\n${failures.join('\n\n')}\n`,
  );
  process.exit(2);
}
if (okFile) { try { writeFileSync(okFile, stamp + '\n'); } catch { /* read-only git dir: fine */ } }
if (eslintNote) process.stderr.write(`finish check passed${eslintNote}\n`);
process.exit(0);
