/**
 * rank-choices.test.ts — form-driven jobs can never be severed from the
 * assistant by an accident of sorting.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────
 * `ask-actions.ts` handed the model `choices.slice(0, 120)` over a list built
 * as [...pages, ...jobs]. Measured by execution over the shipped data:
 *
 *     86 pages + 185 form-driven jobs = 271 combined
 *     slice(0, 120) → 34 jobs kept, 151 (82%) never reached the model
 *     createTaxonomyNode  @123  ALREADY CUT
 *     createCanonicalLeaf @116  four new admin pages from being cut
 *     37 of the 43 taxonomy-surface jobs were beyond the cut
 *
 * 🪤 AND NOTHING GUARDED IT. `grep -rln "jobChoices\|choices.slice"` over every
 * test file returned ZERO, and mutating the cap to `slice(0, 86)` — severing
 * every job from the model — changed no test result anywhere in the repo.
 *
 * This file is that missing guard. It executes the real ranker over the real
 * shipped choice list and imports the real cap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MODEL_CHOICE_CAP, rankChoicesForModel } from './rank-choices';
import { ADMIN_JOBS } from './admin-jobs.generated';
import { jobDisplayLabel } from './match-job';
import { ADMIN_ASK_PARAM } from './humanize-field';
import { buildDestinations } from '@/app/admin/_components/admin-destinations';

const FLAGSHIP = 'add a new category on the taxonomy service';

/** Exactly what the palette hands to `askTheAdmin` — pages first, then jobs. */
function shippedChoices() {
  const pages = buildDestinations()
    .filter((d) => d.source !== 'row')
    .map((d) => ({ label: d.label, href: d.href }));
  const jobs = ADMIN_JOBS.filter((j) => j.fields.length > 0).map((j) => {
    const [path, qs] = j.resolvedPath.split('?');
    const params = new URLSearchParams(qs ?? '');
    params.set(ADMIN_ASK_PARAM, j.name);
    return { label: jobDisplayLabel(j), href: `${path}?${params.toString()}` };
  });
  return { pages, jobs, combined: [...pages, ...jobs] };
}

const isJob = (c: { href: string }) => c.href.includes(`${ADMIN_ASK_PARAM}=`);
const names = (list: { href: string }[]) =>
  new Set(list.map((c) => new URL(c.href, 'https://admin.invalid').searchParams.get(ADMIN_ASK_PARAM)));

test('the shipped list is still bigger than the cap — otherwise this guard proves nothing', () => {
  const { pages, jobs, combined } = shippedChoices();
  assert.ok(pages.length > 0 && jobs.length > 0);
  assert.ok(
    combined.length > MODEL_CHOICE_CAP,
    `the combined list (${combined.length}) now fits inside the cap (${MODEL_CHOICE_CAP}) — nothing is being cut, so re-check why this guard exists`,
  );
});

/**
 * 🔑 THE ANTI-SEVERING FLOOR. This is the assertion that goes red for
 * `slice(0, 86)`: with the cap at or below the page count, a question that
 * shares no words with any job leaves ZERO jobs in front of the model, and the
 * fill-a-form half of the feature silently stops existing.
 */
test('form-driven jobs are never severed from the model', () => {
  const { pages, combined } = shippedChoices();
  // A question with no job vocabulary at all — the worst case for jobs.
  for (const q of ['', 'pending payments']) {
    const kept = rankChoicesForModel(combined, q, MODEL_CHOICE_CAP);
    const jobsKept = kept.filter(isJob).length;
    assert.ok(
      jobsKept >= 40,
      `only ${jobsKept} form-driven jobs reach the model for ${JSON.stringify(q)} — the cap (${MODEL_CHOICE_CAP}) is at or below the ${pages.length} page choices, so pages crowd every job out`,
    );
  }
});

test('every admin page still reaches the model — the cap must not fix jobs by cutting pages', () => {
  const { pages, combined } = shippedChoices();
  const kept = rankChoicesForModel(combined, FLAGSHIP, MODEL_CHOICE_CAP);
  assert.equal(
    kept.filter((c) => !isJob(c)).length,
    pages.length,
    'page choices are being cut — a page lookup regression traded for the job fix',
  );
});

/**
 * 🔑 THE RANKING MUST ACTUALLY RANK. Measured: with no ranking at all (the
 * list taken in its original order) only 10 of the 43 taxonomy-surface jobs
 * survive the cap. This assertion is what turns that mutation red.
 */
test('the flagship sentence pulls its OWN surface\'s jobs in front of the model', () => {
  const { combined } = shippedChoices();
  const taxonomyJobs = combined.filter((c) => isJob(c) && c.href.startsWith('/admin/taxonomy'));
  assert.ok(
    taxonomyJobs.length >= 40,
    `only ${taxonomyJobs.length} taxonomy jobs exist — re-measure this guard`,
  );

  const kept = rankChoicesForModel(combined, FLAGSHIP, MODEL_CHOICE_CAP);
  const keptTaxonomy = kept.filter((c) => isJob(c) && c.href.startsWith('/admin/taxonomy')).length;
  assert.equal(
    keptTaxonomy,
    taxonomyJobs.length,
    `the sentence names the taxonomy surface and only ${keptTaxonomy} of its ${taxonomyJobs.length} jobs reach the model — candidates are being chosen by position, not relevance`,
  );
});

test('the flagship job — and its already-cut sibling — are both candidates', () => {
  const { combined } = shippedChoices();
  const kept = names(rankChoicesForModel(combined, FLAGSHIP, MODEL_CHOICE_CAP));
  assert.ok(
    kept.has('createCanonicalLeaf'),
    'the job behind the box\'s own flagship example is not offered to the model',
  );
  assert.ok(
    kept.has('createTaxonomyNode'),
    'createTaxonomyNode is still cut — it sat at index 123 under the old positional slice, which is the bug',
  );
});

test('a question that matches nothing leaves the order untouched', () => {
  const { combined } = shippedChoices();
  // Promotion only. A neutral question must not reshuffle the list, or the
  // ranker becomes a second, invisible opinion about what the box offers.
  const kept = rankChoicesForModel(combined, 'zzzzqqq', MODEL_CHOICE_CAP);
  assert.deepEqual(
    kept.map((c) => c.href),
    combined.slice(0, MODEL_CHOICE_CAP).map((c) => c.href),
  );
});

test('relevance beats position — a late-sorting job outranks an unrelated early page', () => {
  const choices = [
    ...Array.from({ length: 30 }, (_, i) => ({ label: `Unrelated page ${i}`, href: `/admin/p${i}` })),
    { label: 'Zzz last job', href: `/admin/taxonomy?${ADMIN_ASK_PARAM}=zzzLastJob` },
  ];
  const kept = rankChoicesForModel(choices, 'taxonomy', 5);
  assert.equal(kept[0]?.href, `/admin/taxonomy?${ADMIN_ASK_PARAM}=zzzLastJob`);
});
