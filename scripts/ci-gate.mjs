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
import { gateVerdict, deferrable, supersedingRun, deferredCheckBody, draftHoldCheckBody, pendingDeferredChecks, completionConclusion, GATE_NAME } from './lib/ci-shape.mjs';

const { ok, rows, problems } = gateVerdict(process.env.NEEDS, process.env.PR_DRAFT);
const { GITHUB_TOKEN, GITHUB_REPOSITORY, RUN_ID, HEAD_SHA, HEAD_BRANCH, PR_NUMBER, EVENT_NAME } = process.env;
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const onPr = EVENT_NAME === 'pull_request';

/** One GitHub call. Never throws: a failure is `null`, and every caller treats `null` as "stay red". */
async function gh(method, path, body) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      console.log(`(GitHub answered ${res.status} to ${method} ${path.split('?')[0]})`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`(GitHub call failed: ${e?.message ?? e})`);
    return null;
  }
}

/*
 * A CANCELLED RUN DEFERS TO THE RUN WAITING TO REPLACE IT, AND SAYS PENDING, NEVER SUCCESS
 * (see supersedingRun and deferredCheckBody in scripts/lib/ci-shape.mjs). Only a red made of "nothing finished"
 * (cancelled / skipped / draft, never a failure), only on a pull_request, only when GitHub lists a run of this
 * workflow WAITING on the same commit, and only once GitHub has ACCEPTED the pending "typecheck + lint" check that
 * holds the context until the successor completes it. Any doubt and the gate stays red exactly as before.
 */
if (!ok && onPr && deferrable(process.env.NEEDS)) {
  const successor = await findSuccessor();
  if (successor) {
    const posted = await gh('POST', `/repos/${GITHUB_REPOSITORY}/check-runs`, deferredCheckBody({ runId: RUN_ID, headSha: HEAD_SHA, successor }));
    if (posted?.id && posted.status !== 'completed' && posted.conclusion == null) {
      const msg = `This run was cancelled because run ${successor.id} (${successor.status}) is replacing it on the same commit ${String(HEAD_SHA).slice(0, 9)}. Nothing here failed; nothing here was tested. "${GATE_NAME}" now reads PENDING (check run ${posted.id}) until that run's own gate completes it with its real result.`;
      console.log(`::notice title=Deferred, pending::${msg}`);
      for (const r of rows) console.log(`  ${r.result === 'success' ? 'PASS' : '----'}  ${r.job} (${r.result})`);
      console.log(`\n${successor.html_url ?? ''}`);
      const summary = process.env.GITHUB_STEP_SUMMARY;
      if (summary) fs.appendFileSync(summary, ['### typecheck + lint: deferred (pending)', '', msg, '', successor.html_url ?? '', ''].join('\n'));
      process.exit(0);
    }
    console.log('(the PENDING deferral check was not accepted by GitHub, so nothing holds the context: the gate stays red)');
  }
}

/*
 * A LONE DRAFT HOLDS THE CONTEXT PENDING, NEVER RED (#8524 — see draftHoldCheckBody). A red draft gate that finished
 * before "Ready for review" stayed counted on the commit after the ready run went green, so the PR sat BLOCKED. The
 * hold is completed by the ready run's honest gate below. Only a draft, only on a pull_request, only when nothing
 * really FAILED (a draft whose guards failed stays red), and only once GitHub accepted the pending check.
 */
if (!ok && onPr && process.env.PR_DRAFT === 'true' && deferrable(process.env.NEEDS) && GITHUB_TOKEN && GITHUB_REPOSITORY && RUN_ID && HEAD_SHA) {
  const posted = await gh('POST', `/repos/${GITHUB_REPOSITORY}/check-runs`, draftHoldCheckBody({ runId: RUN_ID, headSha: HEAD_SHA }));
  if (posted?.id && posted.status !== 'completed' && posted.conclusion == null) {
    const msg = `Draft PR: checks not run. "${GATE_NAME}" now reads PENDING (check run ${posted.id}), so this draft cannot merge. Marking the PR ready starts a full run whose own gate completes it with the real result — no re-run and no extra commit needed.`;
    console.log(`::notice title=Draft PR, pending::${msg}`);
    for (const r of rows) console.log(`  ${r.result === 'success' ? 'PASS' : '----'}  ${r.job} (${r.result})`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) fs.appendFileSync(summary, ['### typecheck + lint: draft (pending)', '', msg, ''].join('\n'));
    process.exit(0);
  }
  console.log('(the PENDING draft hold was not accepted by GitHub, so nothing holds the context: the gate stays red)');
}

async function findSuccessor() {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !RUN_ID || !HEAD_SHA || !HEAD_BRANCH) {
    console.log('(superseded check skipped: GITHUB_TOKEN, GITHUB_REPOSITORY, RUN_ID, HEAD_SHA and HEAD_BRANCH are all needed; the gate stays red)');
    return null;
  }
  const file = /\.github\/workflows\/([^@/]+)@/.exec(process.env.GITHUB_WORKFLOW_REF ?? '')?.[1] ?? 'ci.yml';
  const body = await gh('GET', `/repos/${GITHUB_REPOSITORY}/actions/workflows/${encodeURIComponent(file)}/runs?head_sha=${encodeURIComponent(HEAD_SHA)}&event=pull_request&per_page=50`);
  if (!body) {
    console.log('(superseded check: the runs lookup failed; the gate stays red)');
    return null;
  }
  return supersedingRun(body.workflow_runs, { runId: RUN_ID, headSha: HEAD_SHA, headBranch: HEAD_BRANCH, prNumber: PR_NUMBER });
}

/*
 * AN HONEST GATE COMPLETES EVERY PENDING DEFERRED CHECK ON THIS COMMIT with its own verdict, by PATCHing the same
 * check run (a newer one of the same name would not replace it). A draft-red gate leaves them pending. This never
 * changes this gate's own verdict: if it fails, the context simply stays pending (blocked), which is fail-closed.
 */
const completion = completionConclusion(ok, process.env.PR_DRAFT);
if (onPr && completion && GITHUB_TOKEN && GITHUB_REPOSITORY && HEAD_SHA) {
  const list = await gh('GET', `/repos/${GITHUB_REPOSITORY}/commits/${encodeURIComponent(HEAD_SHA)}/check-runs?check_name=${encodeURIComponent(GATE_NAME)}&filter=all&per_page=100`);
  if (!list) console.log('::warning title=Deferred checks::Could not list the check runs on this commit. Any pending deferred "typecheck + lint" stays pending (the PR stays blocked) until a gate completes it.');
  for (const c of pendingDeferredChecks(list?.check_runs)) {
    const done = await gh('PATCH', `/repos/${GITHUB_REPOSITORY}/check-runs/${c.id}`, {
      status: 'completed',
      conclusion: completion,
      output: { title: `Completed by run ${RUN_ID}: ${completion}`, summary: `Deferred by a cancelled run; completed with the verdict of run ${RUN_ID}, which tested this commit.` },
    });
    console.log(done ? `  completed the deferred check ${c.id} (${c.external_id}) as ${completion}` : `::warning title=Deferred checks::Could not complete deferred check ${c.id}; it stays pending.`);
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
