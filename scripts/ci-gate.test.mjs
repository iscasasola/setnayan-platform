/**
 * The required CI gate, held to its own failure modes.
 *
 * Pure node, no install:   node --test scripts/ci-gate.test.mjs
 *
 * Every test here is about the same thing from a different side: a place where
 * "nothing ran" could be read as "nothing failed". The gate must be red for a
 * skipped job; the workflow lint must be red for a job nobody needs and for a
 * shard list with a hole in it; the summary must be red for a log with no
 * total. Each rule is checked against the REAL ci.yml with one thing broken.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateVerdict, shapeProblems, parseJobs, summariseTap, parseReportedChecks, reportConclusions, REQUIRED_CONTEXTS, GATE_NAME, DRAFT_CLAUSE, DRAFT_PR_PROBLEM, LIVE_DRAFT_JOB, LIVE_DRAFT_CLAUSE, deferrable, supersedingRun } from './lib/ci-shape.mjs';
import http from 'node:http';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WF = path.join(ROOT, '.github/workflows');
const CI = fs.readFileSync(path.join(WF, 'ci.yml'), 'utf8');
const others = Object.fromEntries(fs.readdirSync(WF).filter((f) => f !== 'ci.yml' && /\.ya?ml$/.test(f)).map((f) => [f, fs.readFileSync(path.join(WF, f), 'utf8')]));
const webPackage = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/package.json'), 'utf8'));
const problemsOf = (ci, pkg = webPackage, rest = others) => shapeProblems({ ci, others: rest, webPackage: pkg });

/** Replace exactly one thing in the real workflow — and refuse a sabotage that changed nothing. */
function broken(from, to) {
  assert.ok(typeof from === 'string' ? CI.includes(from) : from.test(CI), `the sabotage found nothing to break: ${from}`);
  const out = CI.replace(from, to);
  assert.notEqual(out, CI);
  return out;
}
const mentions = (problems, re) => assert.ok(problems.some((p) => re.test(p)), `expected a problem matching ${re}, got:\n  ${problems.join('\n  ') || '(none)'}`);

/* ── the verdict ────────────────────────────────────────────────────────────*/

test('the gate is green only when every job is exactly success', () => {
  const v = gateVerdict(JSON.stringify({ guards: { result: 'success' }, typecheck: { result: 'success' } }));
  assert.equal(v.ok, true);
  assert.deepEqual(v.rows.map((r) => r.job), ['guards', 'typecheck']);
});

test('🚨 a skipped job is a RED gate — GitHub alone would call it passed', () => {
  const v = gateVerdict(JSON.stringify({ guards: { result: 'success' }, 'db-replay': { result: 'skipped' } }));
  assert.equal(v.ok, false);
  assert.deepEqual(v.problems, ['db-replay: skipped']);
});

test('failure and cancelled are red, and every failing job is named — not the first', () => {
  const v = gateVerdict(JSON.stringify({ a: { result: 'failure' }, b: { result: 'success' }, c: { result: 'cancelled' }, d: { result: 'failure' } }));
  assert.equal(v.ok, false);
  assert.deepEqual(v.problems, ['a: failure', 'c: cancelled', 'd: failure']);
});

test('a gate that needs nothing, or cannot read its list, is red', () => {
  assert.equal(gateVerdict('{}').ok, false);
  assert.equal(gateVerdict('').ok, false);
  assert.equal(gateVerdict(undefined).ok, false);
  assert.equal(gateVerdict('not json').ok, false);
  assert.equal(gateVerdict('[]').ok, false);
  assert.equal(gateVerdict('null').ok, false);
  assert.equal(gateVerdict(JSON.stringify({ a: {} })).ok, false, 'a job with no result did not pass');
  assert.equal(gateVerdict(JSON.stringify({ a: { result: 'SUCCESS' } })).ok, false, 'only the exact string passes');
});

test('the script itself exits non-zero on a red verdict and zero on a green one', () => {
  const run = (needs) => spawnSync(process.execPath, [path.join(HERE, 'ci-gate.mjs')], { env: { ...process.env, NEEDS: needs, GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
  const green = run(JSON.stringify({ a: { result: 'success' } }));
  assert.equal(green.status, 0, green.stdout);
  const red = run(JSON.stringify({ a: { result: 'success' }, b: { result: 'skipped' }, c: { result: 'failure' } }));
  assert.equal(red.status, 1);
  assert.match(red.stdout, /::error title=b · skipped::/);
  assert.match(red.stdout, /::error title=c · failure::/, 'every failing job gets its own annotation');
  assert.equal(run('').status, 1);
});

/* ── the workflow, as committed ─────────────────────────────────────────────*/

test('the committed workflow is sound', () => {
  assert.deepEqual(problemsOf(CI), []);
});

test('all 13 required names are each reported by exactly one place — a job name or a report line', () => {
  assert.equal(REQUIRED_CONTEXTS.length, 13);
  assert.equal(new Set(REQUIRED_CONTEXTS).size, 13);
  const names = [...[...parseJobs(CI), ...Object.values(others).flatMap((t) => parseJobs(t))].map((j) => j.name), ...parseReportedChecks(CI).map((r) => r.name)];
  for (const ctx of REQUIRED_CONTEXTS) assert.equal(names.filter((n) => n === ctx).length, 1, ctx);
});

/* ── required checks reported by name (2026-11-18, the 40-job limit) ────────*/

test('the eight folded required checks are reported by the guards job, each from real steps', () => {
  const r = parseReportedChecks(CI).filter((x) => x.job === 'guards');
  assert.deepEqual(r.map((x) => x.name).sort(), ['lint bottom-nav template', 'lint entitlement gates', 'lint exposure baseline', 'lint guest legibility', 'lint nav icon source', 'lint nested forms', 'migration timestamp guard', 'secret scan']);
  assert.ok(r.every((x) => x.stepIds.length > 0));
  assert.equal(r.find((x) => x.name === 'migration timestamp guard').stepIds.length, 7, 'the guard and its six rule tests');
});

test('🚨 "bundle size check" reads the ONE production build — green only if the build and both budgets passed', () => {
  const r = parseReportedChecks(CI).filter((x) => x.job === 'build');
  assert.deepEqual(r.map((x) => [x.name, x.stepIds]), [['bundle size check', ['build_web', 'bundle_size', 'maker_budget']]]);
  const builds = parseJobs(CI).filter((j) => j.steps.some((st) => /^ {8}run:.*pnpm --filter @setnayan\/web build\s*$/m.test(st) || /^ {10}pnpm --filter @setnayan\/web build\s*$/m.test(st)));
  assert.deepEqual(builds.map((j) => j.id), ['build'], 'ci.yml runs exactly one production build');
  mentions(problemsOf(broken('bundle size check=${{ steps.build_web.outcome }}', 'bundle size check=${{ steps.build_webb.outcome }}')), /reads steps\.build_webb, which is not a step of job "build"/);
});

test('🚨 a reported name with a renamed step id, or no outcome, is caught', () => {
  mentions(problemsOf(broken('lint nested forms=${{ steps.req_nested_forms.outcome }}', 'lint nested forms=${{ steps.req_nested_formz.outcome }}')), /reads steps\.req_nested_formz, which is not a step of job "guards"/);
  mentions(problemsOf(broken('lint nested forms=${{ steps.req_nested_forms.outcome }}', 'lint nested forms=success')), /"lint nested forms" reads no step outcome/);
});

test('🚨 a required name dropped from the report, or reported twice, is caught', () => {
  mentions(problemsOf(broken(/ {12}secret scan=.*\n/, '')), /required check "secret scan" is no longer the name of any job, nor reported by name/);
  mentions(problemsOf(broken('            lint nested forms=', '            lint nested forms=${{ steps.req_bottom_nav.outcome }}\n            lint nested forms=')), /"lint nested forms" is reported by 2 places/);
});

test('🚨 a report step that can be skipped, posts to the merge commit, or lacks checks: write is caught', () => {
  mentions(problemsOf(broken('      - name: Report the required checks this job carries\n        if: ${{ always() }}', '      - name: Report the required checks this job carries\n        if: ${{ success() }}')), /must be `if: \$\{\{ always\(\) \}\}`/);
  mentions(problemsOf(broken('HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}', 'HEAD_SHA: ${{ github.sha }}')), /MERGE commit/);
  mentions(problemsOf(broken(/ {6}checks: write\n/, '')), /no `permissions: checks: write`/);
  mentions(problemsOf(broken('          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n          HEAD_SHA', '          GITHUB_TOKEN: ${{ secrets.OTHER }}\n          HEAD_SHA')), /must be given GITHUB_TOKEN/);
});

test('🚨 a reported check is green only when EVERY outcome on its line is exactly success', () => {
  const c = reportConclusions('a=success\nb=success,failure\nc=skipped\nd=\ne=success,\nf=cancelled\ng=SUCCESS\n\n');
  assert.deepEqual(c.map((x) => [x.name, x.conclusion]), [['a', 'success'], ['b', 'failure'], ['c', 'failure'], ['d', 'failure'], ['e', 'failure'], ['f', 'failure'], ['g', 'failure']]);
  assert.deepEqual(reportConclusions(''), []);
  assert.deepEqual(reportConclusions(undefined), []);
});

test('the reporter refuses to post nothing, and refuses without a commit or token', () => {
  const run = (env) => spawnSync(process.execPath, [path.join(HERE, 'ci-report-checks.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  assert.equal(run({ REPORT: '' }).status, 1);
  const r = run({ REPORT: 'secret scan=success' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /HEAD_SHA, GITHUB_TOKEN and GITHUB_REPOSITORY are all needed/);
});

test('the gate stands for every job that is not required under its own name', () => {
  const jobs = parseJobs(CI);
  const gate = jobs.find((j) => j.name === GATE_NAME);
  assert.equal(gate.id, 'typecheck-lint');
  const mustBeNeeded = jobs.filter((j) => j !== gate && !REQUIRED_CONTEXTS.includes(j.name)).map((j) => j.id);
  assert.ok(mustBeNeeded.length >= 5, `only ${mustBeNeeded.length} gated jobs — the reader is looking at the wrong thing`);
  assert.deepEqual([...gate.needs].sort(), [...mustBeNeeded].sort());
});

/* ── the workflow, broken one way at a time ─────────────────────────────────*/

test('🚨 a job left out of the gate is caught — it would block nothing', () => {
  mentions(problemsOf(broken('needs: [pr-state, guards, typecheck, eslint, unit-tests, db-replay]', 'needs: [pr-state, guards, typecheck, eslint, unit-tests]')), /"db-replay".*not in the gate's `needs:`/);
});

test('a NEW job nobody needs is caught', () => {
  const ci = broken('  build:\n    name: production build', '  shiny-new-check:\n    name: shiny new check\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n\n  build:\n    name: production build');
  mentions(problemsOf(ci), /"shiny-new-check".*would merge anyway/);
});

test('🚨 the gate without `if: always()` is caught — skipped would count as passed', () => {
  mentions(problemsOf(broken('    needs: [pr-state, guards, typecheck, eslint, unit-tests, db-replay]\n    if: ${{ always() }}\n', '    needs: [pr-state, guards, typecheck, eslint, unit-tests, db-replay]\n')), /must be `if: \$\{\{ always\(\) \}\}`/);
  mentions(problemsOf(broken('    if: ${{ always() }}\n    permissions:\n      contents: read\n      # Only to list', '    if: ${{ !cancelled() }}\n    permissions:\n      contents: read\n      # Only to list')), /must be `if:/);
});

test('a gate that reads a hand-picked subset, or runs nothing, is caught', () => {
  mentions(problemsOf(broken('NEEDS: ${{ toJSON(needs) }}', 'NEEDS: ${{ toJSON(needs.guards) }}')), /the whole list/);
  mentions(problemsOf(broken('        run: node scripts/ci-gate.mjs', '        run: echo ok')), /no longer runs `node scripts\/ci-gate\.mjs`/);
});

test('a gate that needs a job that does not exist is caught', () => {
  mentions(problemsOf(broken('needs: [pr-state, guards, typecheck,', 'needs: [pr-state, guards, typechek,')), /needs "typechek", which is not a job/);
});

test('a renamed or duplicated required name is caught', () => {
  mentions(problemsOf(broken('            lint nested forms=', '            lint forms nested=')), /required check "lint nested forms" is no longer the name of any job/);
  mentions(problemsOf(broken('    name: typecheck\n', '    name: typecheck + lint\n')), /"typecheck \+ lint" is reported by 2 places/);
  mentions(problemsOf(CI, webPackage, {}), /required check "lighthouse" is no longer/);
});

test('a step the split dropped is caught, one by one', () => {
  mentions(problemsOf(broken('        run: pnpm typecheck', '        run: echo skipped')), /the typecheck is not run/);
  mentions(problemsOf(broken('        run: pnpm lint\n', '        run: echo skipped\n')), /eslint is not run/);
  mentions(problemsOf(broken('        run: pnpm --filter @setnayan/web lint:dup-rule', '        run: echo skipped')), /duplicated-rule guards is not run/);
  mentions(problemsOf(broken('        run: node apps/web/scripts/check-ugat-screens.mjs', '        run: echo skipped')), /root map check is not run/);
  mentions(problemsOf(broken('test:db:ci 2>&1', 'test:db 2>&1')), /the DB replay is not run/);
  mentions(problemsOf(broken("echo 'One or more blocking guards failed.", "echo 'Guards said something.")), /aggregator is not run/);
});

test('🚨 a shard list with a hole in it is caught — a slice of the suite that never runs', () => {
  mentions(problemsOf(broken('shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]', 'shard: [1, 2, 3, 4, 5, 6, 7, 8, 9]')), /"db-replay": the shards are \[1, 2, 3, 4, 5, 6, 7, 8, 9\] but the flag deals the suite into 10/);
  mentions(problemsOf(broken('shard: [1, 2, 3]\n', 'shard: [1, 2, 4]\n')), /"unit-tests": the shards are/);
  mentions(problemsOf(broken('--test-shard=${{ matrix.shard }}/3', '--test-shard=${{ matrix.shard }}/4')), /deals the suite into 4/);
});

test('a shard job that cancels its siblings on the first failure is caught', () => {
  mentions(problemsOf(broken('      fail-fast: false\n      matrix:\n        shard: [1, 2, 3]', '      matrix:\n        shard: [1, 2, 3]')), /"unit-tests": `fail-fast: false` is missing/);
});

test('🚨 a piped test step without `shell: bash` is caught — the pipe would swallow a killed run', () => {
  mentions(problemsOf(broken('      - name: Unit tests\n        shell: bash\n', '      - name: Unit tests\n')), /"unit-tests": a step pipes through `tee` without `shell: bash`/);
});

test('🚨 the shard flag placed after the globs is caught — node ignores it there', () => {
  const pkg = { scripts: { ...webPackage.scripts, 'test:unit': 'tsx --test "lib/**/*.test.ts" "app/**/*.test.ts" $TEST_SHARD_FLAG' } };
  mentions(problemsOf(CI, pkg), /`test:unit` must read `tsx --test \$TEST_SHARD_FLAG/);
  const none = { scripts: { ...webPackage.scripts, 'test:db:ci': 'tsx --test "tests/db/*.db.test.ts"' } };
  mentions(problemsOf(CI, none), /`test:db:ci` must read/);
});

test('a needed job that can be skipped is caught', () => {
  mentions(problemsOf(broken('  eslint:\n    name: eslint\n', "  eslint:\n    name: eslint\n    if: ${{ github.event_name == 'pull_request' }}\n")), /"eslint" has a job-level `if:`/);
  mentions(problemsOf(broken('  eslint:\n    name: eslint\n', '  eslint:\n    name: eslint\n    needs: [typecheck]\n')), /"eslint" has its own `needs:`/);
});

/* ── draft PRs ──────────────────────────────────────────────────────────────*/

test('🚨 a DRAFT PR is red on the gate, even when every job it needs passed', () => {
  const allGreen = JSON.stringify({ guards: { result: 'success' }, typecheck: { result: 'success' } });
  assert.deepEqual(gateVerdict(allGreen, 'true'), { ok: false, rows: [], problems: [DRAFT_PR_PROBLEM] });
  assert.equal(gateVerdict(allGreen, 'false').ok, true, 'a ready PR is judged on its jobs');
  assert.equal(gateVerdict(allGreen, undefined).ok, true, 'push / workflow_dispatch: no pull request');
  const run = spawnSync(process.execPath, [path.join(HERE, 'ci-gate.mjs')], { env: { ...process.env, NEEDS: allGreen, PR_DRAFT: 'true', GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
  assert.equal(run.status, 1, 'the script exits red on a draft');
  assert.match(run.stdout, /Draft PR: checks not run\. Mark ready to test\./);
});

test('🚨 the gate that gets the draft clause is caught — it would SKIP on a draft, and skipped counts as passed', () => {
  mentions(problemsOf(broken('    if: ${{ always() }}\n', `    if: \${{ always() && ${DRAFT_CLAUSE} }}\n`)), /must be `if: \$\{\{ always\(\) \}\}`/);
  mentions(problemsOf(broken('    if: ${{ always() }}\n', `    if: \${{ ${DRAFT_CLAUSE} }}\n`)), /must be `if: \$\{\{ always\(\) \}\}`/);
});

test('🚨 a gate that is not told the PR is a draft is caught', () => {
  mentions(problemsOf(broken(/ {10}PR_DRAFT: \$\{\{ needs\.pr-state\.outputs\.draft \}\}\n/, '')), /must hand the script `PR_DRAFT:/);
});

test('the live draft clause is the ONLY job-level `if:` a gated job may carry, and `pr-state` its only need', () => {
  const live = `    name: typecheck\n    needs: ${LIVE_DRAFT_JOB}\n    if: \${{ ${LIVE_DRAFT_CLAUSE} }}\n`;
  assert.ok(CI.includes(live), 'typecheck skips drafts, read live');
  mentions(problemsOf(broken(live, `    name: typecheck\n    needs: ${LIVE_DRAFT_JOB}\n    if: \${{ needs.pr-state.outputs.draft != 'maybe' }}\n`)), /"typecheck" has a job-level `if:`/);
  mentions(problemsOf(broken(live, `    name: typecheck\n    needs: [${LIVE_DRAFT_JOB}, guards]\n    if: \${{ ${LIVE_DRAFT_CLAUSE} }}\n`)), /"typecheck" has its own `needs:`/);
  mentions(problemsOf(broken(live, `    name: typecheck\n    if: \${{ ${LIVE_DRAFT_CLAUSE} }}\n`)), /"typecheck" reads `needs\.pr-state\.outputs` but does not `needs: pr-state`/);
});

/* ── draft-or-ready is read LIVE (24 Nov 2026: #8252, #8259, #8261 sat BLOCKED with every check green) ──────────*/

test('🚨 ci.yml never decides draft-or-ready from the event payload — a re-run replays it, so a ready PR stays red', () => {
  const live = `    name: typecheck\n    needs: ${LIVE_DRAFT_JOB}\n    if: \${{ ${LIVE_DRAFT_CLAUSE} }}\n`;
  // the old shape, exactly as it shipped until 24 Nov
  mentions(problemsOf(broken(live, `    name: typecheck\n    if: \${{ ${DRAFT_CLAUSE} }}\n`)), /"typecheck" decides draft-or-ready from the event payload/);
  mentions(problemsOf(broken(/ {10}PR_DRAFT: \$\{\{ needs\.pr-state\.outputs\.draft \}\}\n/, '          PR_DRAFT: ${{ github.event.pull_request.draft == true }}\n')), /reads the event payload's draft flag/);
  // the production build is not gated, but it still may not read the payload
  const build = `    name: production build\n    needs: ${LIVE_DRAFT_JOB}\n    if: \${{ ${LIVE_DRAFT_CLAUSE} }}\n`;
  mentions(problemsOf(broken(build, `    name: production build\n    if: \${{ ${DRAFT_CLAUSE} }}\n`)), /reads the event payload's draft flag/);
  // a comment may still name it (the history is written there)
  assert.ok(/^\s*#.*github\.event\.pull_request\.draft/m.test(CI));
});

test('🚨 the live read exists, runs everywhere, asks the API, and a failed read is a red gate', () => {
  assert.deepEqual(problemsOf(CI), [], 'the real ci.yml is sound');
  const jobs = parseJobs(CI);
  const liveJob = jobs.find((j) => j.id === LIVE_DRAFT_JOB);
  assert.ok(liveJob, 'ci.yml has the pr-state job');
  assert.equal(liveJob.if, null);
  assert.deepEqual(liveJob.needs, []);
  assert.ok(jobs.find((j) => j.name === GATE_NAME).needs.includes(LIVE_DRAFT_JOB), 'the gate needs it');
  for (const id of ['typecheck', 'eslint', 'unit-tests', 'db-replay', 'build']) {
    const j = jobs.find((x) => x.id === id);
    assert.equal(j.if, `\${{ ${LIVE_DRAFT_CLAUSE} }}`, `${id} follows the live read`);
    assert.deepEqual(j.needs, [LIVE_DRAFT_JOB], `${id} waits on the live read and nothing else`);
  }
  mentions(problemsOf(broken('needs: [pr-state, guards,', 'needs: [guards,')), /must `needs: pr-state`/);
  mentions(problemsOf(broken(`  ${LIVE_DRAFT_JOB}:\n    name: draft or ready (read live)\n`, `  ${LIVE_DRAFT_JOB}:\n    name: draft or ready (read live)\n    if: \${{ github.event_name == 'pull_request' }}\n`)), /"pr-state" must have no `if:`/);
  mentions(problemsOf(broken('      contents: read\n      pull-requests: read\n    outputs:\n', '      contents: read\n    outputs:\n')), /must have `permissions: pull-requests: read`/);
  mentions(problemsOf(broken(`gh api "repos/$REPO/pulls/$PR_NUMBER" --jq '.draft'`, `echo "$EVENT_DRAFT"`)), /must read the flag from GitHub's API at run time/);
  mentions(problemsOf(broken('      draft: ${{ steps.live.outputs.draft }}\n', '')), /must output `draft`/);
  mentions(problemsOf(CI.replace(`  ${LIVE_DRAFT_JOB}:\n`, '  pr-state-renamed:\n')), /no job "pr-state" in ci\.yml/);
});

test('🚨 the live read fails closed: no answer → the job is red; only exact true/false are written', () => {
  const step = parseJobs(CI).find((j) => j.id === LIVE_DRAFT_JOB).steps.find((s) => /id: live/.test(s));
  assert.match(step, /\[ "\$draft" != "true" \] && \[ "\$draft" != "false" \][\s\S]*exit 1/, 'an unreadable flag exits 1');
  assert.match(step, /"\$EVENT_NAME" != "pull_request"[\s\S]*draft=false/, 'push / dispatch: every job runs');
  // a re-run of ONLY the gate replays the old answer — the script must say how to clear it honestly
  const allGreen = JSON.stringify({ guards: { result: 'success' } });
  const run = spawnSync(process.execPath, [path.join(HERE, 'ci-gate.mjs')], { env: { ...process.env, NEEDS: allGreen, PR_DRAFT: 'true', GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /Re-run all jobs/);
});

test('🚨 skipping drafts without `ready_for_review` is caught — a PR marked ready would keep only skipped checks', () => {
  const types = '    types: [opened, synchronize, reopened, ready_for_review]\n';
  assert.ok(CI.includes(types), 'ci.yml lists the four pull_request types');
  mentions(problemsOf(broken(types, '    types: [opened, synchronize, reopened]\n')), /ci\.yml: its jobs skip draft PRs[\s\S]*missing ready_for_review/);
  mentions(problemsOf(broken(types, '')), /ci\.yml: its jobs skip draft PRs/);
  for (const f of ['e2e.yml', 'lighthouse.yml']) {
    assert.ok(others[f].includes(DRAFT_CLAUSE) && others[f].includes(types), `${f} skips drafts and lists the four types`);
    mentions(problemsOf(CI, webPackage, { ...others, [f]: others[f].replace(types, '') }), new RegExp(`${f.replace('.', '\\.')}: its jobs skip draft PRs`));
  }
});

/* ── a run cancelled for a newer run on the SAME commit (#8252, run 45266185097) ───────────────────────────────*/

const ME = { runId: '100', headSha: 'abc123', headBranch: 'feat/x', prNumber: '42' };
const run = (o) => ({ id: 101, event: 'pull_request', head_sha: 'abc123', head_branch: 'feat/x', status: 'pending', pull_requests: [{ number: 42 }], html_url: 'https://example.test/run/101', ...o });

test('only a red made of "nothing finished" may defer — a real failure never does', () => {
  assert.equal(deferrable(JSON.stringify({ a: { result: 'success' }, b: { result: 'cancelled' }, c: { result: 'skipped' } })), true);
  assert.equal(deferrable(JSON.stringify({ a: { result: 'success' }, b: { result: 'skipped' } })), true, 'a draft run: heavy jobs skipped');
  assert.equal(deferrable(JSON.stringify({ a: { result: 'cancelled' }, b: { result: 'failure' } })), false, 'a failure stays red, superseded or not');
  assert.equal(deferrable(JSON.stringify({ a: {} })), false, 'a missing result is not "nothing finished"');
  assert.equal(deferrable('{}'), false);
  assert.equal(deferrable('not json'), false);
  assert.equal(deferrable(undefined), false);
});

test('🚨 the successor must be WAITING on the same commit, branch and PR — anything else is no successor', () => {
  for (const status of ['queued', 'pending', 'waiting', 'requested']) assert.equal(supersedingRun([run({ status })], ME)?.id, 101, status);
  assert.equal(supersedingRun([run({ status: 'in_progress' })], ME), null, 'in progress is not waiting behind this run — never defer to it');
  assert.equal(supersedingRun([run({ status: 'completed' })], ME), null, 'a finished run replaces nothing');
  assert.equal(supersedingRun([run({ id: 100 })], ME), null, 'this run is not its own successor');
  assert.equal(supersedingRun([run({ head_sha: 'def456' })], ME), null, 'another commit');
  assert.equal(supersedingRun([run({ head_branch: 'feat/y' })], ME), null, 'another branch');
  assert.equal(supersedingRun([run({ event: 'push' })], ME), null, 'not a pull_request run');
  assert.equal(supersedingRun([run({ pull_requests: [{ number: 7 }] })], ME), null, 'another PR');
  assert.equal(supersedingRun([run({ pull_requests: [] })], ME)?.id, 101, 'GitHub leaves pull_requests empty on some runs: branch + commit decide');
  assert.equal(supersedingRun(undefined, ME), null);
  assert.equal(supersedingRun([run()], { ...ME, runId: '' }), null, 'no run id → no lookup');
  assert.equal(supersedingRun([run()], { ...ME, headSha: '' }), null);
});

/** Run the real gate script against a stub GitHub that answers the runs lookup with `answer`. */
async function gateAgainst(env, answer) {
  const server = http.createServer((req, res) => {
    if (typeof answer === 'number') {
      res.writeHead(answer).end('nope');
      return;
    }
    assert.match(req.url, /^\/repos\/o\/r\/actions\/workflows\/ci\.yml\/runs\?head_sha=abc123&event=pull_request/);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ workflow_runs: answer }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = {
    NEEDS: JSON.stringify({ 'pr-state': { result: 'success' }, guards: { result: 'cancelled' }, typecheck: { result: 'cancelled' }, 'db-replay': { result: 'skipped' } }),
    PR_DRAFT: 'false', EVENT_NAME: 'pull_request', GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', RUN_ID: '100', HEAD_SHA: 'abc123', HEAD_BRANCH: 'feat/x', PR_NUMBER: '42',
    GITHUB_WORKFLOW_REF: 'o/r/.github/workflows/ci.yml@refs/pull/42/merge', GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`, GITHUB_STEP_SUMMARY: '',
  };
  const out = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(HERE, 'ci-gate.mjs')], { env: { PATH: process.env.PATH, ...base, ...env } });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.on('close', (status) => resolve({ status, stdout }));
  });
  server.close();
  return out;
}

test('🚨 end to end: a cancelled run with a successor WAITING on the same commit is green and names it', async () => {
  const r = await gateAgainst({}, [run()]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Superseded on the same commit[\s\S]*run 101/);
});

test('🚨 end to end: the gate stays RED when there is no successor, the lookup fails, or something really failed', async () => {
  assert.equal((await gateAgainst({}, [])).status, 1, 'nothing waiting → red');
  assert.equal((await gateAgainst({}, [run({ status: 'in_progress' })])).status, 1, 'nothing WAITING → red');
  const refused = await gateAgainst({}, 500);
  assert.equal(refused.status, 1, 'a refused lookup → red');
  assert.match(refused.stdout, /GitHub answered 500 — the gate stays red/);
  assert.equal((await gateAgainst({ GITHUB_TOKEN: '' }, [run()])).status, 1, 'no token → red');
  assert.equal((await gateAgainst({ EVENT_NAME: 'push' }, [run()])).status, 1, 'not a pull request → red');
  const failed = JSON.stringify({ guards: { result: 'failure' }, typecheck: { result: 'cancelled' } });
  assert.equal((await gateAgainst({ NEEDS: failed }, [run()])).status, 1, 'a real failure is never handed on');
});

test('a draft run replaced on the same commit defers too — the successor reads the draft flag live and decides', async () => {
  const draftRun = JSON.stringify({ 'pr-state': { result: 'success' }, guards: { result: 'success' }, typecheck: { result: 'skipped' } });
  assert.equal((await gateAgainst({ NEEDS: draftRun, PR_DRAFT: 'true' }, [run()])).status, 0);
  assert.equal((await gateAgainst({ NEEDS: draftRun, PR_DRAFT: 'true' }, [])).status, 1, 'with nobody replacing it a draft is red, as always');
});

test('🚨 a gate that cannot see the run replacing it is caught', () => {
  const gateBody = parseJobs(CI).find((j) => j.name === GATE_NAME).body;
  assert.match(gateBody, /^ {6}actions: read$/m);
  const gateAt = CI.indexOf('  typecheck-lint:\n');
  const noActions = CI.slice(0, gateAt) + CI.slice(gateAt).replace('      actions: read\n', '');
  mentions(problemsOf(noActions), /must have `permissions: actions: read`/);
  for (const [line, key] of [
    ['          RUN_ID: ${{ github.run_id }}\n', 'RUN_ID'],
    ['          HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n', 'HEAD_SHA'],
    ['          HEAD_BRANCH: ${{ github.head_ref }}\n', 'HEAD_BRANCH'],
    ['          EVENT_NAME: ${{ github.event_name }}\n', 'EVENT_NAME'],
    ['          GITHUB_TOKEN: ${{ github.token }}\n', 'GITHUB_TOKEN'],
  ]) {
    const cut = CI.slice(0, gateAt) + CI.slice(gateAt).replace(line, '');
    assert.notEqual(cut, CI, `the gate hands ${key}`);
    mentions(problemsOf(cut), new RegExp(`must hand the script \`${key}:`));
  }
});

/* ── a shard's log ──────────────────────────────────────────────────────────*/

const TAP = `TAP version 13
# Subtest: top fails
not ok 2 - top fails
  ---
  duration_ms: 1.4
  type: 'test'
  location: '/home/runner/work/x/x/apps/web/lib/a.test.ts:2:935'
  failureType: 'testCodeFailure'
  error: |-
    one is not two

    1 !== 2
  code: 'ERR_ASSERTION'
  stack: |-
    TestContext.<anonymous> (/home/runner/work/x/x/apps/web/lib/a.test.ts:4:34)
    Test.runInAsyncScope (node:async_hooks:214:14)
  ...
# Subtest: a suite
    # Subtest: child fails
    not ok 1 - child fails
      ---
      location: '/home/runner/work/x/x/apps/web/app/[slug]/b.test.ts:2:1073'
      failureType: 'testCodeFailure'
      error: 'child said no'
      stack: |-
        TestContext.<anonymous> (/home/runner/work/x/x/apps/web/app/[slug]/b.test.ts:5:62)
      ...
    ok 2 - child ok
    1..2
not ok 3 - a suite
  ---
  type: 'suite'
  location: '/home/runner/work/x/x/apps/web/app/[slug]/b.test.ts:2:1034'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  ...
1..3
# tests 4
# suites 1
# pass 2
# fail 2
`;

test('every failing LEAF is named with its message and its real line; a parent is not a second failure', () => {
  const s = summariseTap(TAP);
  assert.deepEqual([s.tests, s.pass, s.fail, s.ran], [4, 2, 2, true]);
  assert.deepEqual(s.failures, [
    { name: 'top fails', msg: 'one is not two', file: 'apps/web/lib/a.test.ts', line: 4 },
    { name: 'child fails', msg: 'child said no', file: 'apps/web/app/[slug]/b.test.ts', line: 5 },
  ]);
});

test('🚨 a log with no total, or a total of zero, did NOT run', () => {
  assert.equal(summariseTap('').ran, false);
  assert.equal(summariseTap('TAP version 13\nok 1 - a\n').ran, false, 'killed before the total was printed');
  assert.equal(summariseTap('1..0\n# tests 0\n# pass 0\n# fail 0\n').ran, false, '"0 tests, 0 failures" is not a pass');
  assert.equal(summariseTap('# tests 12\n# pass 12\n# fail 0\n').ran, true);
});

test('the summary script fails a shard that ran nothing, and passes one that ran', () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? '/tmp'), 'ci-summary-'));
  const run = (content) => {
    const file = path.join(dir, 'log.txt');
    if (content === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, content);
    return spawnSync(process.execPath, [path.join(HERE, 'ci-test-summary.mjs'), file, 'unit tests 1/3'], { env: { ...process.env, GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8' });
  };
  try {
    assert.equal(run('# tests 12\n# pass 12\n# fail 0\n').status, 0);
    const failing = run(TAP);
    assert.equal(failing.status, 0, 'the test step carries the failure; this step only names it');
    assert.match(failing.stdout, /::error file=apps\/web\/lib\/a\.test\.ts,line=4,title=unit tests 1\/3 · top fails::top fails — one is not two/);
    assert.match(failing.stdout, /child fails — child said no/);
    assert.equal(run('# tests 0\n# pass 0\n# fail 0\n').status, 1);
    assert.equal(run('TAP version 13\nok 1 - a\n').status, 1);
    const missing = run(null);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /left no log/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
