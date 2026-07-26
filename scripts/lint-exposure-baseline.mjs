#!/usr/bin/env node
/**
 * Structural lint for the committed exposure surface baseline.
 *
 *   node scripts/lint-exposure-baseline.mjs
 *
 * The real comparison lives in apps/web/tests/db/exposure-freeze.db.test.ts,
 * which needs the migration replay. THIS check needs nothing but the files, so
 * it runs everywhere and in every job, and it exists to close the two ways a
 * file-based guard dies quietly:
 *
 *   1. THE BASELINE IS GUTTED. Truncate the file, or empty it, and a naive
 *      differ happily reports "no widenings" because there is nothing to widen
 *      against. So: the header's own fact count must match the body, per-kind
 *      floors must be met, ordering must be canonical, and keys must be unique.
 *
 *   2. THE GUARD IS UNWIRED. Delete the test file, rename it out of the glob,
 *      or drop the CI step, and the suite still goes green — the most dangerous
 *      failure mode there is, because it manufactures confidence. So: this
 *      asserts the test file exists, matches the glob that CI runs, and that
 *      the workflow really invokes that glob.
 *
 * Exit code 1 on any violation. Pure node, no dependencies, no database.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO_ROOT, 'supabase/security/exposure-surface.baseline.txt');
const README = path.join(REPO_ROOT, 'supabase/security/README.md');
const SURFACE_TS = path.join(REPO_ROOT, 'apps/web/tests/db/exposure-surface.ts');
const TEST_FILE = path.join(REPO_ROOT, 'apps/web/tests/db/exposure-freeze.db.test.ts');
const WEB_PKG = path.join(REPO_ROOT, 'apps/web/package.json');
const CI_WORKFLOW = path.join(REPO_ROOT, '.github/workflows/ci.yml');

/**
 * Fact kinds in canonical file order. MIRRORS `FACT_KINDS` in
 * apps/web/tests/db/exposure-surface.ts — the mirror is verified below, so the
 * two cannot drift apart silently.
 */
const FACT_KINDS = ['schema', 'rls', 'rlsforce', 'tpriv', 'col', 'policy', 'view', 'func'];

/**
 * Minimum facts per kind. Mirrors SURFACE_FLOORS in exposure-surface.ts (also
 * verified below). Well under the real numbers so growth never trips them;
 * their only job is to make a gutted baseline impossible to pass off as clean.
 */
const FLOORS = { tpriv: 400, col: 3000, policy: 500, func: 100 };

const problems = [];
const fail = (msg) => problems.push(msg);

/* ── the baseline file itself ───────────────────────────────────────────────*/

if (!fs.existsSync(BASELINE)) {
  fail(
    `MISSING: supabase/security/exposure-surface.baseline.txt\n` +
      `  Generate it: pnpm --filter @setnayan/web exposure:baseline`,
  );
} else {
  const text = fs.readFileSync(BASELINE, 'utf8');
  const lines = text.split('\n');

  const declaredMatch = /^#\s*facts:\s*(\d+)\s*$/m.exec(text);
  if (!declaredMatch) {
    fail('baseline header has no `# facts: N` line — regenerate the file, do not hand-edit it');
  }

  const facts = [];
  const kindSet = new Set(FACT_KINDS);
  lines.forEach((line, i) => {
    if (line.startsWith('#') || line.trim() === '') return;
    const parts = line.split('\t');
    if (parts.length < 3) {
      fail(`line ${i + 1}: expected 3 tab-separated fields, got ${parts.length}\n    ${line.slice(0, 120)}`);
      return;
    }
    const [kind, key, ...rest] = parts;
    if (!kindSet.has(kind)) {
      fail(`line ${i + 1}: unknown fact kind "${kind}"`);
      return;
    }
    facts.push({ kind, key, value: rest.join('\t'), line: i + 1 });
  });

  if (declaredMatch && facts.length !== Number(declaredMatch[1])) {
    fail(
      `TRUNCATED OR EDITED: header declares ${declaredMatch[1]} facts but the body holds ${facts.length}.\n` +
        `  Regenerate: pnpm --filter @setnayan/web exposure:baseline`,
    );
  }

  // Per-kind floors.
  const counts = Object.create(null);
  for (const f of facts) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  for (const [kind, floor] of Object.entries(FLOORS)) {
    const n = counts[kind] ?? 0;
    if (n < floor) {
      fail(
        `GUTTED: only ${n} "${kind}" facts, below the floor of ${floor}.\n` +
          `  A baseline this thin cannot detect a widening. Do NOT lower the floor —\n` +
          `  find out why the surface collector produced so little.`,
      );
    }
  }

  // Canonical ordering — an unsorted file makes every diff noisy, which trains
  // reviewers to stop reading it.
  const rank = new Map(FACT_KINDS.map((k, i) => [k, i]));
  for (let i = 1; i < facts.length; i++) {
    const a = facts[i - 1];
    const b = facts[i];
    const ka = rank.get(a.kind);
    const kb = rank.get(b.kind);
    const ordered = ka !== kb ? ka < kb : a.key !== b.key ? a.key < b.key : a.value <= b.value;
    if (!ordered) {
      fail(
        `OUT OF ORDER at line ${b.line}: "${b.kind} ${b.key}" sorts before "${a.kind} ${a.key}".\n` +
          `  Regenerate: pnpm --filter @setnayan/web exposure:baseline`,
      );
      break;
    }
  }

  // Unique keys.
  const seen = new Map();
  for (const f of facts) {
    const k = `${f.kind} ${f.key}`;
    if (seen.has(k)) fail(`DUPLICATE fact key "${f.kind} ${f.key}" at lines ${seen.get(k)} and ${f.line}`);
    else seen.set(k, f.line);
  }
}

if (!fs.existsSync(README)) {
  fail('MISSING: supabase/security/README.md — the baseline must ship with its explanation');
}

/* ── the mirrored constants must not drift ──────────────────────────────────*/

if (!fs.existsSync(SURFACE_TS)) {
  fail('MISSING: apps/web/tests/db/exposure-surface.ts — the surface collector is gone');
} else {
  const src = fs.readFileSync(SURFACE_TS, 'utf8');

  const kindsBlock = /export const FACT_KINDS[^=]*=\s*\[([\s\S]*?)\]/.exec(src);
  if (!kindsBlock) {
    fail('could not find FACT_KINDS in exposure-surface.ts — this lint cannot verify its mirror');
  } else {
    const tsKinds = [...kindsBlock[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    if (tsKinds.join(',') !== FACT_KINDS.join(',')) {
      fail(
        `DRIFT: FACT_KINDS in exposure-surface.ts is [${tsKinds.join(', ')}]\n` +
          `  but this lint mirrors  [${FACT_KINDS.join(', ')}].\n` +
          `  Update the FACT_KINDS constant at the top of scripts/lint-exposure-baseline.mjs.`,
      );
    }
  }

  const floorsBlock = /export const SURFACE_FLOORS[^=]*=\s*\{([\s\S]*?)\}/.exec(src);
  if (!floorsBlock) {
    fail('could not find SURFACE_FLOORS in exposure-surface.ts');
  } else {
    const tsFloors = Object.fromEntries(
      [...floorsBlock[1].matchAll(/(\w+)\s*:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    for (const [k, v] of Object.entries(FLOORS)) {
      if (tsFloors[k] !== v) {
        fail(
          `DRIFT: SURFACE_FLOORS.${k} is ${tsFloors[k]} in exposure-surface.ts but ${v} in this lint.\n` +
            `  Keep them equal — they defend the same thing from two different places.`,
        );
      }
    }
  }
}

/* ── the guard must actually be wired ───────────────────────────────────────*/

if (!fs.existsSync(TEST_FILE)) {
  fail(
    'MISSING: apps/web/tests/db/exposure-freeze.db.test.ts\n' +
      '  Without it, nothing compares the live schema to the baseline and this\n' +
      '  whole mechanism is decoration.',
  );
} else if (!/\.db\.test\.ts$/.test(TEST_FILE)) {
  fail('the freeze test no longer matches the tests/db/*.db.test.ts glob that CI runs');
}

if (fs.existsSync(WEB_PKG)) {
  const scripts = JSON.parse(fs.readFileSync(WEB_PKG, 'utf8')).scripts ?? {};
  if (!scripts['test:db:ci'] || !scripts['test:db:ci'].includes('tests/db/*.db.test.ts')) {
    fail(
      'apps/web package.json `test:db:ci` no longer runs the tests/db/*.db.test.ts glob,\n' +
        '  so the exposure freeze would stop running in CI.',
    );
  }
  if (!scripts['exposure:baseline']) {
    fail('apps/web package.json is missing the `exposure:baseline` script used to regenerate the file');
  }
}

if (fs.existsSync(CI_WORKFLOW)) {
  const ci = fs.readFileSync(CI_WORKFLOW, 'utf8');
  // Match an actual `run:` STEP, not any mention of the string. The comments in
  // ci.yml name both commands, so a substring search would happily pass on a
  // workflow whose real steps had been deleted — which is precisely the failure
  // this check exists to catch.
  const runsDbSuite = /^\s*run:\s*.*\btest:db:ci\b/m.test(ci);
  const runsThisLint = /^\s*run:\s*.*\blint-exposure-baseline\.mjs\b/m.test(ci);

  if (!runsDbSuite) {
    fail(
      '.github/workflows/ci.yml has no `run:` step invoking `test:db:ci`, so the exposure\n' +
        '  freeze would never execute on a pull request. A guard that does not run is worse\n' +
        '  than no guard, because it manufactures confidence.',
    );
  }
  if (!runsThisLint) {
    fail('.github/workflows/ci.yml has no `run:` step for this lint — wire it, or delete it honestly');
  }
}

/* ── report ─────────────────────────────────────────────────────────────────*/

if (problems.length > 0) {
  console.error('\nexposure baseline lint FAILED\n');
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error('Background: supabase/security/README.md\n');
  process.exit(1);
}

console.log('exposure baseline lint OK — file is canonical, floors met, guard is wired.');
