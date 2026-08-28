/**
 * prefill-consumers.test.ts — the registry has to agree with the admin tree.
 *
 * `PREFILL_CONSUMER_JOBS` says which jobs' answers a destination page actually
 * reads back. A hand-kept list of that kind is a list of the things somebody
 * thought of, so this derives the truth by SCANNING every admin page for code
 * that compares the ask marker against a job name, and fails if the two sets
 * differ in EITHER direction:
 *
 *   · a page starts consuming a job and is not registered  → the box would go
 *     on saying "this page does not fill itself in" while it now does;
 *   · a name stays registered after its reader is deleted  → the box promises
 *     a fill that no longer happens, which is the bug this whole file exists
 *     to stop.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { PREFILL_CONSUMER_JOBS, jobPrefillIsRead } from './prefill-consumers';
import { ADMIN_JOBS } from './admin-jobs.generated';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = resolve(HERE, '..', '..', 'app', 'admin');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Job names a page compares the ask marker against.
 *
 * Matches both spellings a reader can use — `!== 'name'` for the early-return
 * shape the taxonomy studio uses, and `=== 'name'` for the positive one — so a
 * new consumer written the other way round is still seen. Comments are
 * stripped first: this very file and the palette's docblocks name
 * `createCanonicalLeaf` in prose, and prose is not a reader.
 */
function scanConsumers(): Set<string> {
  const found = new Set<string>();
  const patterns = [
    // The hand-written shape: an effect comparing the marker against one job.
    /ADMIN_ASK_PARAM\s*\)\s*[!=]==\s*['"]([A-Za-z0-9_]+)['"]/g,
    // The generic shape: one table entry per job, each declaring the fields its
    // form needs. The CALL is the reader — a name cannot appear here without
    // the descriptor that makes the card work, and deleting the descriptor
    // takes the name with it. Same derivation, one spelling wider.
    /preparedJob\(\s*['"]([A-Za-z0-9_]+)['"]/g,
  ];
  for (const file of walk(ADMIN_DIR)) {
    // The palette WRITES these params; it is not a destination that reads them.
    if (file.endsWith('admin-command-palette.tsx')) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const pattern of patterns) {
      for (const m of src.matchAll(pattern)) if (m[1]) found.add(m[1]);
    }
  }
  return found;
}

test('the scan can actually find a consumer — a floor, so an empty sweep cannot pass', () => {
  const scanned = scanConsumers();
  assert.ok(
    scanned.size > 0,
    'the consumer scan found NOTHING — the pattern or the tree moved, and an empty sweep would silently agree with an empty registry',
  );
});

test('the registry matches the admin tree exactly, in both directions', () => {
  const scanned = [...scanConsumers()].sort();
  const registered = [...PREFILL_CONSUMER_JOBS].sort();
  assert.deepEqual(
    registered,
    scanned,
    `PREFILL_CONSUMER_JOBS disagrees with the admin tree.\n  registered: ${registered.join(', ') || '(none)'}\n  scanned:    ${scanned.join(', ') || '(none)'}\nRegister a job only together with the code that reads it.`,
  );
});

test('every registered name is a real job', () => {
  const known = new Set(ADMIN_JOBS.map((j) => j.name));
  for (const name of PREFILL_CONSUMER_JOBS) {
    assert.ok(known.has(name), `${name} is registered as a prefill consumer but is not a known admin job`);
  }
});

test('the honest majority: most form-driven jobs are NOT prefilled, and the box must know it', () => {
  const formDriven = ADMIN_JOBS.filter((j) => j.fields.length > 0);
  const readable = formDriven.filter((j) => jobPrefillIsRead(j.name));
  assert.ok(formDriven.length > 100, 'the job set shrank unexpectedly — re-measure this guard');
  assert.ok(
    readable.length < formDriven.length,
    'every form-driven job now claims to be prefilled — if that is genuinely true, delete this test; if not, the registry is lying',
  );
  // And the one that IS wired must stay wired: it is the flagship.
  assert.ok(
    jobPrefillIsRead('createCanonicalLeaf'),
    'createCanonicalLeaf stopped being a prefill consumer — the flagship example no longer fills its form',
  );
});
