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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateVerdict, shapeProblems, parseJobs, summariseTap, REQUIRED_CONTEXTS, GATE_NAME } from './lib/ci-shape.mjs';

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

test('all 13 required names are each the name of exactly one job', () => {
  assert.equal(REQUIRED_CONTEXTS.length, 13);
  assert.equal(new Set(REQUIRED_CONTEXTS).size, 13);
  const names = [...parseJobs(CI), ...Object.values(others).flatMap((t) => parseJobs(t))].map((j) => j.name);
  for (const ctx of REQUIRED_CONTEXTS) assert.equal(names.filter((n) => n === ctx).length, 1, ctx);
});

test('the gate stands for every job that is not required under its own name', () => {
  const jobs = parseJobs(CI);
  const gate = jobs.find((j) => j.name === GATE_NAME);
  assert.equal(gate.id, 'typecheck-lint');
  const mustBeNeeded = jobs.filter((j) => j !== gate && !REQUIRED_CONTEXTS.includes(j.name)).map((j) => j.id);
  assert.ok(mustBeNeeded.length >= 6, `only ${mustBeNeeded.length} gated jobs — the reader is looking at the wrong thing`);
  assert.deepEqual([...gate.needs].sort(), [...mustBeNeeded].sort());
});

/* ── the workflow, broken one way at a time ─────────────────────────────────*/

test('🚨 a job left out of the gate is caught — it would block nothing', () => {
  mentions(problemsOf(broken('needs: [guards, typecheck, eslint, unit-tests, db-replay, source-guards]', 'needs: [guards, typecheck, eslint, unit-tests, source-guards]')), /"db-replay".*not in the gate's `needs:`/);
});

test('a NEW job nobody needs is caught', () => {
  const ci = broken('  build:\n    name: production build', '  shiny-new-check:\n    name: shiny new check\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n\n  build:\n    name: production build');
  mentions(problemsOf(ci), /"shiny-new-check".*would merge anyway/);
});

test('🚨 the gate without `if: always()` is caught — skipped would count as passed', () => {
  mentions(problemsOf(broken('    needs: [guards, typecheck, eslint, unit-tests, db-replay, source-guards]\n    if: ${{ always() }}\n', '    needs: [guards, typecheck, eslint, unit-tests, db-replay, source-guards]\n')), /must be `if: \$\{\{ always\(\) \}\}`/);
  mentions(problemsOf(broken('    if: ${{ always() }}\n    steps:\n      - uses: actions/checkout@v4\n', '    if: ${{ !cancelled() }}\n    steps:\n      - uses: actions/checkout@v4\n')), /must be `if:/);
});

test('a gate that reads a hand-picked subset, or runs nothing, is caught', () => {
  mentions(problemsOf(broken('NEEDS: ${{ toJSON(needs) }}', 'NEEDS: ${{ toJSON(needs.guards) }}')), /the whole list/);
  mentions(problemsOf(broken('        run: node scripts/ci-gate.mjs', '        run: echo ok')), /no longer runs `node scripts\/ci-gate\.mjs`/);
});

test('a gate that needs a job that does not exist is caught', () => {
  mentions(problemsOf(broken('needs: [guards, typecheck,', 'needs: [guards, typechek,')), /needs "typechek", which is not a job/);
});

test('a renamed or duplicated required name is caught', () => {
  mentions(problemsOf(broken('    name: lint nested forms', '    name: lint forms nested')), /required check "lint nested forms" is no longer the name of any job/);
  mentions(problemsOf(broken('    name: typecheck\n', '    name: typecheck + lint\n')), /is the name of 2 jobs/);
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
  mentions(problemsOf(broken('shard: [1, 2, 3, 4, 5, 6]', 'shard: [1, 2, 3, 4, 5]')), /"db-replay": the shards are \[1, 2, 3, 4, 5\] but the flag deals the suite into 6/);
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
