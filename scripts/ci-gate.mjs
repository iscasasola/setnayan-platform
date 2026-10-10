#!/usr/bin/env node
/**
 * ci-gate — the required "typecheck + lint" check IS this script.
 *
 * Branch protection requires a check by that NAME. Since 2026-10-08 the work it
 * names (typecheck, eslint, the unit suite, the DB replay, the guards) runs as
 * separate jobs side by side, so that one push shows every failure instead of
 * the first one. The job that keeps the name `needs:` all of them and runs
 * only this: read each job's result, and be red unless every one is `success`.
 *
 *   env NEEDS = ${{ toJSON(needs) }}
 *
 * FAIL-CLOSED — see gateVerdict in scripts/lib/ci-shape.mjs. `skipped` and
 * `cancelled` are failures here on purpose: GitHub treats a skipped check as
 * passed, and that is exactly the hole this job exists to close.
 */

import fs from 'node:fs';
import { gateVerdict } from './lib/ci-shape.mjs';

const { ok, rows, problems } = gateVerdict(process.env.NEEDS);

for (const r of rows) console.log(`  ${r.result === 'success' ? 'PASS' : 'FAIL'}  ${r.job} (${r.result})`);
for (const r of rows) {
  if (r.result !== 'success') {
    console.log(`::error title=${r.job} · ${r.result}::The "${r.job}" job finished ${r.result}. Open that job on this run for its own message — every failing job is listed here, not just the first.`);
  }
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const md = ['### typecheck + lint — the required gate', '', '| job | result |', '|---|---|', ...rows.map((r) => `| ${r.job} | ${r.result === 'success' ? '✅ success' : `❌ ${r.result}`} |`), ''];
  if (!ok) md.push(`**${problems.length} problem(s).** Each failing job above names its own failures in its summary.`, '');
  fs.appendFileSync(summary, md.join('\n'));
}

if (!ok) {
  console.log('');
  console.log('The required check is RED:');
  for (const p of problems) console.log(`  · ${p}`);
  console.log('');
  console.log('Every failing job is listed above — fix them all; the first is not necessarily the only one.');
  process.exit(1);
}
console.log('');
console.log(`All ${rows.length} jobs this check stands for passed.`);
