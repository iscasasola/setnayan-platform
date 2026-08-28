/**
 * match-job.test.ts — the job matcher finds a job by its OWN words, and never
 * borrows a single filler word to fake a match.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_JOBS } from './admin-jobs.generated';
import { matchJobs, formDrivenJobs, jobDisplayLabel } from './match-job';

test('every job offered is form-driven — nothing with zero fields is suggested', () => {
  const jobs = formDrivenJobs(ADMIN_JOBS);
  assert.ok(jobs.length > 0);
  for (const j of jobs) assert.ok(j.job.fields.length > 0, `${j.job.name} has no fields to ask about`);
});

test('the job\'s own words find it', () => {
  const hits = matchJobs(ADMIN_JOBS, 'create canonical leaf', 5);
  assert.ok(hits.some((h) => h.job.name === 'createCanonicalLeaf'), 'the exact phrase missed its own job');

  const hits2 = matchJobs(ADMIN_JOBS, 'add leaf attribute option', 5);
  assert.ok(
    hits2.some((h) => h.job.name === 'addLeafAttributeOptionAction'),
    'a close paraphrase of the job\'s own name missed it',
  );
});

test('one shared filler word is not evidence — 43+ jobs start with "add"', () => {
  // Regression for the exact false-positive this file's coverage gate exists
  // to prevent: "add" alone must not crown a job that only shares that word.
  const hits = matchJobs(ADMIN_JOBS, 'add', 5);
  assert.deepEqual(hits, [], `"add" alone suggested a job: ${hits.map((h) => h.job.name).join(', ')}`);
});

test('a genuine semantic gap is left honestly unanswered here', () => {
  // "add a category" and createCanonicalLeaf share no literal word for the
  // taxonomy sense of "category" — this file does not pretend to bridge that;
  // ask-the-admin.ts (the AI step) is what closes it, once, and remembers.
  const hits = matchJobs(ADMIN_JOBS, 'add a new category on the taxonomy service', 5);
  assert.ok(
    !hits.some((h) => h.job.name === 'createCanonicalLeaf'),
    'the coverage gate stopped doing its job — a generic sentence now matches by accident',
  );
});

test('an empty or all-stop-word query suggests nothing', () => {
  assert.deepEqual(matchJobs(ADMIN_JOBS, '', 5), []);
  assert.deepEqual(matchJobs(ADMIN_JOBS, 'the a of', 5), []);
});

test('the display label is the phrase, capitalised — never the raw function name', () => {
  const leaf = ADMIN_JOBS.find((j) => j.name === 'createCanonicalLeaf');
  assert.ok(leaf);
  assert.equal(jobDisplayLabel(leaf!), 'Create canonical leaf');
  assert.ok(!jobDisplayLabel(leaf!).includes('createCanonicalLeaf'));
});
