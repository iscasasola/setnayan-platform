/**
 * admin-jobs-are-generated.test.ts — the checklist cannot go stale, and cannot
 * quietly shrink to nothing.
 *
 * The second failure mode matters more than the first here. A route scan that
 * breaks returns an obviously empty list; a BODY scan that breaks returns every
 * job with zero fields — a perfectly well-formed checklist that asks for
 * nothing. Every floor below exists for that.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanAdminJobs, phraseFor } from './scan-admin-jobs';
import { ADMIN_JOBS } from './admin-jobs.generated';
import { ADMIN_ROUTES } from './admin-routes.generated';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const ADMIN = join(WEB, 'app/admin');

test('the committed checklist matches the code exactly', () => {
  const live = scanAdminJobs(ADMIN);
  const names = live.map((j) => j.name);
  const committed = ADMIN_JOBS.map((j) => j.name);
  assert.deepEqual(
    {
      added: names.filter((n) => !committed.includes(n)),
      gone: committed.filter((n) => !names.includes(n)),
    },
    { added: [], gone: [] },
    'admin jobs changed — run: pnpm --filter @setnayan/web admin:jobs',
  );
  assert.deepEqual(live, [...ADMIN_JOBS], 'run: pnpm --filter @setnayan/web admin:jobs');
});

test('the scan still reads bodies — the floors', () => {
  assert.ok(ADMIN_JOBS.length >= 250, `only ${ADMIN_JOBS.length} jobs found`);
  const formDriven = ADMIN_JOBS.filter((j) => j.fields.length);
  assert.ok(formDriven.length >= 150, `only ${formDriven.length} jobs read any field`);
  const refusing = ADMIN_JOBS.filter((j) => j.refusedWhenEmpty.length);
  assert.ok(refusing.length >= 30, `only ${refusing.length} jobs prove a refusal`);
  const destructive = ADMIN_JOBS.filter((j) => j.destructive);
  assert.ok(destructive.length >= 20, `only ${destructive.length} jobs read as destructive`);
});

test('the worked example the owner described is read correctly', () => {
  // "on taxonomy, it is like having a pick category, and other details" —
  // owner, 2026-08-26. This is that job, and it is the canary for the body
  // reader: if bodyOf ever stops finding a function, this is where it shows.
  const job = ADMIN_JOBS.find((j) => j.name === 'createCanonicalLeaf');
  assert.ok(job, 'createCanonicalLeaf is gone — pick another canary');
  assert.equal(job.ownerPath, '/admin/taxonomy');
  assert.deepEqual(job.fields, [
    'tile_id',
    'display_name_en',
    'is_rental',
    'is_ph',
    'faith',
    'refinement_label',
    'refinement_options',
  ]);
  // Both refusals, written two different ways in the source: `if (!tileId)` and
  // a length floor on the label. Catching only the first is what the field's
  // name (refusedWhenEmpty, not "required") exists to stop us claiming.
  assert.deepEqual(job.refusedWhenEmpty, ['tile_id', 'display_name_en']);
});

test('every job resolves to a page that exists', () => {
  const paths = new Set(ADMIN_ROUTES.map((r) => r.path));
  const orphans = ADMIN_JOBS.filter((j) => !paths.has(j.resolvedPath)).map(
    (j) => `${j.name} → ${j.resolvedPath}`,
  );
  assert.deepEqual(orphans, [], 'a job resolves to a page with no route');
});

test('the jobs whose screen is not in their own folder still land somewhere real', () => {
  // Found by the guard above, not by reading: five jobs live in a folder with no
  // page. Pinned so the resolution cannot silently regress to the folder itself.
  const moved = ADMIN_JOBS.filter((j) => j.ownerPath !== j.resolvedPath);
  assert.ok(moved.length >= 5, `only ${moved.length} jobs needed resolving — did the walk stop?`);
  const storyteller = ADMIN_JOBS.find((j) => j.name === 'setChapterFeatured');
  assert.ok(storyteller);
  assert.equal(storyteller.ownerPath, '/admin/storytellers', 'the actions moved — re-pin this');
  assert.equal(storyteller.resolvedPath, '/admin/studio', 'a page-less folder stopped resolving');
});

test('a job is named in words, not in camelCase', () => {
  assert.equal(phraseFor('createCanonicalLeaf'), 'create canonical leaf');
  assert.equal(phraseFor('addLeafAttributeFieldAction'), 'add leaf attribute field');
  assert.equal(phraseFor('setNpcFilingTask'), 'set npc filing task');
  const camel = ADMIN_JOBS.filter((j) => /[A-Z]/.test(j.phrase)).map((j) => j.phrase);
  assert.deepEqual(camel, [], 'a job phrase kept its camelCase');
});
