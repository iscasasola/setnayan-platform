/**
 * preflight-core — the pure half of `scripts/preflight.mjs`.
 *
 * Nothing in here touches the network, spawns a process or needs node_modules,
 * so `scripts/preflight.test.mjs` can hold it to account in CI with plain node.
 *
 * WHY PREFLIGHT READS ci.yml INSTEAD OF KEEPING ITS OWN LIST
 * A hand-kept copy of "what CI runs" is a second source of truth for one fact,
 * and it rots the day somebody adds a guard step to the workflow. So the cheap
 * checks are DERIVED: every `run:` step of .github/workflows/ci.yml is parsed
 * and classified, and a step nobody classified fails the unit test — the
 * person adding a CI step is told, in the same PR, to say what preflight does
 * with it.
 */

import path from 'node:path';

/* ── 1. the workflow, as steps ──────────────────────────────────────────────*/

/**
 * A deliberately small reader for the one shape ci.yml uses: `jobs:` at column
 * 0, job ids at 2 spaces, job keys at 4, step items at 6 (`- key:`), step keys
 * at 8. It is not a YAML parser and does not pretend to be one — if the file's
 * shape changes, `parseWorkflow` returns fewer steps than the file has `run:`
 * lines and the unit test says so (see "no run: line is lost").
 *
 * @returns {{job:string, jobName:string, step:string, run:string|null, uses:string|null, cwd:string|null, block:boolean, line:number}[]}
 */
export function parseWorkflow(text) {
  const lines = text.split('\n');
  const steps = [];
  let inJobs = false;
  let job = null;
  let jobName = null;
  let cur = null;
  const push = () => {
    if (cur) steps.push(cur);
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^jobs:\s*$/.test(raw)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(raw) && !/^#/.test(raw)) {
      // a new top-level key after jobs: — nothing below belongs to a job
      push();
      inJobs = false;
      continue;
    }
    const jobMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(raw);
    if (jobMatch) {
      push();
      job = jobMatch[1];
      jobName = job;
      continue;
    }
    if (!job) continue;
    const nameMatch = /^ {4}name:\s*(.+?)\s*$/.exec(raw);
    if (nameMatch) {
      jobName = unquote(nameMatch[1]);
      continue;
    }
    const item = /^ {6}- (name|uses|run|id|if):\s*(.*)$/.exec(raw);
    const key = item ?? /^ {8}(name|uses|run|id|if|working-directory|shell):\s*(.*)$/.exec(raw);
    if (!key) continue;
    if (item) {
      push();
      cur = { job, jobName, step: '', run: null, uses: null, cwd: null, block: false, line: i + 1 };
    }
    if (!cur) continue;
    const [, k, vRaw] = key;
    const v = vRaw.trim();
    if (k === 'name') cur.step = unquote(v);
    else if (k === 'uses') cur.uses = v;
    else if (k === 'working-directory') cur.cwd = unquote(v);
    else if (k === 'run') {
      if (/^[|>][+-]?\s*$/.test(v)) {
        // block scalar: everything indented deeper than the `run:` key
        const keyIndent = raw.search(/\S/) + (item ? 2 : 0);
        const body = [];
        let j = i + 1;
        for (; j < lines.length; j++) {
          const l = lines[j];
          if (l.trim() === '') {
            body.push('');
            continue;
          }
          if (l.search(/\S/) <= keyIndent) break;
          body.push(l.trim());
        }
        cur.run = body.join('\n').trim();
        cur.block = true;
        i = j - 1;
      } else {
        cur.run = v;
      }
    }
  }
  push();
  for (const s of steps) if (!s.step) s.step = s.uses ?? (s.run ?? '').split('\n')[0];
  return steps;
}

function unquote(s) {
  const m = /^(['"])(.*)\1$/.exec(s);
  return m ? m[2] : s;
}

/** How many `run:` keys the file has at step depth — the parser's own cross-check. */
export function countRunKeys(text) {
  let n = 0;
  let inJobs = false;
  for (const raw of text.split('\n')) {
    if (/^jobs:\s*$/.test(raw)) inJobs = true;
    else if (inJobs && /^ {6}(- | {2})run:/.test(raw)) n++;
  }
  return n;
}

/* ── 2. what preflight does with each step ──────────────────────────────────*/

/**
 * Jobs whose `node …mjs` steps read the OUTPUT OF A PRODUCTION BUILD. They are
 * heavy no matter how small the script is: without `.next` they have nothing
 * to measure, and a `next build` does not fit on the dev machine.
 */
export const BUILD_JOBS = new Set(['build', 'bundle-size-check']);

/**
 * Tiers:
 *   cheap  — seconds, runs verbatim on any tree (pure node, or node + the
 *            installed tsx): preflight runs EVERY one of these, every time.
 *   medium — the full step is left to CI, and preflight runs a TARGETED
 *            version of it (`local` says which): the changed files, the tests
 *            that name them, the guards that scan the whole tree.
 *   heavy  — left to CI entirely. Named in preflight's output every time, so
 *            a green preflight is never read as a full pass.
 *   infra  — checkout / setup / install / the aggregators: nothing to check.
 *   unknown — nobody has said. The unit test fails on these.
 */
export function classifyStep(s) {
  if (s.uses && !s.run) {
    if (/gitleaks/.test(s.uses)) return { tier: 'medium', why: 'secret scan', local: 'gitleaks over this branch\'s commits, when the binary is installed' };
    return { tier: 'infra', why: 'an action (checkout / toolchain / cache)' };
  }
  const run = (s.run ?? '').trim();
  if (!run) return { tier: 'infra', why: 'no command' };

  if (/^pnpm install\b/.test(run)) return { tier: 'infra', why: 'install' };
  if (/^git fetch\b/.test(run)) return { tier: 'infra', why: 'fetches origin/main for the allocator rule' };

  // These two read THIS CI RUN's own results (the jobs' outcomes, a shard's
  // log). There is nothing for them to read on a builder's machine.
  if (/\bscripts\/(ci-gate|ci-test-summary)\.mjs\b/.test(run)) return { tier: 'infra', why: "reads this CI run's own results" };

  if (BUILD_JOBS.has(s.job)) {
    return { tier: 'heavy', why: 'needs a production build (`next build` does not fit on the dev machine)' };
  }
  if (/\bpnpm typecheck\b/.test(run)) return { tier: 'medium', why: 'full tsc', local: 'tsc on the changed files and the files that import them' };
  if (/^pnpm lint\b/.test(run)) return { tier: 'medium', why: 'full eslint', local: 'eslint on the changed files' };
  if (/\btest:unit\b/.test(run)) return { tier: 'medium', why: 'full unit suite', local: 'the tests that name a changed file + every whole-tree guard test' };
  if (/\btest:db:ci\b/.test(run)) return { tier: 'medium', why: 'full DB replay', local: 'the DB tests that scan source, plus the schema pins when a migration changed' };
  if (/^cargo test\b/.test(run)) return { tier: 'medium', why: 'native encoder tests (Rust)', local: 'the same cargo test, when src-tauri changed and cargo is installed' };

  if (s.block) {
    // A multi-line shell block that calls no toolchain is plumbing (the
    // aggregators and gates). One that does call a tool must be classified.
    return /(^|\n|[;&|]\s*)\s*(node|pnpm|npx|tsx|cargo|python3?)\b/.test(run)
      ? { tier: 'unknown', why: 'a multi-line step that runs a tool — say what preflight should do with it' }
      : { tier: 'infra', why: 'shell plumbing (aggregator / gate / summary)' };
  }

  // `node x.mjs`, `node --test x.test.mjs`, `cd apps/web && node scripts/x.mjs`,
  // `RADIUS_LINT_STRICT=1 node x.mjs` — runnable exactly as written.
  if (/^(cd [\w./-]+ && )?([A-Z][A-Z0-9_]*=\S+ )*node (--test )?[\w./-]+\.mjs( [\w./=-]+)*$/.test(run)) {
    return { tier: 'cheap', why: 'pure node guard' };
  }
  if (/^pnpm --filter @setnayan\/web lint:dup-rule$/.test(run)) return { tier: 'cheap', why: 'tsx scanner (needs node_modules)' };

  return { tier: 'unknown', why: 'unclassified command' };
}

/** Every step of the workflow with its tier. */
export function inventory(text) {
  return parseWorkflow(text).map((s) => ({ ...s, ...classifyStep(s) }));
}

/**
 * The cheap steps as runnable commands. The SAME command CI runs — a
 * `working-directory:` becomes the cwd, never a rewritten path.
 */
export function cheapCommands(text) {
  const out = [];
  const seen = new Set();
  for (const s of inventory(text)) {
    if (s.tier !== 'cheap') continue;
    const key = `${s.cwd ?? '.'}::${s.run}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: s.step, run: s.run, cwd: s.cwd ?? '.', job: s.jobName });
  }
  return out;
}

/* ── 3. which tests a change wakes up ───────────────────────────────────────*/

/** Basenames too common to be a pin on their own — they need their folder. */
export const GENERIC_BASENAMES = new Set([
  'page.tsx', 'layout.tsx', 'route.ts', 'route.tsx', 'actions.ts', 'action.ts', 'index.ts', 'index.tsx',
  'loading.tsx', 'error.tsx', 'not-found.tsx', 'default.tsx', 'template.tsx', 'types.ts', 'utils.ts',
  'constants.ts', 'client.tsx', 'client.ts', 'server.ts', 'schema.ts', 'queries.ts', 'helpers.ts',
  'config.ts', 'data.ts', 'styles.css', 'package.json', 'README.md', 'opengraph-image.tsx', 'icon.tsx',
  'loaders.ts', 'copy.ts', 'state.ts', 'hooks.ts', 'context.tsx', 'provider.tsx', 'form.tsx', 'shell.tsx',
]);

/**
 * The strings a test would have to contain to be "naming" this file. A needle
 * is always a path TAIL, so `guests.ts` cannot be woken by the word "guests".
 */
export function needlesFor(repoRelPath) {
  const p = repoRelPath.split(path.sep).join('/');
  const parts = p.split('/');
  const base = parts[parts.length - 1];
  const needles = new Set();
  if (!GENERIC_BASENAMES.has(base) && base.length >= 6) {
    needles.add(base);
  } else if (parts.length >= 2) {
    let take = 2;
    // a route group or a dynamic segment names nothing — take its parent too
    while (take < parts.length && /^[[(]/.test(parts[parts.length - take])) take++;
    needles.add(parts.slice(-take).join('/'));
  }
  const migration = /^(\d{14})_/.exec(base);
  if (migration) needles.add(migration[1]);
  return [...needles];
}

/**
 * `tsx --test` treats every argument as a GLOB, so a path holding `[eventId]`
 * is a character class that matches nothing. `?` stands in for each bracket:
 * one character, exactly where the bracket was, so the pattern still matches
 * this file and (in practice) only this file.
 */
export function testArg(p) {
  return p.replace(/[[\]]/g, '?');
}

/** Text that walks a directory tree — the mark of a whole-source guard. */
export const WALK_RE = /\b(readdirSync|opendirSync|globSync|readdir|fast-glob|collectSourceFiles|scanTree)\b|git ls-files|\bfrom ['"](node:)?fs\/promises['"][^;]*\bglob\b/;
/** A test that runs one of the repo's guard scripts as a child process. */
export const SPAWN_GUARD_RE = /\b(execFileSync|spawnSync|execSync)\b[\s\S]{0,400}scripts\//;

const IMPORT_RE = /(?:import|export)\s(?:[^'"`;]*?\sfrom\s*)?['"]([^'"\n]+)['"]|import\s*\(\s*['"]([^'"\n]+)['"]\s*\)|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const REEXPORT_RE = /export\s(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s*['"]([^'"\n]+)['"]/g;
const TRY_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx'];

/** Resolve one import specifier against the set of known files (web-relative, posix). */
export function resolveImport(spec, fromFile, known) {
  let target;
  if (spec.startsWith('@/')) target = spec.slice(2);
  else if (spec.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  else return null;
  for (const suffix of TRY_SUFFIXES) if (known.has(target + suffix)) return target + suffix;
  return null;
}

/**
 * The import graph of apps/web, reversed: file → the files that import it.
 * @param {Map<string,string>} sources web-relative posix path → text
 */
export function buildImporters(sources) {
  const known = new Set(sources.keys());
  const importers = new Map();
  const reexporters = new Map();
  const add = (map, to, from) => {
    let set = map.get(to);
    if (!set) map.set(to, (set = new Set()));
    set.add(from);
  };
  for (const [file, text] of sources) {
    for (const m of text.matchAll(IMPORT_RE)) {
      const to = resolveImport(m[1] ?? m[2] ?? m[3], file, known);
      if (to && to !== file) add(importers, to, file);
    }
    for (const m of text.matchAll(REEXPORT_RE)) {
      const to = resolveImport(m[1], file, known);
      if (to && to !== file) add(reexporters, to, file);
    }
  }
  return { importers, reexporters };
}

export const isTestFile = (f) => /\.test\.tsx?$/.test(f);
export const isDbTest = (f) => /^tests\/db\/[^/]+\.db\.test\.ts$/.test(f);
export const isUnitTest = (f) => isTestFile(f) && /^(lib|app)\//.test(f);

/**
 * Everything that imports a changed file — following a barrel (`export … from`)
 * so a type that changed behind a re-export still reaches its real callers.
 */
export function importersOf(changed, graph) {
  const out = new Set();
  const queue = [...changed];
  const seenBarrel = new Set(changed);
  while (queue.length) {
    const f = queue.shift();
    for (const imp of graph.importers.get(f) ?? []) out.add(imp);
    for (const barrel of graph.reexporters.get(f) ?? []) {
      if (seenBarrel.has(barrel)) continue;
      seenBarrel.add(barrel);
      queue.push(barrel);
    }
  }
  for (const c of changed) out.delete(c);
  return out;
}

/**
 * The whole-tree guard tests: a test that walks a directory itself, runs a
 * guard script, or imports a helper module that walks. DISCOVERED, never
 * listed — a guard written tomorrow is in preflight tomorrow.
 */
export function treeWalkingTests(sources, graph) {
  const walkerModules = new Set();
  for (const [file, text] of sources) {
    // the DB harness walks supabase/migrations, not the app — see replayBackedTests
    if (!isTestFile(file) && !isDbHarness(file) && WALK_RE.test(text)) walkerModules.add(file);
  }
  const out = new Set();
  for (const [file, text] of sources) {
    if (!isTestFile(file)) continue;
    if (WALK_RE.test(text) || SPAWN_GUARD_RE.test(text)) out.add(file);
  }
  for (const mod of walkerModules) {
    for (const imp of graph.importers.get(mod) ?? []) if (isTestFile(imp)) out.add(imp);
  }
  return out;
}

export const isDbHarness = (f) => /^tests\/db\//.test(f) && !isTestFile(f);

/**
 * Unit tests that replay the migrations (they import the DB harness). Their
 * verdict moves with the SCHEMA, so they run when a migration changed — and
 * not on every push, because each one costs a full replay.
 */
export function replayBackedTests(sources, graph) {
  const out = new Set();
  for (const file of sources.keys()) {
    if (!isDbHarness(file)) continue;
    for (const imp of graph.importers.get(file) ?? []) if (isUnitTest(imp)) out.add(imp);
  }
  return out;
}

/**
 * DB tests that read the schema catalogue as a whole, or compare it with a
 * committed baseline — the ones ANY migration can turn red.
 */
export const SCHEMA_PIN_RE = /\.baseline\.txt|\.generated\.txt|schema-snapshot|exposure-surface|UGAT_TYPES|ugat\/graph|pg_constraint|pg_policies|pg_proc\b|information_schema|has_table_privilege|has_column_privilege|has_function_privilege|role_table_grants|pg_class\b|pg_attribute\b/;

/** Tests whose text names a changed file. */
export function testsNaming(changedRepoPaths, sources) {
  const needles = [...new Set(changedRepoPaths.flatMap(needlesFor))];
  const out = new Map();
  if (!needles.length) return out;
  for (const [file, text] of sources) {
    if (!isTestFile(file)) continue;
    const hit = needles.find((n) => text.includes(n));
    if (hit) out.set(file, hit);
  }
  return out;
}

/* ── 4. reading a result ────────────────────────────────────────────────────*/

const STRIP_ANSI = /\u001b\[[0-9;]*m/g;

/** The first line of a guard's output that says what is wrong. */
export function firstFailingLine(output) {
  const lines = output.replace(STRIP_ANSI, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '(no output)';
  const telling = lines.find((l) => /error TS\d+|\bError:|^not ok\b|\bFAIL\b|✗|✘|❌|\bfailed\b|\bmissing\b|\bstale\b|is not current|\bNEW\b/i.test(l) && !/^>/.test(l));
  return (telling ?? lines[0]).slice(0, 240);
}

/** `next lint` prints the file on one line and each finding below it. */
export function firstEslintError(output) {
  const lines = output.replace(STRIP_ANSI, '').split('\n');
  let file = '';
  for (const l of lines) {
    if (/^\.\/\S/.test(l.trim())) file = l.trim();
    const m = /^(\d+:\d+)\s+Error:\s+(.*)$/.exec(l.trim());
    if (m) return `${file}:${m[1]} ${m[2]}`.slice(0, 240);
  }
  return firstFailingLine(output);
}

/** What to run when a generated file is behind — never a hand-merge. */
export const REGENERATE = [
  [/lint-port-no-lost-controls/, 'a control really removed on purpose? regenerate: pnpm -C apps/web port:baseline'],
  [/check-ugat-screens/, 'stale map → pnpm -C apps/web ugat:screens (a NEW finding is a real fault: fix the screen, do not baseline it)'],
  [/lint-no-card/, 'fewer cards → node apps/web/scripts/lint-no-card.mjs --update-baseline (more cards is the fault itself)'],
  [/lint-guest-legibility/, 'after a legitimate change: pnpm -C apps/web lint:legibility -- --update-baseline'],
  [/lint-migrations-never-deleted/, 'a NEW migration → pnpm -C apps/web migrations:manifest (a missing one is a real fault)'],
  [/lint-scene-fills-its-frame/, 'node apps/web/scripts/lint-scene-fills-its-frame.mjs --write'],
  [/lint:dup-rule/, 'use the canonical *_SELECT / shared helper; never add a baseline line (pnpm -C apps/web dup-rule:baseline only ever narrows)'],
  [/lint-exposure-baseline|exposure-freeze/, 'pnpm -C apps/web exposure:baseline (then READ the diff — every added line is new reach for anon/authenticated)'],
  [/user-fk-behaviour/, 'cd apps/web && UPDATE_FK_BEHAVIOUR=1 npx tsx --test tests/db/user-fk-behaviour.db.test.ts'],
  [/ugat-both-ends/, 'record the dropped result (console.error) — the baseline only ever shrinks'],
  [/ugat-concept-coverage/, 'add a node to UGAT_TYPES in apps/web/lib/ugat/graph.ts, or one reasoned line in tests/db/ugat-concept.baseline.txt'],
  [/check-migration-timestamps/, 'allocate with pnpm migration:new — never hand-type a prefix'],
];

export function regenerateHint(command) {
  for (const [re, hint] of REGENERATE) if (re.test(command)) return hint;
  return null;
}

export function fmtMs(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
}
