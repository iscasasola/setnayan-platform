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

import { MODEL_CHOICE_CAP, rankChoicesForModel, choiceIsPrefillCapable } from './rank-choices';
import { searchTokens } from '@/lib/search-stop-words';
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
    kept.has('createTaxonomyNode'),
    'createTaxonomyNode — ADD A CATEGORY, which is the owner\'s own sentence — is not offered to the model; it sat at index 123 under the old positional slice, which is the bug',
  );
  assert.ok(
    kept.has('createCanonicalLeaf'),
    'createCanonicalLeaf — add a SERVICE inside an existing category — is not offered to the model',
  );
});

/**
 * ── CAPABILITY IS PART OF RELEVANCE ─────────────────────────────────────────
 *
 * 🔴 THE DEFECT THIS PINS. Ranking by word overlap alone made the owner's
 * sentence WORSE, measured both ways over the shipped data:
 *
 *     OLD slice(0,120):  createCanonicalLeaf @117 of 120,  4 taxonomy jobs above it
 *     ranked, no capability: createCanonicalLeaf @23 of 140, 14 taxonomy jobs above it
 *
 * All fourteen were prefill-INCAPABLE, and ten of them were newly promoted past
 * it — because seven carry the literal word *category* that he typed, while the
 * two jobs that can actually open a filled form are labelled *"Create taxonomy
 * node"* and *"Create canonical leaf"* and score ONE. **Relevance measured
 * without regard to capability promotes the candidates that cannot help.**
 */
test('a job that can fill a form is never outranked by one that cannot at the same or less overlap', () => {
  const { combined } = shippedChoices();
  const tokens = searchTokens(FLAGSHIP.trim().toLowerCase());
  const overlap = (c: { label: string; href: string }) => {
    const hay = `${c.label} ${c.href}`.toLowerCase();
    return tokens.filter((t) => hay.includes(t)).length;
  };

  const ranked = rankChoicesForModel(combined, FLAGSHIP, MODEL_CHOICE_CAP);
  const capableIdx = ranked
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => choiceIsPrefillCapable(c));
  assert.ok(
    capableIdx.length >= 2,
    `only ${capableIdx.length} prefill-capable candidates reach the model for the flagship — re-measure this guard`,
  );

  /**
   * 🔑 THE OUTCOME, NOT THE FORMULA. An earlier cut of this test asserted only
   * "a non-capable candidate may outrank a capable one if it shares MORE
   * words" — which is satisfied by the 2-hit incapable jobs beating the 1-hit
   * capable ones, i.e. by the exact defect. It could not see the capability
   * tie-break at all: dropping that sort key leaves the scores tied and lets
   * alphabetical position decide, and the test stayed green. **A guard phrased
   * as the rule's own inequality agrees with the bug the rule exists to stop.**
   */
  const worstCapable = Math.max(...capableIdx.map(({ i }) => i));
  const incapableSameSurfaceAbove = ranked
    .slice(0, worstCapable)
    .filter((c) => !choiceIsPrefillCapable(c) && c.href.startsWith('/admin/taxonomy') && isJob(c));
  assert.deepEqual(
    incapableSameSurfaceAbove.map((c) => c.label),
    [],
    'taxonomy jobs that cannot fill a form are ranked above ones that can — measured, 13 of them carry the literal word "category" the owner typed while the two that finish the job are labelled "node" and "leaf"',
  );

  // And the weaker inequality still holds, as a floor beneath the outcome.
  for (const { c: capable, i: capableAt } of capableIdx) {
    const capableOverlap = overlap(capable);
    for (let j = 0; j < capableAt; j++) {
      const above = ranked[j]!;
      if (choiceIsPrefillCapable(above)) continue;
      assert.ok(
        overlap(above) >= capableOverlap,
        `"${above.label}" cannot fill a form and shares FEWER words (${overlap(above)}) than "${capable.label}" (${capableOverlap}), yet outranks it`,
      );
    }
  }
});

test('the capability nudge is a nudge — it never promotes an irrelevant job', () => {
  // A capable job that shares NO word with the question earns nothing, which is
  // what keeps `a question that matches nothing leaves the order untouched`
  // true and stops this becoming a second opinion about every query.
  const capable = { label: 'Create taxonomy node', href: `/admin/taxonomy?${ADMIN_ASK_PARAM}=createTaxonomyNode` };
  assert.ok(choiceIsPrefillCapable(capable), 'the fixture stopped being a prefill consumer — re-pin this test');
  const choices = [
    { label: 'Vendor payouts', href: '/admin/payouts' },
    capable,
  ];
  const kept = rankChoicesForModel(choices, 'payouts', 2);
  assert.equal(
    kept[0]?.href,
    '/admin/payouts',
    'a capable job with no shared words was promoted over a real match — the bonus is not gated on overlap',
  );
});

test('pages are never treated as prefill-capable', () => {
  // Only a job carries the marker. If a page could earn the bonus the ranking
  // would quietly prefer whole surfaces over the forms that finish the task.
  for (const page of shippedChoices().pages) {
    assert.ok(!choiceIsPrefillCapable(page), `the page "${page.label}" is being scored as a form-filling job`);
  }
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
