/**
 * GUARD — EVERY JOB THAT CLAIMS A WINDOW ALSO CLOSES ITS ROW.
 *
 * `claim_periodic_job()` is a compare-and-swap: the winner gets the window and
 * everyone else bails for the whole gap — up to a WEEK for the retention sweeps.
 * Before 2026-09-15 that claim was the entire record. It was stamped BEFORE the
 * body ran, and the body ran inside a catch that swallowed the failure, so **a
 * sweep that threw left a fresh timestamp and did not retry for a week**, and a
 * silently failing deletion job was byte-identical to a working one.
 *
 * `runClaimedJob(key, gap, body)` is now the only sanctioned way to run one: it
 * claims, runs, and writes the outcome (`finished_at`, `ok`, `rows_affected`,
 * `error`) whether the body returns or throws. A bare `claimPeriodicJob` opens a
 * run that nothing ever closes — which now renders on /admin/data-privacy as
 * "started and NEVER FINISHED", the state reserved for a job that actually died.
 *
 * ⚠ IF THIS FAILS BECAUSE YOU ADDED A JOB: add it to `PERIODIC_JOBS` in
 * `lib/periodic-job-registry.ts` in the same commit, and call it through
 * `runClaimedJob`. Do not widen the guard.
 *
 * 🛡 MUTATION-CHECKED — the mutations are the cheap off-switches a future edit
 * would actually reach for: a wrapper reverted to a bare claim, a job added
 * without a catalog row, a catalog row with no call site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { PERIODIC_JOBS, PERIODIC_JOB_KEYS } from './periodic-job-registry';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const ROOTS = [join(WEB, 'app'), join(WEB, 'lib')];

/** The one file allowed to call the raw claim — it is where the close lives. */
const RUNNER = 'lib/periodic-jobs.ts';

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Comment-stripped through the ONE canonical stripper. On 2026-08-11 a check in
 * this repo passed because a COMMENT contained the string it was looking for —
 * and half the files here explain `claimPeriodicJob` in prose directly above
 * code that no longer calls it. A hand-rolled two-replace regex is its own trap
 * (`lint-one-comment-stripper.mjs` refuses one), so this uses lib/strip-comments.
 */
function code(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

const FILES = ROOTS.flatMap((r) => sources(r)).map((abs) => ({
  rel: relative(WEB, abs).split('\\').join('/'),
  src: code(abs),
}));

test('ANCHOR — the walk found the tree and the stripper left code behind', () => {
  assert.ok(FILES.length > 1000, `walked only ${FILES.length} files — did a root move?`);
  const runner = FILES.find((f) => f.rel === RUNNER);
  assert.ok(runner, `${RUNNER} was not walked; every assertion below would pass vacuously`);
  assert.match(
    runner!.src,
    /export async function runClaimedJob/,
    'comment-stripping ate the runner; the scan would prove nothing',
  );
});

test('NOTHING outside the runner calls the raw claim', () => {
  const offenders = FILES.filter(
    (f) => f.rel !== RUNNER && /\bclaimPeriodicJob\s*\(/.test(f.src),
  ).map((f) => f.rel);
  assert.deepEqual(
    offenders,
    [],
    `these call claimPeriodicJob directly:\n  ${offenders.join('\n  ')}\n` +
      `A bare claim wins the window — locking every other caller out for the whole gap — and ` +
      `then closes nothing. Its row says "started, never finished" forever. Call runClaimedJob.`,
  );
});

/** Every `runClaimedJob('<key>'` literal in the tree, with where it was found. */
function callSites(): Map<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const f of FILES) {
    if (f.rel === RUNNER) continue;
    for (const m of f.src.matchAll(/\brunClaimedJob\s*\(\s*['"]([^'"]+)['"]/g)) {
      const key = m[1]!;
      sites.set(key, [...(sites.get(key) ?? []), f.rel]);
    }
  }
  return sites;
}

test('every catalogued job has exactly one call site', () => {
  const sites = callSites();
  const missing = PERIODIC_JOB_KEYS.filter((k) => !sites.has(k));
  assert.deepEqual(
    missing,
    [],
    `catalogued but never run: ${missing.join(', ')}.\n` +
      `There is NO SCHEDULER behind these — a key with no call site is a job that ` +
      `simply does not happen, and nothing throws to tell you.`,
  );
  const doubled = [...sites.entries()].filter(([, where]) => where.length > 1);
  assert.deepEqual(
    doubled.map(([k, where]) => `${k} @ ${where.join(' + ')}`),
    [],
    'a job key is claimed from two places; the window winner becomes a coin toss between them',
  );
});

test('every call site is a catalogued job — no twenty-third job nobody records', () => {
  const stray = [...callSites().keys()].filter((k) => !PERIODIC_JOB_KEYS.includes(k));
  assert.deepEqual(
    stray,
    [],
    `run but not catalogued: ${stray.join(', ')}.\n` +
      `An uncatalogued job never appears on /admin/data-privacy, so when it stops ` +
      `working the only symptom is an absence. Add it to PERIODIC_JOBS.`,
  );
});

test('the COUNT matches — the half the per-key loop cannot do', () => {
  /*
    The loops above prove every key we know of is wired and every wired key is
    known. Both are blind to the two lists drifting together — a key deleted
    from the catalog AND its call site in one edit reads as perfectly consistent.
    Counting the call sites in the tree against the catalog length forces that
    edit to be deliberate and visible in the diff.
  */
  const total = FILES.filter((f) => f.rel !== RUNNER).reduce(
    (n, f) => n + [...f.src.matchAll(/\brunClaimedJob\s*\(/g)].length,
    0,
  );
  assert.equal(
    total,
    PERIODIC_JOBS.length,
    `the tree makes ${total} runClaimedJob calls but the catalog lists ${PERIODIC_JOBS.length} jobs.\n` +
      `  → FEWER: a periodic job was dropped. Nothing throws; the work just stops.\n` +
      `  → MORE:  a job runs without a catalog row, so it is invisible on the console.`,
  );
});

test('the runner records the outcome on BOTH paths — return and throw', () => {
  const src = code(join(WEB, RUNNER));
  // Not "finishPeriodicJob appears somewhere": it must appear on the success
  // path AND in the catch. A catch that only logs is the original defect.
  assert.match(src, /ok:\s*true/, 'runClaimedJob no longer records a successful run');
  assert.match(src, /ok:\s*false/, 'runClaimedJob no longer records a FAILED run');
  const catchBlock = src.slice(src.indexOf('} catch (e) {', src.indexOf('runClaimedJob')));
  assert.match(
    catchBlock,
    /finishPeriodicJob\([^)]*\{[^}]*ok:\s*false/s,
    "the catch stopped writing ok:false. A swallowed failure and a clean run become " +
      'indistinguishable again — which is the exact defect this whole change removes.',
  );
  assert.doesNotMatch(
    catchBlock,
    /\bthrow\b/,
    'the catch rethrows. These run inside after() on the admin page render; a retention ' +
      'sweep must not be able to break the console.',
  );
});

test('the claim is NOT gated on the previous run having succeeded', () => {
  /*
    The tempting "only claim if the last run was ok" would mean a job that
    failed once NEVER RUNS AGAIN — strictly worse than the defect being fixed.
    The SQL side of this is asserted in tests/db/a-job-records-what-it-did.db.test.ts;
    this is the TypeScript half.
  */
  const src = code(join(WEB, RUNNER));
  const claim = src.slice(src.indexOf('export async function claimPeriodicJob'), src.indexOf('export async function finishPeriodicJob'));
  assert.doesNotMatch(
    claim,
    /\bok\b|finished_at/,
    'claimPeriodicJob started reading the previous outcome. A job that failed once would be ' +
      'locked out forever.',
  );
});
