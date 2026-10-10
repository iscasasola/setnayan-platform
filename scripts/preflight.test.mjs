/**
 * Unit tests for preflight's pure half (scripts/lib/preflight-core.mjs).
 *
 * Pure node, no install:   node --test scripts/preflight.test.mjs
 *
 * THE ONE THAT MATTERS IS THE FIRST. preflight derives "what CI runs cheaply"
 * from ci.yml itself, so it can only stay honest if every step of that file is
 * something it understands. A CI step nobody classified would be a check that
 * runs on GitHub and not on the builder's machine — the exact gap preflight
 * exists to close — so this test turns red on it, in the PR that adds it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseWorkflow,
  countRunKeys,
  classifyStep,
  inventory,
  cheapCommands,
  needlesFor,
  testArg,
  resolveImport,
  buildImporters,
  importersOf,
  testsReaching,
  treeWalkingTests,
  replayBackedTests,
  testsNaming,
  firstFailingLine,
  firstEslintError,
  failureLine,
  regenerateHint,
  SCHEMA_PIN_RE,
} from './lib/preflight-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CI = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');

/* ── the real workflow ──────────────────────────────────────────────────────*/

test('every step of ci.yml is classified — a new CI step must say what preflight does with it', () => {
  const unknown = inventory(CI).filter((s) => s.tier === 'unknown');
  assert.deepEqual(
    unknown.map((s) => `${s.jobName} › ${s.step} › ${s.run}`),
    [],
    'ci.yml has a step preflight does not understand, so builders would meet it for the first time on GitHub.\n' +
      'Classify it in classifyStep (scripts/lib/preflight-core.mjs): cheap = runs as written; medium = say which\n' +
      'targeted version preflight runs; heavy = left to CI and named as such.',
  );
});

test('no `run:` line of ci.yml is lost by the reader', () => {
  const parsed = parseWorkflow(CI).filter((s) => s.run !== null).length;
  assert.equal(parsed, countRunKeys(CI), 'parseWorkflow saw a different number of run: steps than the file holds — its shape changed');
  assert.ok(parsed >= 40, `only ${parsed} run steps were read — the reader is looking at the wrong thing`);
});

test('the cheap set is not silently empty, and holds the guards that failed PRs on 2026-10-08', () => {
  const cheap = cheapCommands(CI).map((c) => c.run);
  assert.ok(cheap.length >= 35, `only ${cheap.length} cheap commands — the classifier stopped recognising guard steps`);
  for (const must of ['lint:dup-rule', 'check-ugat-screens.mjs', 'lint-port-no-lost-controls.mjs', 'lint-no-card.mjs', 'lint-server-action-budget.mjs', 'check-migration-timestamps.mjs', 'lint-exposure-baseline.mjs', 'lint-nested-forms.mjs', 'lint-bottom-nav.mjs', 'lint-entitlement-gates.mjs', 'lint-guest-legibility.mjs', 'lint-nav-icon-source.mjs']) {
    assert.ok(cheap.some((c) => c.includes(must)), `${must} is a CI step and must be in preflight's cheap set`);
  }
});

test('a step that needs a production build is never offered as cheap', () => {
  const cheap = cheapCommands(CI).map((c) => c.run).join('\n');
  for (const needsBuild of ['check-vercel-route-count', 'check-maker-js-budget', 'bundle-size-check']) {
    assert.ok(!cheap.includes(needsBuild), `${needsBuild} reads .next — running it without a build proves nothing`);
  }
});

test('the heavy steps are named, so a green preflight cannot be read as a full pass', () => {
  const inv = inventory(CI);
  const tierOf = (re) => inv.find((s) => re.test(s.run ?? ''))?.tier;
  assert.equal(tierOf(/pnpm typecheck/), 'medium');
  assert.equal(tierOf(/^pnpm lint/), 'medium');
  assert.equal(tierOf(/test:unit/), 'medium');
  assert.equal(tierOf(/test:db:ci/), 'medium');
  assert.equal(tierOf(/@setnayan\/web build/), 'heavy');
  for (const s of inv.filter((x) => x.tier === 'medium')) assert.ok(s.local, `${s.step}: a medium step must say which targeted version runs locally`);
});

/* ── the reader, on shapes it must not get wrong ────────────────────────────*/

const SAMPLE = `name: x
on: push
jobs:
  one:
    name: first job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: A guard
        id: g
        continue-on-error: true
        working-directory: apps/web
        run: node scripts/lint-a.mjs
      # a comment that says run: pnpm typecheck
      - name: Gate
        if: always()
        run: |
          failed=0
          echo "node is only a word here"
          exit $failed
      - run: pnpm --filter @setnayan/web build
      - name: Mystery
        run: ./do-something.sh --now
  build:
    name: production build
    steps:
      - name: Count
        run: node apps/web/scripts/check-vercel-route-count.mjs
`;

test('the reader keeps job, name, cwd and block bodies apart', () => {
  const steps = parseWorkflow(SAMPLE);
  assert.equal(steps.length, 6);
  const guard = steps.find((s) => s.step === 'A guard');
  assert.deepEqual([guard.job, guard.jobName, guard.cwd, guard.run, guard.block], ['one', 'first job', 'apps/web', 'node scripts/lint-a.mjs', false]);
  const gate = steps.find((s) => s.step === 'Gate');
  assert.equal(gate.block, true);
  assert.match(gate.run, /^failed=0\necho/);
  assert.equal(steps.filter((s) => /typecheck/.test(s.run ?? '')).length, 0, 'a comment naming a command is not a step');
  assert.equal(countRunKeys(SAMPLE), 5);
});

test('classification: cheap as written, plumbing ignored, a build-reader heavy, the unknown named', () => {
  const by = Object.fromEntries(parseWorkflow(SAMPLE).map((s) => [s.step, classifyStep(s).tier]));
  assert.equal(by['A guard'], 'cheap');
  assert.equal(by['Gate'], 'infra', 'a shell block that only mentions the word node is plumbing');
  assert.equal(by['Count'], 'heavy', 'the same script shape, but it reads a build');
  assert.equal(by['Mystery'], 'unknown');
  assert.equal(classifyStep({ job: 'x', run: 'failed=0\npnpm --filter web test:unit\nexit 0', block: true }).tier, 'medium');
  assert.equal(classifyStep({ job: 'x', run: 'set -e\nnode scripts/new-thing.mjs', block: true }).tier, 'unknown', 'a block that runs a tool must be classified by a person');
  assert.equal(classifyStep({ job: 'x', run: 'RADIUS_LINT_STRICT=1 node apps/web/scripts/lint-radius.mjs', block: false }).tier, 'cheap');
  assert.equal(classifyStep({ job: 'x', run: 'cd apps/web && node scripts/lint-x.mjs', block: false }).tier, 'cheap');
  assert.equal(classifyStep({ job: 'x', run: 'node --test scripts/x.test.mjs', block: false }).tier, 'cheap');
  assert.equal(classifyStep({ job: 'x', run: 'node scripts/x.mjs && rm -rf .', block: false }).tier, 'unknown', 'only a bare node command runs unreviewed');
});

test('a cheap command keeps its working-directory instead of a rewritten path', () => {
  assert.deepEqual(cheapCommands(SAMPLE), [{ title: 'A guard', run: 'node scripts/lint-a.mjs', cwd: 'apps/web', job: 'first job' }]);
});

/* ── which tests a change wakes ─────────────────────────────────────────────*/

test('a needle is a path tail — distinctive names alone, generic names with their folder', () => {
  assert.deepEqual(needlesFor('apps/web/app/dashboard/[eventId]/budget/_components/budget-screen.tsx'), ['budget-screen.tsx']);
  assert.deepEqual(needlesFor('apps/web/app/dashboard/[eventId]/budget/page.tsx'), ['budget/page.tsx']);
  assert.deepEqual(needlesFor('apps/web/app/dashboard/[eventId]/page.tsx'), ['dashboard/[eventId]/page.tsx'], 'a dynamic segment names nothing — its parent is taken too');
  assert.deepEqual(needlesFor('apps/web/app/(marketing)/page.tsx'), ['app/(marketing)/page.tsx']);
  assert.deepEqual(needlesFor('apps/web/lib/guests.ts'), ['guests.ts'], 'never the bare word "guests"');
  assert.deepEqual(needlesFor('apps/web/lib/a.ts'), ['lib/a.ts'], 'a very short name needs its folder');
  assert.deepEqual(needlesFor('supabase/migrations/20271266228704_wish_list.sql'), ['20271266228704_wish_list.sql', '20271266228704']);
});

test('a bracketed path becomes a pattern that still matches the file', () => {
  const arg = testArg('app/dashboard/[eventId]/guests/x.test.ts');
  assert.equal(arg, 'app/dashboard/?eventId?/guests/x.test.ts');
  assert.ok(!/[[\]]/.test(arg), 'a bracket is a character class to the test runner and matches nothing');
  assert.equal(testArg('lib/plain.test.ts'), 'lib/plain.test.ts');
});

const TREE = new Map([
  ['lib/money.ts', "export const php = (n: number) => `₱${n}`;"],
  ['lib/index.ts', "export { php } from './money';\nexport * from './other';"],
  ['lib/other.ts', 'export const o = 1;'],
  ['lib/money.test.ts', "import { php } from './money';\ntest('x', () => {});"],
  ['app/shop/page.tsx', "import { php } from '@/lib';\nexport default function P() { return null }"],
  ['app/shop/price.tsx', "import { php } from '@/lib/money';"],
  ['app/shop/lazy.tsx', "const m = await import('../../lib/money');"],
  ['lib/scan.ts', "import fs from 'node:fs';\nexport const walk = (d: string) => fs.readdirSync(d);"],
  ['lib/no-bare-number.test.ts', "import { walk } from './scan';\ntest('scan', () => { walk('app') });"],
  ['lib/own-walk.test.ts', "import { readdirSync } from 'node:fs';\ntest('w', () => readdirSync('.'));"],
  ['lib/runs-a-guard.test.ts', "import { execFileSync } from 'node:child_process';\ntest('g', () => execFileSync('node', ['scripts/lint-x.mjs']));"],
  ['lib/pins-a-file.test.ts', "const src = read('app/shop/price.tsx');\ntest('p', () => {});"],
  ['lib/unrelated.test.ts', "test('u', () => {});"],
  ['tests/db/replay-migrations.ts', "import fs from 'node:fs';\nexport const replay = () => fs.readdirSync('supabase/migrations');"],
  ['lib/metering.test.ts', "import { replay } from '../tests/db/replay-migrations';\ntest('m', () => replay());"],
  ['tests/db/enum.db.test.ts', "import { replay } from './replay-migrations';\nimport { readdirSync } from 'node:fs';"],
]);

test('imports resolve through @/, relative paths, index files and dynamic import()', () => {
  const known = new Set(TREE.keys());
  assert.equal(resolveImport('@/lib/money', 'app/shop/price.tsx', known), 'lib/money.ts');
  assert.equal(resolveImport('@/lib', 'app/shop/page.tsx', known), 'lib/index.ts');
  assert.equal(resolveImport('./money', 'lib/money.test.ts', known), 'lib/money.ts');
  assert.equal(resolveImport('react', 'lib/money.ts', known), null);
});

test('importers follow a barrel, so a type changed behind a re-export reaches its callers', () => {
  const graph = buildImporters(TREE);
  const imps = importersOf(['lib/money.ts'], graph);
  assert.deepEqual([...imps].sort(), ['app/shop/lazy.tsx', 'app/shop/page.tsx', 'app/shop/price.tsx', 'lib/index.ts', 'lib/money.test.ts']);
});

test('a test two imports away is reached; three away is not; a test is never walked through', () => {
  const tree = new Map([
    ['lib/core.ts', 'export const c = 1;'],
    ['lib/mid.ts', "import { c } from './core';"],
    ['lib/far.ts', "import { m } from './mid';"],
    ['lib/core.test.ts', "import { c } from './core';"],
    ['lib/mid.test.ts', "import { m } from './mid';"],
    ['lib/far.test.ts', "import { f } from './far';"],
    ['lib/through-a-test.test.ts', "import './core.test';"],
  ]);
  const reach = testsReaching(['lib/core.ts'], buildImporters(tree), 2);
  assert.deepEqual([...reach].sort(), [['lib/core.test.ts', 1], ['lib/mid.test.ts', 2]]);
});

test('whole-tree guards are discovered three ways — and a replay-backed test is not one of them', () => {
  const graph = buildImporters(TREE);
  const walkers = treeWalkingTests(TREE, graph);
  assert.ok(walkers.has('lib/own-walk.test.ts'), 'walks a directory itself');
  assert.ok(walkers.has('lib/no-bare-number.test.ts'), 'imports a helper that walks');
  assert.ok(walkers.has('lib/runs-a-guard.test.ts'), 'runs a guard script');
  assert.ok(!walkers.has('lib/unrelated.test.ts'));
  assert.ok(!walkers.has('lib/pins-a-file.test.ts'));
  assert.ok(!walkers.has('lib/metering.test.ts'), 'the DB harness walks migrations, not the app');
  assert.deepEqual([...replayBackedTests(TREE, graph)], ['lib/metering.test.ts']);
});

test('a test that names a changed file is woken — and only by a path tail', () => {
  const hits = testsNaming(['apps/web/app/shop/price.tsx'], TREE);
  assert.deepEqual([...hits.keys()], ['lib/pins-a-file.test.ts']);
  assert.equal(testsNaming(['apps/web/lib/other.ts'], TREE).size, 0);
  // a DELETED file still wakes the test that names it — that test is now wrong
  assert.equal(testsNaming(['apps/web/app/shop/price.tsx'], TREE).get('lib/pins-a-file.test.ts'), 'price.tsx');
});

test('the schema pins compare the whole schema with a committed file — not every test that reads the catalogue', () => {
  assert.match("readFileSync('tests/db/user-fk-behaviour.generated.txt')", SCHEMA_PIN_RE);
  assert.match("join(HERE, 'ugat-concept.baseline.txt')", SCHEMA_PIN_RE);
  assert.match("import { UGAT_TYPES } from '@/lib/ugat/graph'", SCHEMA_PIN_RE);
  assert.match("import { exposureFacts } from './exposure-surface'", SCHEMA_PIN_RE);
  // a test that looks one of its own tables up in the catalogue is not moved by a migration elsewhere
  assert.doesNotMatch('select 1 from information_schema.columns where table_name = $1', SCHEMA_PIN_RE);
  assert.doesNotMatch("select has_table_privilege('anon', 'public.guests', 'select')", SCHEMA_PIN_RE);
  assert.doesNotMatch("insert into guests (display_name) values ('x')", SCHEMA_PIN_RE);
});

/* ── reading a result ───────────────────────────────────────────────────────*/

test('the first failing line is the one that says what is wrong', () => {
  assert.equal(firstFailingLine('> @setnayan/web lint:dup-rule\n\nscanning…\nFAIL · 18 NEW hand-typed select(s) drop a column\n  app/x.tsx'), 'FAIL · 18 NEW hand-typed select(s) drop a column');
  assert.equal(firstFailingLine("lib/a.test.ts(204,39): error TS2769: No overload matches this call."), 'lib/a.test.ts(204,39): error TS2769: No overload matches this call.');
  assert.equal(firstFailingLine(''), '(no output)');
  assert.equal(firstFailingLine('something odd happened'), 'something odd happened');
});

test('a failing guard is reported by the FILE that broke it, not by the paragraph that explains the rule', () => {
  // the real shapes of 2026-10-08, as the reporter hands them over
  const commas = 'A number a person reads is printed without its commas. Route it through `formatCount` (lib/format-number.ts) — or, for money, `formatPhp`. ⏎ app/dashboard/[eventId]/budget/_components/budget-screen.tsx:187 [jsx/name] count ⏎ 1 !== 0';
  const line = failureLine('T4 · every raw quantity render is formatted', commas);
  assert.match(line, /^T4 · every raw quantity render is formatted — A number a person reads/);
  assert.match(line, /→ app\/dashboard\/\[eventId\]\/budget\/_components\/budget-screen\.tsx:187 \[jsx\/name\] count/);

  const style = "a formal surface composes a name without the event’s Name style ⏎ + actual - expected ⏎ + [ ⏎ +   'app/dev/guests-lab/page.tsx:446  guestFullName(…) has no style' ⏎ + ]";
  assert.equal(failureLine('every formal surface hands its name builder the event’s Name style', style), 'every formal surface hands its name builder the event’s Name style — a formal surface composes a name without the event’s Name style — → app/dev/guests-lab/page.tsx:446  guestFullName(…) has no style');

  const peso = 'Undeclared peso figure(s) in public source: ⏎ app/dev/supplier-lab/page.tsx → ₱2,500 ⏎ Prices are admin-managed and drift.';
  assert.match(failureLine('every peso figure in a public surface is declared', peso), /→ app\/dev\/supplier-lab\/page\.tsx → ₱2,500$/);

  const ends = 'A connection is missing one of its ends. Both halves may be built; the join is not: ⏎ [supplier] component-no-mount  app/vendor-dashboard/_components/first-steps.tsx ⏎ no runtime importer';
  assert.match(failureLine('every connection has both ends', ends), /→ \[supplier\] component-no-mount {2}app\/vendor-dashboard\/_components\/first-steps\.tsx$/);

  // no file in the message: the first line, and nothing invented
  assert.equal(failureLine('adds up', 'one is not two ⏎ 1 !== 2'), 'adds up — one is not two');
  assert.equal(failureLine('crashed on load', ''), 'crashed on load');
  assert.ok(failureLine('x', 'y '.repeat(900)).length <= 420);
  assert.equal(failureLine('n'.repeat(600), `why ⏎ app/a/${'b'.repeat(300)}.tsx:1 here`).length, 420, 'a long name and a long path are cut, never the table');
});

test('an eslint finding is reported with its file', () => {
  const out = '\n./lib/a-reload-returns-to-the-same-place.test.ts\n204:7  Error: Do not pass children as props. Instead, nest children between the opening and closing tags.  react/no-children-prop\n';
  assert.equal(firstEslintError(out), './lib/a-reload-returns-to-the-same-place.test.ts:204:7 Do not pass children as props. Instead, nest children between the opening and closing tags.  react/no-children-prop');
});

test('a stale generated file is answered with its generator, never a hand-merge', () => {
  assert.match(regenerateHint('node apps/web/scripts/check-ugat-screens.mjs'), /ugat:screens/);
  assert.match(regenerateHint('tests/db/user-fk-behaviour.db.test.ts'), /UPDATE_FK_BEHAVIOUR=1/);
  assert.match(regenerateHint('tests/db/exposure-freeze.db.test.ts'), /exposure:baseline/);
  assert.match(regenerateHint('pnpm --filter @setnayan/web lint:dup-rule'), /never add a baseline line/);
  assert.equal(regenerateHint('node apps/web/scripts/lint-email-links.mjs'), null);
});
