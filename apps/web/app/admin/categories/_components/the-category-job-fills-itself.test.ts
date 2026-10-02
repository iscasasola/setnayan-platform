/**
 * the-category-job-fills-itself.test.ts — the owner's own sentence ends on a
 * form that is already filled in, not on an empty one.
 *
 * ── THE DEFECT, THROUGH THREE PULL REQUESTS ─────────────────────────────────
 * The owner typed, in production, *"add a new category on the taxonomy
 * service"*. #4888 built the fill-a-form flow, #4892 made the offer exist,
 * #4895 made it reachable — and his sentence still ended on an empty form,
 * because a CATEGORY is `createTaxonomyNode` and the only job any page ever
 * read back was `createCanonicalLeaf`, which adds a SERVICE inside a category
 * that already exists. Two different acts, two different forms. The box asked
 * his two questions — which parent, what label — and discarded both answers.
 *
 * Every guard stayed green throughout, because the job that WAS wired was
 * wired correctly. **Naming the flagship wrongly is how a feature comes to be
 * complete for everything except the case it exists for.**
 *
 * ── WHAT THIS FILE CAN AND CANNOT DO ────────────────────────────────────────
 * The studio is a `'use client'` component and cannot be imported into a
 * node:test file, so the reader is checked against COMMENT-STRIPPED source.
 * What it refuses to hand-type is the FIELD LIST: the params the page must
 * read are derived from `admin-jobs.generated.ts`, so a job that grows a field
 * fails here instead of silently dropping that answer on the floor — which is
 * the exact shape of the bug above, one size smaller.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import { askParamKey } from '@/lib/admin-map/humanize-field';
import { jobPrefillIsRead } from '@/lib/admin-map/prefill-consumers';

const HERE = dirname(fileURLToPath(import.meta.url));
const studio = () => stripComments(readFileSync(join(HERE, 'ask-prefill.tsx'), 'utf8'));
const page = () => stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

const JOB = 'createTaxonomyNode';
const job = ADMIN_JOBS.find((j) => j.name === JOB);

test('the category job is registered as a prefill consumer', () => {
  assert.ok(job, `${JOB} is not a known admin job — the generator or the action moved`);
  assert.ok(
    jobPrefillIsRead(JOB),
    `${JOB} is not a prefill consumer, so the box will say "this page does not fill itself in" for the owner's own sentence`,
  );
});

/**
 * 🔑 DERIVED, NEVER LISTED. A hand-typed pair of param names is a list of the
 * fields somebody thought of on the day.
 */
test('the studio reads back every field the generated job carries', () => {
  const src = studio();
  assert.ok(job!.fields.length > 0, `${JOB} has no fields — re-measure this guard`);
  for (const field of job!.fields) {
    assert.ok(
      src.includes(`'${askParamKey(field)}'`),
      `the studio never reads ${askParamKey(field)}, so the admin's answer for "${field}" is gathered and thrown away`,
    );
  }
});

test('the studio compares the ask marker against this job by name', () => {
  const src = studio();
  // The same shape prefill-consumers.test.ts scans for, so the registry and the
  // page can never disagree about who consumes what.
  assert.match(
    src,
    new RegExp(`ADMIN_ASK_PARAM\\)\\s*[!=]==\\s*['"]${JOB}['"]`),
    `the studio stopped reading the ${JOB} marker — the owner's sentence lands on an empty form again`,
  );
});

/**
 * 🔒 IT PREPARES, IT NEVER PRESSES — the one-person admin plan (2026-07-11).
 * The prepared category must be a REAL form the admin submits, not a
 * programmatic call fired on arrival. The everyday "Add tile" ghost calls the
 * action directly from a click handler, which is fine — a person pressed it —
 * so this is anchored on the PREFILL form, not on the file.
 */
test('the prepared category is a real form the admin submits — nothing is created on arrival', () => {
  const src = studio();
  const formIdx = src.indexOf('action={createTaxonomyNode}');
  assert.ok(
    formIdx > 0,
    'there is no <form action={createTaxonomyNode}> — the prepared category cannot be submitted by the admin',
  );
  // The prefill state must gate that form, or it renders for everybody.
  assert.match(
    src,
    /\{newCategoryPrefill \? \(/,
    'the prepared-category form is no longer gated on a prefill actually arriving',
  );
  // And the effect must not submit for them.
  assert.ok(
    !/await createTaxonomyNode\([^)]*\)[\s\S]{0,80}newCategoryPrefill/.test(src),
    'the prefill path submits the category itself — the machine may prepare and hold back, never press',
  );
  const form = src.slice(formIdx, formIdx + 2600);
  for (const field of job!.fields) {
    assert.ok(
      form.includes(`name="${field}"`),
      `the prepared form has no input named "${field}" — the action reads it and will refuse`,
    );
  }
  assert.match(form, /<SubmitButton/, 'the prepared form has no submit control for the admin to press');
});

/**
 * ⚠ PREPARED AND INVISIBLE. In the Studio the composer lived in the tile grid
 * and four views replaced that grid, so an ask could render the prepared form
 * into a pane that was not on screen. On /admin/categories the reader is
 * mounted above BOTH panes, so whatever list, filter or panel is open, the
 * prepared category is the first thing on screen.
 */
test('the prepared category renders above every pane, whatever is open', () => {
  const src = page();
  const host = src.indexOf('<AskPrefill');
  assert.ok(host > 0, 'the categories page no longer mounts the reader — the owner sentence lands nowhere');
  assert.ok(host < src.indexOf('data-pane="list"'), 'the reader moved inside the list pane');
  assert.ok(host < src.indexOf('data-pane="panel"'), 'the reader moved inside the panel pane');
});

/**
 * 🔑 A MISS IS SAID OUT LOUD. The box only ever has the WORDS the admin typed
 * for the parent, never a real id. Guessing one files a category under the
 * wrong folder silently, which is worse than asking again.
 */
test('an unresolved parent is shown, not guessed', () => {
  const src = studio();
  assert.match(
    src,
    /parentId: parent\?\.id \?\? null/,
    'an unresolved parent no longer resolves to null — it is being guessed',
  );
  assert.match(
    src,
    /newCategoryPrefill\.parentId === null && newCategoryPrefill\.parentQuery/,
    'a parent that matched nothing is no longer surfaced to the admin — the miss is silent again',
  );
});
