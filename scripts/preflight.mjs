#!/usr/bin/env node
/**
 * preflight — run this BEFORE EVERY PUSH.            pnpm preflight
 *
 * WHY IT EXISTS (owner, 2026-10-08): "we create locally, then when you go to
 * github you do not make it properly and we end up repeating again."
 *
 * Measured the same day: one CI round was ~80 minutes, the required job stopped
 * at its FIRST failing step, and seven draft PRs each failed it for a one-line
 * mechanical fault — a bare number, a hand-typed select, a `children` prop, a
 * word, a typed peso figure. PR #6416 took three rounds (about four hours) for
 * two one-line faults, because the first hid the second. Nobody ran the suite
 * locally, because the full suite does not fit on this machine. So GitHub was
 * where faults were found: one per 80 minutes.
 *
 * WHAT IT DOES. It reads `.github/workflows/ci.yml` and, for the branch's
 * CHANGED files (vs origin/main, plus anything uncommitted):
 *   · runs EVERY cheap guard step of CI, exactly as CI words it;
 *   · runs eslint on the changed files;
 *   · type-checks the changed files and the files that import them;
 *   · runs the unit tests that name or import a changed file;
 *   · runs every whole-tree guard test (the ones that walk app/ and lib/);
 *   · runs the DB tests that scan source — and, when a migration changed, the
 *     ones that pin the schema.
 * It never stops at the first failure. It ends with ONE table and exits
 * non-zero if anything failed.
 *
 * WHAT IT IS NOT. It is not CI. The full typecheck, the full unit suite, the
 * full DB replay, the production build, Lighthouse and the e2e run are LEFT TO
 * CI and the table says so every time. A green preflight means "the cheap
 * faults are gone", never "this will merge".
 *
 * It takes no heavy lock: nothing here is a full `tsc`, a build or a full
 * suite. `--jobs` bounds how many test files run at once (default 4).
 *
 *   node scripts/preflight.mjs                  the normal run
 *   node scripts/preflight.mjs --base <ref>     a stacked branch: diff against its parent
 *   node scripts/preflight.mjs --list           say what would run; run nothing
 *   node scripts/preflight.mjs --inventory      every CI step and its tier
 *   node scripts/preflight.mjs --inventory --run <id>   …with seconds from a real run (needs gh)
 */

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  inventory,
  cheapCommands,
  buildImporters,
  importersOf,
  treeWalkingTests,
  replayBackedTests,
  testsNaming,
  testArg,
  isTestFile,
  isDbTest,
  isUnitTest,
  SCHEMA_PIN_RE,
  firstFailingLine,
  firstEslintError,
  regenerateHint,
  fmtMs,
} from './lib/preflight-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTER = pathToFileURL(path.join(HERE, 'lib', 'preflight-reporter.mjs')).href;

/* ── arguments ──────────────────────────────────────────────────────────────*/

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
if (flag('--help') || flag('-h')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const BASE = opt('--base', 'origin/main');
const JOBS = Math.max(1, Number(opt('--jobs', Math.min(4, Math.max(2, Math.floor(os.cpus().length / 2))))));
const PHASES = ['guards', 'lint', 'types', 'unit', 'db'];
const ONLY = opt('--only', null)?.split(',').map((x) => x.trim()).filter(Boolean) ?? null;
if (ONLY && ONLY.some((p) => !PHASES.includes(p))) {
  console.error(`preflight: --only takes ${PHASES.join(',')} (got ${ONLY.join(',')})`);
  process.exit(2);
}
const want = (phase) => !ONLY || ONLY.includes(phase);
/** Importers handed to the targeted compile. Above this the closure is most of the app. */
const TSC_IMPORTER_CAP = 40;
const TSC_HEAP_MB = 3072;
/** Tests woken by a changed file. A change to a core module can name hundreds. */
const PIN_CAP = 400;

/* ── where we are ───────────────────────────────────────────────────────────*/

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

let ROOT;
try {
  ROOT = git(['rev-parse', '--show-toplevel']);
} catch {
  console.error('preflight: not inside a git checkout.');
  process.exit(2);
}
const WEB = path.join(ROOT, 'apps', 'web');
const CI_YML = path.join(ROOT, '.github', 'workflows', 'ci.yml');
if (!fs.existsSync(CI_YML) || !fs.existsSync(path.join(WEB, 'package.json'))) {
  console.error(`preflight: ${ROOT} is not a setnayan-platform checkout (no .github/workflows/ci.yml or apps/web).`);
  console.error('  Run it from inside your worktree. A scratch directory under ~ resolves to the home checkout.');
  process.exit(2);
}
const ciText = fs.readFileSync(CI_YML, 'utf8');

/* ── --inventory ────────────────────────────────────────────────────────────*/

if (flag('--inventory')) {
  const steps = inventory(ciText);
  const runId = opt('--run', null);
  const seconds = new Map();
  if (runId) {
    const json = JSON.parse(execFileSync('gh', ['run', 'view', runId, '--json', 'jobs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    for (const j of json.jobs) {
      for (const st of j.steps ?? []) {
        if (!st.startedAt || !st.completedAt) continue;
        seconds.set(`${j.name}::${st.name}`, Math.round((new Date(st.completedAt) - new Date(st.startedAt)) / 1000));
      }
    }
  }
  console.log(`| job | step | tier | ${runId ? 'seconds | ' : ''}what preflight does |`);
  console.log(`|---|---|---|${runId ? '--:|' : ''}---|`);
  for (const s of steps) {
    if (s.tier === 'infra') continue;
    const sec = runId ? `${lookupSeconds(seconds, s) ?? '—'} | ` : '';
    const does = s.tier === 'cheap' ? 'runs it as written' : s.tier === 'unknown' ? 'UNCLASSIFIED' : s.tier === 'medium' ? `targeted: ${s.local} (the full step is left to CI)` : `left to CI — ${s.why}`;
    console.log(`| ${s.jobName} | ${s.step} | ${s.tier.toUpperCase()} | ${sec}${does} |`);
  }
  process.exit(steps.some((s) => s.tier === 'unknown') ? 1 : 0);
}

function lookupSeconds(seconds, s) {
  // a matrix job reports as "name (1)", "name (2)" … — take the slowest leg
  let best = null;
  for (const [k, v] of seconds) {
    const [job, step] = k.split('::');
    if (step !== s.step && step !== `Run ${s.step}`) continue;
    if (job === s.jobName || job.startsWith(`${s.jobName} (`)) best = Math.max(best ?? 0, v);
  }
  return best;
}

/* ── what changed ───────────────────────────────────────────────────────────*/

let mergeBase;
try {
  mergeBase = git(['merge-base', BASE, 'HEAD'], ROOT);
} catch {
  console.error(`preflight: cannot find ${BASE}. Run \`git fetch origin\` first, or pass --base <ref>.`);
  process.exit(2);
}
const head = git(['rev-parse', '--short=9', 'HEAD'], ROOT);
const branch = (() => {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], ROOT);
  } catch {
    return '(detached)';
  }
})();

const changedSet = new Set();
const deletedSet = new Set();
const takeStatus = (out) => {
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [status, file] = line.split('\t');
    if (status.startsWith('D')) deletedSet.add(file);
    else changedSet.add(file);
  }
};
takeStatus(git(['diff', '--name-status', '--no-renames', mergeBase, 'HEAD'], ROOT));
takeStatus(git(['diff', '--name-status', '--no-renames', 'HEAD'], ROOT));
for (const f of git(['ls-files', '--others', '--exclude-standard'], ROOT).split('\n')) if (f.trim()) changedSet.add(f.trim());
for (const f of [...changedSet]) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    changedSet.delete(f);
    deletedSet.add(f);
  }
}
for (const f of changedSet) deletedSet.delete(f);
const changed = [...changedSet].sort();
const deleted = [...deletedSet].sort();
const touched = [...changed, ...deleted];

const inWeb = (f) => f.startsWith('apps/web/');
const webRel = (f) => f.slice('apps/web/'.length);
const changedWeb = changed.filter(inWeb).map(webRel);
const touchedMigration = touched.some((f) => f.startsWith('supabase/'));
const touchedDbHarness = touched.some((f) => f.startsWith('apps/web/tests/db/') && !f.endsWith('.db.test.ts'));
const touchedWebSource = touched.some((f) => inWeb(f) && !f.startsWith('apps/web/tests/db/'));
const touchedRust = touched.some((f) => f.startsWith('src-tauri/'));
/** A tool's binary: the web app's own copy first, then the workspace root's (tsx lives at the root). */
function bin(name) {
  for (const dir of [path.join(WEB, 'node_modules', '.bin'), path.join(ROOT, 'node_modules', '.bin')]) {
    if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}
const hasModules = Boolean(bin('tsx') && bin('tsc') && bin('next'));

/* ── the source tree, read once ─────────────────────────────────────────────*/

const SOURCE_DIRS = ['app', 'lib', 'components', 'tests', 'scripts', 'types'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'public']);
function readSources() {
  const sources = new Map();
  const walk = (dirAbs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dirAbs, e.name), `${rel}/${e.name}`);
      } else if (/\.(ts|tsx|mts)$/.test(e.name)) {
        sources.set(`${rel}/${e.name}`, fs.readFileSync(path.join(dirAbs, e.name), 'utf8'));
      }
    }
  };
  for (const d of SOURCE_DIRS) walk(path.join(WEB, d), d);
  for (const e of fs.readdirSync(WEB, { withFileTypes: true })) {
    if (e.isFile() && /\.(ts|tsx|mts)$/.test(e.name)) sources.set(e.name, fs.readFileSync(path.join(WEB, e.name), 'utf8'));
  }
  return sources;
}

const t0 = Date.now();
const sources = readSources();
const graph = buildImporters(sources);
const changedTsWeb = changedWeb.filter((f) => /\.(ts|tsx|mts)$/.test(f) && sources.has(f));
const importers = importersOf(changedTsWeb, graph);
const walkers = treeWalkingTests(sources, graph);
const naming = testsNaming(touched, sources);

/* tests a changed file wakes up: changed tests, tests that import it, tests that name it */
const pinned = new Map();
for (const f of changedTsWeb) if (isTestFile(f)) pinned.set(f, 'changed');
for (const f of importers) if (isTestFile(f) && !pinned.has(f)) pinned.set(f, 'imports a changed file');
for (const [f, needle] of naming) if (!pinned.has(f)) pinned.set(f, `names ${needle}`);

const unitPinsAll = [...pinned.keys()].filter(isUnitTest).sort();
const unitPins = unitPinsAll.slice(0, PIN_CAP);
const unitPinsDropped = unitPinsAll.length - unitPins.length;
const replayBacked = replayBackedTests(sources, graph);
const unitReplay = touchedMigration || touchedDbHarness ? [...replayBacked].filter((f) => !unitPins.includes(f)).sort() : [];
const unitWalkers = [...walkers].filter((f) => isUnitTest(f) && !unitPins.includes(f) && !replayBacked.has(f)).sort();
const allUnit = [...sources.keys()].filter(isUnitTest);

const allDb = [...sources.keys()].filter(isDbTest).sort();
const dbPins = [...pinned.keys()].filter(isDbTest);
const dbSourceScanners = touchedWebSource ? allDb.filter((f) => walkers.has(f)) : [];
const dbSchemaPins = touchedMigration || touchedDbHarness ? allDb.filter((f) => SCHEMA_PIN_RE.test(sources.get(f))) : [];
const dbTests = [...new Set([...dbPins, ...dbSourceScanners, ...dbSchemaPins])].sort();
const dbWhy = (f) => (pinned.has(f) ? pinned.get(f) : dbSchemaPins.includes(f) && !dbSourceScanners.includes(f) ? 'pins the schema' : 'scans source');

/* the targeted compile: changed files first, then importers (code before tests) */
const importerList = [...importers].filter((f) => sources.has(f)).sort((a, b) => Number(isTestFile(a)) - Number(isTestFile(b)) || a.localeCompare(b));
const tscImporters = importerList.slice(0, TSC_IMPORTER_CAP);
const tscFiles = [...changedTsWeb, ...tscImporters];

/* eslint covers what `next lint` covers: app, components, lib */
const eslintFiles = changedWeb.filter((f) => /^(app|components|lib)\//.test(f) && /\.(ts|tsx|js|jsx|mjs)$/.test(f));

const cheap = cheapCommands(ciText);
const unknownSteps = inventory(ciText).filter((s) => s.tier === 'unknown');

/* ── --list ─────────────────────────────────────────────────────────────────*/

if (flag('--list')) {
  console.log(`preflight --list · ${branch} @ ${head} · base ${BASE} (${mergeBase.slice(0, 9)}) · ${changed.length} changed, ${deleted.length} deleted`);
  console.log(`\ncheap guards from ci.yml (${cheap.length}):`);
  for (const c of cheap) console.log(`  ${c.cwd === '.' ? '' : `(cd ${c.cwd}) `}${c.run}`);
  console.log(`\neslint (${eslintFiles.length} files)`);
  console.log(`targeted tsc (${changedTsWeb.length} changed + ${tscImporters.length} of ${importerList.length} importers)`);
  console.log(`\nunit tests that name or import a changed file (${unitPins.length}${unitPinsDropped ? `, ${unitPinsDropped} more over the cap` : ''}):`);
  for (const f of unitPins) console.log(`  ${f}  — ${pinned.get(f)}`);
  console.log(`\nwhole-tree guard tests (${unitWalkers.length} of ${allUnit.length} unit test files)`);
  console.log(`unit tests that replay the migrations (${unitReplay.length} — only when a migration changed)`);
  console.log(`\nDB tests (${dbTests.length} of ${allDb.length}):`);
  for (const f of dbTests) console.log(`  ${f}  — ${dbWhy(f)}`);
  if (unknownSteps.length) console.log(`\n⚠ UNCLASSIFIED CI steps: ${unknownSteps.map((s) => s.step).join(' · ')}`);
  console.log(`\n(read ${sources.size} source files in ${fmtMs(Date.now() - t0)})`);
  process.exit(0);
}

/* ── running things ─────────────────────────────────────────────────────────*/

const live = new Set();
function killGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
/** Ctrl-C (or a kill) must not leave a test batch running behind us. */
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    for (const child of live) killGroup(child, 'SIGTERM');
    process.exit(130);
  });
}

/** @returns {Promise<{code:number|null, signal:string|null, out:string, ms:number, timedOut:boolean}>} */
function run(cmd, args, { cwd = ROOT, env = {}, timeoutMs = 20 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const began = Date.now();
    // its own process group, so stopping preflight stops the test children too
    const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    live.add(child);
    const chunks = [];
    let size = 0;
    const keep = (b) => {
      // keep the head; a 40 MB stream is not a message
      if (size < 4 * 1024 * 1024) chunks.push(b);
      size += b.length;
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child, 'SIGKILL');
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      live.delete(child);
      resolve({ code: 127, signal: null, out: String(e.message), ms: Date.now() - began, timedOut });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      live.delete(child);
      resolve({ code, signal, out: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - began, timedOut });
    });
  });
}

async function pool(items, limit, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

/** A killed process is a FAILURE — not a pass, and not "skipped" (exit 144 / 137 = killed). */
function died(r) {
  if (r.timedOut) return 'timed out and was killed';
  if (r.signal) return `killed by ${r.signal}`;
  if (r.code !== null && r.code > 128) return `killed (exit ${r.code})`;
  return null;
}

/** @type {{group:string, check:string, status:'pass'|'fail'|'notrun', ms:number, line:string, rerun:string, hint?:string|null}[]} */
const rows = [];
const NO_MODULES = 'node_modules is missing (no tsx / tsc / next) — nothing could resolve, so nothing was checked. Run pnpm install first.';
const add = (row) => rows.push(row);
const say = (msg) => process.stderr.write(`${msg}\n`);

const gitDir = (() => {
  const d = git(['rev-parse', '--git-dir'], ROOT);
  return path.isAbsolute(d) ? d : path.join(ROOT, d);
})();
const OUT_DIR = path.join(gitDir, 'preflight');
fs.mkdirSync(OUT_DIR, { recursive: true });

say(`preflight · ${branch} @ ${head} · base ${BASE} (${mergeBase.slice(0, 9)}) · ${changed.length} changed, ${deleted.length} deleted · jobs ${JOBS}`);
if (!changed.length && !deleted.length) say('  (no changed files — the whole-tree guards still run)');

/* ── phase A · every cheap CI guard, plus eslint ────────────────────────────*/

async function runCheap() {
  await pool(cheap, JOBS, async (c) => {
    const cwd = path.join(ROOT, c.cwd);
    const needsModules = /lint:dup-rule|check-ugat-screens/.test(c.run);
    const rerun = c.cwd === '.' ? c.run : `(cd ${c.cwd} && ${c.run})`;
    if (needsModules && !hasModules) {
      add({ group: 'guard', check: c.title, status: 'fail', ms: 0, line: NO_MODULES, rerun });
      return;
    }
    const r = await run('sh', ['-c', c.run], { cwd, timeoutMs: 10 * 60 * 1000 });
    const dead = died(r);
    const ok = r.code === 0 && !dead;
    add({ group: 'guard', check: c.title, status: ok ? 'pass' : 'fail', ms: r.ms, line: ok ? '' : dead ?? firstFailingLine(r.out), rerun, hint: ok ? null : regenerateHint(c.run) });
  });
}

async function runEslint() {
  if (!eslintFiles.length) return;
  const check = `eslint on changed files (${eslintFiles.length})`;
  const rerun = `(cd apps/web && npx next lint ${eslintFiles.slice(0, 3).map((f) => `--file '${f}'`).join(' ')}${eslintFiles.length > 3 ? ' …' : ''})`;
  if (!hasModules) {
    add({ group: 'lint', check, status: 'fail', ms: 0, line: NO_MODULES, rerun });
    return;
  }
  const r = await run(bin('next'), ['lint', ...eslintFiles.flatMap((f) => ['--file', f])], { cwd: WEB, timeoutMs: 10 * 60 * 1000 });
  const dead = died(r);
  // `next lint` exits 1 on an Error and 0 on warnings — the same bar as CI's `pnpm lint`
  const ok = r.code === 0 && !dead;
  add({ group: 'lint', check, status: ok ? 'pass' : 'fail', ms: r.ms, line: ok ? '' : dead ?? firstEslintError(r.out), rerun });
}

async function runGitleaks() {
  const has = (await run('sh', ['-c', 'command -v gitleaks'])).code === 0;
  if (!has) return false;
  const r = await run('gitleaks', ['detect', '--no-banner', '--redact', '--log-opts', `${mergeBase}..HEAD`], { cwd: ROOT, timeoutMs: 5 * 60 * 1000 });
  const ok = r.code === 0;
  add({ group: 'guard', check: "secret scan (gitleaks, this branch's commits)", status: ok ? 'pass' : 'fail', ms: r.ms, line: ok ? '' : firstFailingLine(r.out), rerun: `gitleaks detect --no-banner --redact --log-opts ${mergeBase.slice(0, 9)}..HEAD` });
  return true;
}

/* ── phase B · targeted compile, and the unit tests a change wakes ──────────*/

const TSC_CFG = path.join(WEB, `tsconfig.preflight-${process.pid}.json`);
async function tscOnce(files) {
  const include = ['next-env.d.ts', 'types/*.d.ts', ...files];
  fs.writeFileSync(TSC_CFG, JSON.stringify({ extends: './tsconfig.json', compilerOptions: { incremental: false, plugins: [] }, include, exclude: ['node_modules', '.next'] }));
  try {
    return await run(bin('tsc'), ['--noEmit', '--pretty', 'false', '-p', TSC_CFG], {
      cwd: WEB,
      env: { NODE_OPTIONS: `--max-old-space-size=${TSC_HEAP_MB}` },
      timeoutMs: 12 * 60 * 1000,
    });
  } finally {
    fs.rmSync(TSC_CFG, { force: true });
  }
}
process.on('exit', () => fs.rmSync(TSC_CFG, { force: true }));

let tscNote = '';
async function runTsc() {
  if (!changedTsWeb.length) return;
  const rerun = '(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it';
  if (!hasModules) {
    add({ group: 'types', check: 'tsc on changed files', status: 'fail', ms: 0, line: NO_MODULES, rerun });
    return;
  }
  let r = await tscOnce(tscFiles);
  let scope = `${changedTsWeb.length} changed + ${tscImporters.length} of ${importerList.length} importers`;
  let compiledImporters = tscImporters.length;
  const tooBig = (x) => /heap out of memory|Allocation failed/.test(x.out) || x.code === 134 || Boolean(died(x));
  if (tooBig(r) && tscImporters.length) {
    scope = `${changedTsWeb.length} changed files only — the importers did not fit in ${TSC_HEAP_MB} MB`;
    compiledImporters = 0;
    r = await tscOnce(changedTsWeb);
  }
  const check = `tsc (${scope})`;
  if (tooBig(r)) {
    add({ group: 'types', check, status: 'notrun', ms: r.ms, line: `did not fit in ${TSC_HEAP_MB} MB — CI's Typecheck is the first compile of this change`, rerun });
    return;
  }
  const errors = r.out.split('\n').filter((l) => /error TS\d+/.test(l));
  const ok = r.code === 0 && errors.length === 0;
  if (importerList.length > compiledImporters) tscNote = `${importerList.length - compiledImporters} importer(s) of the changed files were not compiled`;
  add({ group: 'types', check, status: ok ? 'pass' : 'fail', ms: r.ms, line: ok ? '' : `${errors[0] ?? firstFailingLine(r.out)}${errors.length > 1 ? `  (+${errors.length - 1} more)` : ''}`.slice(0, 320), rerun });
}

/**
 * Run a batch of test files in ONE `tsx --test` and attribute every result to
 * its file. Fails closed three ways: a non-zero exit, a file that was asked for
 * and never reported, and a run that was killed.
 */
async function runTests(label, files, concurrency) {
  const jsonl = path.join(OUT_DIR, `${label}.jsonl`);
  const tap = path.join(OUT_DIR, `${label}.tap`);
  fs.rmSync(jsonl, { force: true });
  // a long batch says where it is — silence for ten minutes reads as a hang
  const tick = setInterval(() => {
    try {
      const seen = new Set();
      for (const line of fs.readFileSync(jsonl, 'utf8').split('\n')) {
        const m = /"file":"([^"]+)"/.exec(line);
        if (m) seen.add(m[1]);
      }
      say(`      … ${label}: ${seen.size} of ${files.length} test files have reported`);
    } catch {
      /* nothing written yet */
    }
  }, 45_000);
  tick.unref();
  const r = await run(
    bin('tsx'),
    ['--test', `--test-concurrency=${concurrency}`, '--test-reporter=tap', `--test-reporter-destination=${tap}`, `--test-reporter=${REPORTER}`, `--test-reporter-destination=${jsonl}`, ...files.map(testArg)],
    { cwd: WEB, timeoutMs: 40 * 60 * 1000 },
  );
  clearInterval(tick);
  const byFile = new Map(files.map((f) => [f, { pass: 0, fail: [], ms: 0 }]));
  if (fs.existsSync(jsonl)) {
    for (const line of fs.readFileSync(jsonl, 'utf8').split('\n')) {
      if (!line) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (!rec.file) continue;
      const rel = path.relative(WEB, rec.file).split(path.sep).join('/');
      const slot = byFile.get(rel);
      if (!slot) continue; // a `?` pattern matched a sibling — its result is not ours to report
      if (rec.nesting === 0) slot.ms += rec.ms ?? 0;
      if (rec.t === 'pass') slot.pass++;
      else slot.fail.push(rec);
    }
  }
  return { r, byFile };
}

function reportTests(group, title, files, result, why) {
  if (!files.length) return;
  const { r, byFile } = result;
  const dead = died(r);
  const failing = files.filter((f) => byFile.get(f).fail.length);
  const silent = files.filter((f) => !byFile.get(f).pass && !byFile.get(f).fail.length && /\b(test|it|describe)\s*\(/.test(sources.get(f) ?? ''));
  const passes = files.reduce((n, f) => n + byFile.get(f).pass, 0);
  const rerunOf = (f) => `(cd apps/web && npx tsx --test '${testArg(f)}')`;
  // the batch's wall time, shared out by how long each group's own tests took
  const share = (subset) => {
    const all = [...byFile.values()].reduce((n, s) => n + s.ms, 0) || 1;
    return Math.round((r.ms * subset.reduce((n, f) => n + byFile.get(f).ms, 0)) / all);
  };
  if (!failing.length && !silent.length && !dead) {
    add({ group, check: `${title} — ${files.length} files, ${passes.toLocaleString('en-US')} tests`, status: 'pass', ms: share(files), line: '', rerun: '' });
    return;
  }
  for (const f of failing) {
    const fails = byFile.get(f).fail;
    const more = fails.length > 1 ? `  (+${fails.length - 1} more in this file)` : '';
    add({ group, check: `${f}${why ? `  [${why(f)}]` : ''}`, status: 'fail', ms: byFile.get(f).ms, line: `${fails[0].name}${fails[0].msg ? ` — ${fails[0].msg}` : ''}${more}`.slice(0, 460), rerun: rerunOf(f), hint: regenerateHint(f) });
  }
  // a file that was asked for and said nothing did NOT pass
  for (const f of silent.slice(0, 20)) {
    add({ group, check: f, status: 'fail', ms: 0, line: dead ? `never reported — the run ${dead}` : 'was asked for and reported no test at all (crashed on load, or the path matched nothing)', rerun: rerunOf(f) });
  }
  if (silent.length > 20) add({ group, check: `${silent.length - 20} more files never reported`, status: 'fail', ms: 0, line: dead ?? '', rerun: '' });
  if (!failing.length && !silent.length && dead) {
    add({ group, check: title, status: 'fail', ms: r.ms, line: `the run ${dead}`, rerun: '' });
    return;
  }
  const okFiles = files.filter((f) => !failing.includes(f) && !silent.includes(f));
  if (okFiles.length) add({ group, check: `${title} — the other ${okFiles.length} files`, status: 'pass', ms: share(okFiles), line: '', rerun: '' });
}

async function runUnit() {
  const files = [...unitPins, ...unitWalkers, ...unitReplay];
  if (!files.length) return;
  if (!hasModules) {
    add({ group: 'unit', check: 'unit tests', status: 'fail', ms: 0, line: NO_MODULES, rerun: 'pnpm install' });
    return;
  }
  // ONE batch, three rows
  const result = await runTests('unit', files, JOBS);
  reportTests('unit', 'tests that name or import a changed file', unitPins, result, (f) => pinned.get(f));
  reportTests('unit', 'whole-tree guard tests', unitWalkers, result);
  reportTests('unit', 'unit tests that replay the migrations', unitReplay, result);
}

/* ── phase C · the DB tests ─────────────────────────────────────────────────*/

async function runDb() {
  if (!dbTests.length) return;
  if (!hasModules) {
    add({ group: 'db', check: 'DB tests', status: 'fail', ms: 0, line: NO_MODULES, rerun: 'pnpm install' });
    return;
  }
  // every DB test replays all the migrations into its own PGlite: few at a time
  const result = await runTests('db', dbTests, Math.min(JOBS, 3));
  reportTests('db', touchedMigration || touchedDbHarness ? 'DB tests: source scanners + schema pins' : 'DB tests that scan source', dbTests, result, dbWhy);
}

async function runCargo() {
  if (!touchedRust) return 'untouched';
  const has = (await run('sh', ['-c', 'command -v cargo'])).code === 0;
  if (!has) return 'no-cargo';
  const cmd = 'cargo test --manifest-path src-tauri/Cargo.toml -p setnayan-encoder';
  const r = await run('sh', ['-c', cmd], { cwd: ROOT, timeoutMs: 20 * 60 * 1000 });
  const ok = r.code === 0;
  add({ group: 'native', check: 'native encoder tests', status: ok ? 'pass' : 'fail', ms: r.ms, line: ok ? '' : firstFailingLine(r.out), rerun: cmd });
  return 'ran';
}

/* ── go ─────────────────────────────────────────────────────────────────────*/

const started = Date.now();
const skip = async () => undefined;
say(`  A · ${cheap.length} cheap CI guards + eslint on ${eslintFiles.length} files`);
const [, , hadGitleaks] = await Promise.all([want('guards') ? runCheap() : skip(), want('lint') ? runEslint() : skip(), want('guards') ? runGitleaks() : skip()]);
say(`  B · tsc on ${tscFiles.length} files · unit tests: ${unitPins.length} pinned + ${unitWalkers.length} whole-tree${unitReplay.length ? ` + ${unitReplay.length} replay-backed` : ''}`);
await Promise.all([want('types') ? runTsc() : skip(), want('unit') ? runUnit() : skip()]);
say(`  C · ${dbTests.length} DB tests${touchedRust ? ' · native encoder' : ''}`);
const [, cargoState] = await Promise.all([want('db') ? runDb() : skip(), want('guards') ? runCargo() : skip()]);
const wall = Date.now() - started;

/* ── the table ──────────────────────────────────────────────────────────────*/

const ORDER = ['guard', 'lint', 'types', 'unit', 'db', 'native'];
rows.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || Number(a.status === 'pass') - Number(b.status === 'pass'));
const failed = rows.filter((r) => r.status === 'fail');
const notRun = rows.filter((r) => r.status === 'notrun');
const passedGuards = rows.filter((r) => r.group === 'guard' && r.status === 'pass');

const leftToCi = [
  `full typecheck — preflight compiled ${changedTsWeb.length ? tscFiles.length : 0} file(s)${tscNote ? `; ${tscNote}` : ''}`,
  `full eslint — preflight linted ${eslintFiles.length} changed file(s)`,
  `full unit suite — preflight ran ${unitPins.length + unitWalkers.length + unitReplay.length} of ${allUnit.length} test files${unitPinsDropped ? ` (${unitPinsDropped} pinned files over the cap of ${PIN_CAP} were NOT run)` : ''}`,
  `full DB replay — preflight ran ${dbTests.length} of ${allDb.length} DB tests${touchedMigration ? '' : ' (no migration changed, so the schema pins were not run)'}`,
  'production build · Vercel route count · shared bundle size · the Maker\'s first-load JS budget',
  'lighthouse · playwright e2e',
  ...(hadGitleaks ? [] : ['secret scan (gitleaks is not installed on this machine)']),
  ...(cargoState === 'ran' ? [] : [`native encoder tests (${cargoState === 'no-cargo' ? 'src-tauri changed but cargo is not installed' : 'src-tauri untouched'})`]),
];

const mark = { pass: 'PASS', fail: 'FAIL', notrun: 'NOT RUN' };
const lines = [];
const out = (s = '') => lines.push(s);

out(`PREFLIGHT · ${branch} @ ${head} · base ${BASE} · ${changed.length} changed, ${deleted.length} deleted`);
if (ONLY) out(`⚠ PARTIAL RUN (--only ${ONLY.join(',')}) — the other phases did NOT run. Run it without --only before you push.`);
out();
out(`${'result'.padEnd(8)}${'time'.padStart(8)}  check`);
out(`${'-'.repeat(8)}${'-'.repeat(8)}  ${'-'.repeat(60)}`);
if (passedGuards.length) {
  const total = passedGuards.reduce((n, r) => n + r.ms, 0);
  out(`${'PASS'.padEnd(8)}${fmtMs(total).padStart(8)}  ${passedGuards.length} cheap CI guards (every \`node …mjs\` step of ci.yml, as CI words it)`);
}
for (const r of rows) {
  if (r.group === 'guard' && r.status === 'pass') continue;
  out(`${mark[r.status].padEnd(8)}${(r.ms ? fmtMs(r.ms) : '').padStart(8)}  ${r.check}`);
  if (r.status !== 'pass') {
    if (r.line) out(`${' '.repeat(18)}↳ ${r.line}`);
    if (r.hint) out(`${' '.repeat(18)}fix: ${r.hint}`);
    if (r.rerun) out(`${' '.repeat(18)}$ ${r.rerun}`);
  }
}
if (unknownSteps.length) {
  out();
  out(`⚠ ci.yml has ${unknownSteps.length} step(s) preflight does not understand and DID NOT RUN: ${unknownSteps.map((s) => `"${s.step}"`).join(' · ')}`);
  out('  Classify them in scripts/lib/preflight-core.mjs (classifyStep) — scripts/preflight.test.mjs fails CI until you do.');
}
out();
out('LEFT TO CI — not run here. A green preflight is NOT a full pass:');
for (const l of leftToCi) out(`  · ${l}`);
for (const r of notRun) out(`  · ${r.check}: ${r.line}`);
out();
out(failed.length ? `RESULT: ${failed.length} FAILED · ${rows.length - failed.length - notRun.length} passed · wall ${fmtMs(wall)}` : `RESULT: the cheap faults are clear (${rows.length - notRun.length} checks) · wall ${fmtMs(wall)} · CI still has to run the rest`);

console.log(lines.join('\n'));

/* a copy for the PR body */
const md = [];
if (ONLY) md.push(`⚠ PARTIAL RUN (--only ${ONLY.join(',')})`);
md.push(`**preflight** · \`${branch}\` @ \`${head}\` · base \`${BASE}\` · ${changed.length} changed · wall ${fmtMs(wall)} · ${failed.length ? `**${failed.length} FAILED**` : 'cheap faults clear'}`);
md.push('');
md.push('| check | result | time | first failing line | re-run |');
md.push('|---|---|--:|---|---|');
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
if (passedGuards.length) md.push(`| ${passedGuards.length} cheap CI guards (every \`node …mjs\` step of ci.yml) | PASS | ${fmtMs(passedGuards.reduce((n, r) => n + r.ms, 0))} | | |`);
for (const r of rows) {
  if (r.group === 'guard' && r.status === 'pass') continue;
  md.push(`| ${cell(r.check)} | ${mark[r.status]} | ${r.ms ? fmtMs(r.ms) : ''} | ${cell(r.line)} | ${r.rerun ? `\`${cell(r.rerun)}\`` : ''} |`);
}
md.push('');
md.push(`Left to CI (not run locally): ${leftToCi.join(' · ')}`);
const mdPath = path.join(OUT_DIR, 'last.md');
fs.writeFileSync(mdPath, md.join('\n') + '\n');
say(`\n(the same table as markdown, for the PR body: ${path.relative(process.cwd(), mdPath) || mdPath})`);

process.exit(failed.length ? 1 : 0);
