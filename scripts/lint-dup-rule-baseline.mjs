#!/usr/bin/env node
/**
 * Structural lint for the committed duplicated-rule baseline.
 *
 *   node scripts/lint-dup-rule-baseline.mjs
 *
 * The real comparison lives in apps/web/scripts/lint-dup-rule.ts, which needs
 * the TypeScript scanners (and therefore an install). THIS check needs nothing
 * but the files, so it runs everywhere, and it exists to close the two ways a
 * file-based guard dies quietly — the same two that scripts/lint-exposure-
 * baseline.mjs closes for the exposure freeze:
 *
 *   1. THE BASELINE IS GUTTED. Truncate it, empty it, or sort it by hand, and a
 *      naive differ happily reports "no widenings" because there is nothing to
 *      widen against. So: the header's own fact count must match the body,
 *      floors must be met, ordering must be canonical, keys must be unique, and
 *      each line must carry the right number of fields for its kind.
 *
 *   2. THE GUARD IS UNWIRED. Delete the runner, drop the package.json script,
 *      or remove the CI step, and the build still goes green — the most
 *      dangerous failure mode there is, because it manufactures confidence. So:
 *      this asserts the scanners exist, the runner exists, both package.json
 *      scripts exist, and the workflow really invokes the runner.
 *
 * Exit code 1 on any violation. Pure node, no dependencies, no database.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO_ROOT, 'apps/web/scripts/dup-rule.baseline.txt');
const RUNNER = path.join(REPO_ROOT, 'apps/web/scripts/lint-dup-rule.ts');
const SHADOW_SCAN = path.join(REPO_ROOT, 'apps/web/lib/security/shadowed-export-scan.ts');
const SELECT_SCAN = path.join(REPO_ROOT, 'apps/web/lib/security/select-column-scan.ts');
const SHADOW_TEST = path.join(REPO_ROOT, 'apps/web/lib/security/shadowed-export-scan.test.ts');
const SELECT_TEST = path.join(REPO_ROOT, 'apps/web/lib/security/select-column-scan.test.ts');
const WEB_PKG = path.join(REPO_ROOT, 'apps/web/package.json');
const CI_WORKFLOW = path.join(REPO_ROOT, '.github/workflows/ci.yml');

/**
 * Fact kinds in canonical file order, with the number of TAB-separated fields
 * each key carries. MIRRORS `DUP_RULE_KINDS` in
 * apps/web/lib/security/dup-rule-baseline.ts — the mirror is verified below, so
 * the two cannot drift apart silently. (Which would be funny, given what these
 * guards are for.)
 */
const FACT_KINDS = ['shadow', 'omit'];
const KEY_FIELDS = { shadow: 3, omit: 4 };

/**
 * Minimum facts per kind. Well under the real numbers (21 / 103 when this
 * landed) so shrinking the debt never trips them. Their only job is to make a
 * gutted baseline impossible to pass off as clean. LOWER THEM ONLY when the
 * real count has genuinely gone below — that is a win worth recording.
 */
const FLOORS = { shadow: 5, omit: 20 };

const problems = [];
const fail = (msg) => problems.push(msg);

/* ── the baseline file itself ───────────────────────────────────────────────*/

if (!fs.existsSync(BASELINE)) {
  fail(
    'MISSING: apps/web/scripts/dup-rule.baseline.txt\n' +
      '  Generate it: pnpm --filter @setnayan/web dup-rule:baseline',
  );
} else {
  const text = fs.readFileSync(BASELINE, 'utf8');
  const lines = text.split('\n');

  const declaredMatch = /^#\s*facts:\s*(\d+)\s*$/m.exec(text);
  if (!declaredMatch) {
    fail('baseline header has no `# facts: N` line — regenerate the file, do not hand-edit it');
  }

  // The header must explain, in plain words, what a NEW line means. Without
  // that, the next person to hit this in CI regenerates the file and the guard
  // becomes a rubber stamp.
  if (!/ADDING A LINE IS A WIDENING AND FAILS CI/.test(text)) {
    fail(
      'the baseline header no longer states that adding a line is a widening.\n' +
        '  That sentence is the guard: it is what stops someone regenerating the file to\n' +
        '  make the build green. Restore it in lib/security/dup-rule-baseline.ts.',
    );
  }

  const facts = [];
  const kindSet = new Set(FACT_KINDS);
  lines.forEach((line, i) => {
    if (line.startsWith('#') || line.trim() === '') return;
    const parts = line.split('\t');
    const kind = parts[0];
    if (!kindSet.has(kind)) {
      fail(`line ${i + 1}: unknown fact kind "${kind}"`);
      return;
    }
    const fields = parts.length - 1;
    if (fields !== KEY_FIELDS[kind]) {
      fail(
        `line ${i + 1}: a "${kind}" fact needs ${KEY_FIELDS[kind]} tab-separated key fields, got ${fields}\n` +
          `    ${line.slice(0, 140)}`,
      );
      return;
    }
    facts.push({ kind, key: parts.slice(1).join('\t'), line: i + 1 });
  });

  if (declaredMatch && facts.length !== Number(declaredMatch[1])) {
    fail(
      `TRUNCATED OR EDITED: header declares ${declaredMatch[1]} facts but the body holds ${facts.length}.\n` +
        '  Regenerate: pnpm --filter @setnayan/web dup-rule:baseline',
    );
  }

  const counts = Object.create(null);
  for (const f of facts) counts[f.kind] = (counts[f.kind] ?? 0) + 1;

  // Per-kind counts declared in the header must match the body too.
  for (const m of text.matchAll(/^#\s{3}(shadow|omit)\s+(\d+)\s*$/gm)) {
    const kind = m[1];
    const n = Number(m[2]);
    if ((counts[kind] ?? 0) !== n) {
      fail(`header declares ${n} "${kind}" facts but the body holds ${counts[kind] ?? 0}`);
    }
  }

  for (const [kind, floor] of Object.entries(FLOORS)) {
    const n = counts[kind] ?? 0;
    if (n < floor) {
      fail(
        `GUTTED: only ${n} "${kind}" facts, below the floor of ${floor}.\n` +
          '  A baseline this thin cannot detect a widening. If the debt genuinely shrank\n' +
          '  this far, lower the floor in this file deliberately and say so — do not do it\n' +
          '  to silence a failure.',
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
    const ordered = ka !== kb ? ka < kb : a.key <= b.key;
    if (!ordered) {
      fail(
        `OUT OF ORDER at line ${b.line}: "${b.kind} ${b.key}" sorts before "${a.kind} ${a.key}".\n` +
          '  Regenerate: pnpm --filter @setnayan/web dup-rule:baseline',
      );
      break;
    }
  }

  const seen = new Map();
  for (const f of facts) {
    const k = `${f.kind}\t${f.key}`;
    if (seen.has(k)) {
      fail(`DUPLICATE fact "${f.kind} ${f.key}" at lines ${seen.get(k)} and ${f.line}`);
    } else seen.set(k, f.line);
  }
}

/* ── the mirrored constants must not drift ──────────────────────────────────*/

const BASELINE_TS = path.join(REPO_ROOT, 'apps/web/lib/security/dup-rule-baseline.ts');
if (!fs.existsSync(BASELINE_TS)) {
  fail('MISSING: apps/web/lib/security/dup-rule-baseline.ts — the baseline machinery is gone');
} else {
  const src = fs.readFileSync(BASELINE_TS, 'utf8');
  const kindsBlock = /export const DUP_RULE_KINDS[^=]*=\s*\[([\s\S]*?)\]/.exec(src);
  if (!kindsBlock) {
    fail('could not find DUP_RULE_KINDS in dup-rule-baseline.ts — this lint cannot verify its mirror');
  } else {
    const tsKinds = [...kindsBlock[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    if (tsKinds.join(',') !== FACT_KINDS.join(',')) {
      fail(
        `DRIFT: DUP_RULE_KINDS in dup-rule-baseline.ts is [${tsKinds.join(', ')}]\n` +
          `  but this lint mirrors  [${FACT_KINDS.join(', ')}].\n` +
          '  Update the FACT_KINDS constant at the top of scripts/lint-dup-rule-baseline.mjs.',
      );
    }
  }
}

/* ── the guard must actually be wired ───────────────────────────────────────*/

for (const [file, why] of [
  [RUNNER, 'the runner that compares the scan to the baseline'],
  [SHADOW_SCAN, 'GUARD 1 — the shadowed-export scanner'],
  [SELECT_SCAN, 'GUARD 2 — the select-column scanner (omission half in PART 2)'],
  [SHADOW_TEST, "GUARD 1's controls and anti-vacuity floors"],
  [SELECT_TEST, "GUARD 2's controls and anti-vacuity floors"],
]) {
  if (!fs.existsSync(file)) {
    fail(`MISSING: ${path.relative(REPO_ROOT, file)} — ${why}. Without it this mechanism is decoration.`);
  }
}

if (fs.existsSync(SELECT_SCAN)) {
  const src = fs.readFileSync(SELECT_SCAN, 'utf8');
  if (!/export function findOmittedColumns/.test(src)) {
    fail(
      'select-column-scan.ts no longer exports findOmittedColumns — GUARD 2 has been removed\n' +
        '  from the scanner it was deliberately built INTO (rather than beside).',
    );
  }
}

if (fs.existsSync(WEB_PKG)) {
  const scripts = JSON.parse(fs.readFileSync(WEB_PKG, 'utf8')).scripts ?? {};
  if (!scripts['lint:dup-rule']) {
    fail('apps/web package.json is missing the `lint:dup-rule` script that CI invokes');
  }
  if (!scripts['dup-rule:baseline']) {
    fail(
      'apps/web package.json is missing the `dup-rule:baseline` script.\n' +
        '  A baseline with no documented one-command regeneration path is a baseline\n' +
        '  people hand-edit.',
    );
  }
  if (!scripts['test:unit'] || !scripts['test:unit'].includes('lib/**/*.test.ts')) {
    fail(
      'apps/web package.json `test:unit` no longer runs the lib/**/*.test.ts glob, so both\n' +
        "  guards' positive controls and anti-vacuity floors would stop running in CI.",
    );
  }
}

if (fs.existsSync(CI_WORKFLOW)) {
  const ci = fs.readFileSync(CI_WORKFLOW, 'utf8');
  // Match an actual `run:` STEP, not any mention of the string — comments name
  // these commands, and a substring search would pass on a workflow whose real
  // steps had been deleted, which is precisely what this check exists to catch.
  if (!/^\s*run:\s*.*\blint:dup-rule\b/m.test(ci)) {
    fail(
      '.github/workflows/ci.yml has no `run:` step invoking `lint:dup-rule`, so the guard\n' +
        '  would never execute on a pull request. A guard that does not run is worse than no\n' +
        '  guard, because it manufactures confidence.',
    );
  }
  if (!/^\s*run:\s*.*\blint-dup-rule-baseline\.mjs\b/m.test(ci)) {
    fail('.github/workflows/ci.yml has no `run:` step for this lint — wire it, or delete it honestly');
  }
}

/* ── report ─────────────────────────────────────────────────────────────────*/

if (problems.length > 0) {
  console.error('\nduplicated-rule baseline lint FAILED\n');
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error('Background: the header of apps/web/scripts/dup-rule.baseline.txt\n');
  process.exit(1);
}

console.log('duplicated-rule baseline lint OK — file is canonical, floors met, guard is wired.');
