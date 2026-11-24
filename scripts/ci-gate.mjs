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
 *   env PR_DRAFT = ${{ needs.pr-state.outputs.draft }}   — read LIVE at run time; a draft is always RED (see gateVerdict)
 *   env EVENT_NAME, RUN_ID, HEAD_SHA, HEAD_BRANCH, PR_NUMBER, GITHUB_TOKEN (actions: read)
 *       — a run CANCELLED for a newer run on the same commit defers to it (see supersedingRun)
 *
 * FAIL-CLOSED — see gateVerdict in scripts/lib/ci-shape.mjs. `skipped` and
 * `cancelled` are failures here on purpose: GitHub treats a skipped check as
 * passed, and that is exactly the hole this job exists to close.
 */

import fs from 'node:fs';
import { gateVerdict, deferrable, supersedingRun } from './lib/ci-shape.mjs';

const { ok, rows, problems } = gateVerdict(process.env.NEEDS, process.env.PR_DRAFT);

/*
 * A CANCELLED RUN DEFERS TO THE RUN WAITING TO REPLACE IT (see supersedingRun in scripts/lib/ci-shape.mjs).
 * Only a red made of "nothing finished" (cancelled / skipped / draft — never a failure), only on a pull_request,
 * only when GitHub lists a run of this workflow WAITING on the same commit. Any doubt — no token, a refused or
 * unreadable lookup, no waiting run — and the gate stays red exactly as before.
 */
if (!ok && process.env.EVENT_NAME === 'pull_request' && deferrable(process.env.NEEDS)) {
  const successor = await findSuccessor();
  if (successor) {
    const msg = `This run was cancelled because run ${successor.id} (${successor.status}) is replacing it on the same commit ${String(process.env.HEAD_SHA).slice(0, 9)}. Nothing here failed; nothing here finished. That run's "typecheck + lint" decides: it is required too, and stays pending until it is done.`;
    console.log(`::notice title=Superseded on the same commit::${msg}`);
    for (const r of rows) console.log(`  ${r.result === 'success' ? 'PASS' : '----'}  ${r.job} (${r.result})`);
    console.log(`\n${successor.html_url ?? ''}`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) fs.appendFileSync(summary, ['### typecheck + lint — superseded', '', msg, '', successor.html_url ?? '', ''].join('\n'));
    process.exit(0);
  }
}

async function findSuccessor() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, RUN_ID, HEAD_SHA, HEAD_BRANCH, PR_NUMBER } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !RUN_ID || !HEAD_SHA || !HEAD_BRANCH) {
    console.log('(superseded check skipped: GITHUB_TOKEN, GITHUB_REPOSITORY, RUN_ID, HEAD_SHA and HEAD_BRANCH are all needed — the gate stays red)');
    return null;
  }
  const file = /\.github\/workflows\/([^@/]+)@/.exec(process.env.GITHUB_WORKFLOW_REF ?? '')?.[1] ?? 'ci.yml';
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const url = `${api}/repos/${GITHUB_REPOSITORY}/actions/workflows/${encodeURIComponent(file)}/runs?head_sha=${encodeURIComponent(HEAD_SHA)}&event=pull_request&per_page=50`;
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } });
    if (!res.ok) {
      console.log(`(superseded check: GitHub answered ${res.status} — the gate stays red)`);
      return null;
    }
    const body = await res.json();
    return supersedingRun(body?.workflow_runs, { runId: RUN_ID, headSha: HEAD_SHA, headBranch: HEAD_BRANCH, prNumber: PR_NUMBER });
  } catch (e) {
    console.log(`(superseded check failed: ${e?.message ?? e} — the gate stays red)`);
    return null;
  }
}

if (process.env.PR_DRAFT === 'true') {
  console.log('::error title=Draft PR::Draft PR: checks not run. Mark ready to test.');
  // The draft flag came from the pr-state job of THIS run attempt. Re-running only this job replays that answer (and
  // the skipped jobs); "Re-run all jobs" reads the flag again and, on a ready PR, tests everything.
  console.log('This run read the PR as a draft when it started. Once the PR is ready, marking it ready starts a full run; to turn THIS run green, use "Re-run all jobs" (re-running only this job replays the draft answer).');
}

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
