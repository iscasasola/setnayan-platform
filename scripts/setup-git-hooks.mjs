#!/usr/bin/env node
// Wire repo-local git hooks. Runs from the `prepare` lifecycle on `pnpm install`
// so every developer gets the migration-timestamp pre-push guard automatically
// (the husky pattern, without the dependency). Points core.hooksPath at the
// committed `.githooks/` directory and ensures the hook is executable (git
// silently skips a non-executable hook).
//
// Hard rule: this must NEVER throw. A hook-setup hiccup must not break
// `pnpm install` (CI, Docker, a tarball checkout, a machine without git).
import { execSync } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

function git(args, root) {
  const cmd = (root ? `git -C "${root}" ` : 'git ') + args;
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

try {
  // CI runs its own guard and shouldn't have its checkout's git config mutated.
  if (process.env.CI) process.exit(0);

  // Resolve the repo root explicitly (don't trust CWD) — throws if not a git work tree.
  const root = git('rev-parse --show-toplevel');
  const hook = join(root, '.githooks', 'pre-push');
  if (!existsSync(hook)) process.exit(0); // hook not present in this checkout yet

  let current = '';
  try {
    current = git('config --get core.hooksPath', root);
  } catch {
    current = '';
  }

  // git silently skips a non-executable hook — keep it +x whichever branch we take.
  const heal = () => {
    try {
      chmodSync(hook, 0o755);
    } catch {
      /* read-only fs / Windows — git uses the committed 100755 mode */
    }
  };

  if (current === '.githooks') {
    heal();
    process.exit(0); // already wired
  }
  if (current && current !== '.githooks') {
    // Respect a custom hooks path the developer set on purpose — don't clobber.
    // (This very repo's primary dev checkout has one, so say so loudly.)
    console.log('');
    console.log(`⚠  Migration-timestamp guard is NOT active: git core.hooksPath is set to "${current}".`);
    console.log('   Enable it once with:   git config core.hooksPath .githooks');
    console.log('');
    process.exit(0);
  }

  git('config core.hooksPath .githooks', root);
  heal();
  console.log('✓ Git hooks enabled (core.hooksPath → .githooks): migration-timestamp guard active on push.');
} catch {
  // Not a git repo / git unavailable — silently skip. Install must still succeed.
}

process.exit(0);
