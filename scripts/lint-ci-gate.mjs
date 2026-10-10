#!/usr/bin/env node
/**
 * lint-ci-gate — is the required CI gate still worth requiring?
 *
 * "typecheck + lint" passes when every job in its `needs:` passed. That is only
 * a control if the LIST is right, and a list fails open quietly. This reads the
 * workflow text (no network, no install) and fails when:
 *
 *   · a job is in nobody's `needs:` and is not itself a required name — it goes
 *     red on the PR page and the PR merges anyway;
 *   · a required name is no longer the name of exactly one job — branch
 *     protection would wait on a check that never reports, or on an ambiguous one;
 *   · the gate lost `if: always()` (a skipped required check counts as passed),
 *     or stopped reading the whole `needs` list;
 *   · something the gate used to run as a step is run by no job it needs;
 *   · a shard list skips a number, lacks `fail-fast: false`, or its flag sits
 *     where node ignores it;
 *   · a test step is piped through `tee` without `shell: bash` (no pipefail).
 *
 * The rules are in scripts/lib/ci-shape.mjs; scripts/ci-gate.test.mjs holds
 * each of them to a sabotaged workflow.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeProblems, parseJobs, GATE_NAME, REQUIRED_CONTEXTS } from './lib/ci-shape.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WF = path.join(ROOT, '.github', 'workflows');
const ci = fs.readFileSync(path.join(WF, 'ci.yml'), 'utf8');
const others = {};
for (const f of fs.readdirSync(WF)) {
  if (f !== 'ci.yml' && /\.ya?ml$/.test(f)) others[f] = fs.readFileSync(path.join(WF, f), 'utf8');
}
const webPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'web', 'package.json'), 'utf8'));

const problems = shapeProblems({ ci, others, webPackage });
if (problems.length) {
  console.error(`FAIL · lint-ci-gate — ${problems.length} problem(s) with the required CI gate:\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error('The required names are a mirror of branch protection. Re-measure before changing the list:');
  console.error("  gh api repos/iscasasola/setnayan-platform/branches/main/protection --jq '.required_status_checks.contexts'");
  process.exit(1);
}
const gate = parseJobs(ci).find((j) => j.name === GATE_NAME);
console.log(`✓ lint-ci-gate: "${GATE_NAME}" stands for ${gate.needs.length} jobs (${gate.needs.join(', ')}); all ${REQUIRED_CONTEXTS.length} required names are each the name of exactly one job.`);
