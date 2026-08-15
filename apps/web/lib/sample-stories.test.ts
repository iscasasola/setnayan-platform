/**
 * lib/sample-stories.test.ts — THE SHOP WINDOW MUST SHOW THE WHOLE SHOP,
 * AND MUST TAKE ITSELF DOWN.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * Measured live 2026-08-15, before this suite existed: NINE complete sample
 * stories — a debut, a graduation, a reunion, a golden anniversary and five
 * weddings — were written, deployed, and reachable at their own URLs, while
 * /realstories linked to NONE of them. The page asked `showcases.length === 0`
 * and prod holds ONE seeded sample ROW, so a single database record switched
 * the entire library off. `sitemap-weddings.xml` meanwhile handed all nine to
 * Google. Orphan pages: indexed, unlinked, fictional.
 *
 * 🔑 THE FAILURE IS AN ABSENCE, AGAIN. Nothing threw. The page rendered
 * perfectly with one card on it, and looked exactly like a page that simply
 * had one story. Only an assertion about COVERAGE can see it.
 *
 * ── AND THE RULE IS DERIVED, NOT HAND-TYPED ────────────────────────────────
 * Coverage is checked against `ANCHOR_BY_TYPE` — the same canonical roster
 * `event-type-coverage.test.ts` already uses for "every event type must have
 * X". Add a seventeenth kind to the product and this suite demands a sample
 * for it, without anyone editing a list here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ANCHOR_BY_TYPE } from './event-anchor';
import { ALL_REAL_WEDDINGS } from './real-weddings';
import { SAMPLE_STORIES_RETIRE_AT, sampleStoriesAreShowing } from './sample-stories';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/** Comments stripped first — this repo has shipped guards that matched their own prose. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 'Gender Reveal' → 'gender_reveal', matching the roster's keys. */
const snake = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');

const ROSTER = Object.keys(ANCHOR_BY_TYPE);
const COVERED = new Set(ALL_REAL_WEDDINGS.map((w) => snake(w.eventType)));

// ── Coverage: every kind of event we sell ──────────────────────────────────

test('every event kind the product supports has at least one sample story', () => {
  const missing = ROSTER.filter((k) => !COVERED.has(k));
  assert.deepEqual(
    missing,
    [],
    `No sample story for: ${missing.join(', ')}. The Stories page is the shop ` +
      `window for what Setnayan does — a kind with no sample is a kind a ` +
      `visitor cannot see us doing.`,
  );
});

test('no sample claims an event kind the product does not have', () => {
  const invented = [...COVERED].filter((k) => !ROSTER.includes(k));
  assert.deepEqual(
    invented,
    [],
    `Sample stories claim unknown kinds: ${invented.join(', ')}. The chips on ` +
      `the Stories page are built from these strings, so an invented one ` +
      `renders a filter for something nobody can book.`,
  );
});

// ── Honesty ────────────────────────────────────────────────────────────────

test('every curated story is badged as a sample', () => {
  // These are fictional people on a public, crawlable page. A single unbadged
  // one reads as a real customer's wedding.
  for (const w of ALL_REAL_WEDDINGS) {
    assert.equal(w.isSample, true, `${w.slug} is not badged as a sample`);
  }
});

test('no sample points at a cover image that is not there', () => {
  /*
   * 🪤 THIS EXACT BUG WAS LIVE. Three samples — the graduation, the reunion
   * and the anniversary — named cover files that returned 404 on the
   * production site. Nothing threw; the card just silently fell back. A
   * missing file is not a design decision, so either ship the art or leave
   * the field off and let the fallback be deliberate.
   */
  const broken = ALL_REAL_WEDDINGS.filter(
    (w) => w.heroImageUrl && !existsSync(join(process.cwd(), 'public', w.heroImageUrl)),
  ).map((w) => `${w.slug} → ${w.heroImageUrl}`);
  assert.deepEqual(broken, [], `Cover images that do not exist:\n  ${broken.join('\n  ')}`);
});

test('identifiers are unique — a duplicate silently hides a story', () => {
  const slugs = ALL_REAL_WEDDINGS.map((w) => w.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate sample slug');
  const editions = ALL_REAL_WEDDINGS.filter((w) => w.editionNumber != null).map(
    (w) => w.editionNumber,
  );
  assert.equal(new Set(editions).size, editions.length, 'duplicate edition number');
});

test('every palette entry is a real colour', () => {
  // The cards paint their fallback treatment from these. A malformed value
  // renders as "no colour" rather than as an error.
  for (const w of ALL_REAL_WEDDINGS) {
    for (const c of w.palette) {
      assert.match(c, /^#[0-9A-Fa-f]{6}$/, `${w.slug} has a bad colour: ${c}`);
    }
  }
});

// ── The retire rule (owner, 2026-08-15) ────────────────────────────────────

test('samples show until five real stories are public, then stop', () => {
  for (let n = 0; n < SAMPLE_STORIES_RETIRE_AT; n += 1) {
    assert.equal(sampleStoriesAreShowing(n), true, `should still show at ${n} real stories`);
  }
  assert.equal(sampleStoriesAreShowing(SAMPLE_STORIES_RETIRE_AT), false, 'should retire at the threshold');
  assert.equal(sampleStoriesAreShowing(SAMPLE_STORIES_RETIRE_AT + 40), false, 'should stay retired');
});

test('a nonsense count fails toward showing, never toward an empty page', () => {
  assert.equal(sampleStoriesAreShowing(-1), true);
  assert.equal(sampleStoriesAreShowing(Number.NaN), true);
});

// ── Anti-drift: both publishers ask the same question ──────────────────────

test('the Stories page counts REAL stories, not database rows', () => {
  const src = stripComments(read('app/realstories/page.tsx'));
  assert.match(
    src,
    /sampleStoriesAreShowing\(/,
    'the page no longer asks the shared retire rule',
  );
  /*
   * 🚨 THE ORIGINAL DEFECT, PINNED. `showcases.length === 0` treated the
   * seeded sample row as a story and hid nine finished pages behind it.
   */
  assert.doesNotMatch(
    src,
    /showingSamples\s*=\s*showcases\.length\s*===\s*0/,
    'the page is counting rows again — a seeded sample row will hide the library',
  );
  assert.match(
    src,
    /realStories\s*=\s*showcases\.filter\(\(s\) => !s\.isSample\)/,
    'the real-story count must exclude samples',
  );
});

test('the sitemap asks the same rule, so it cannot outlive the page', () => {
  /*
   * 🔑 THIS IS THE HALF THAT ROTS QUIETLY. A page that stops rendering samples
   * is obvious immediately; a sitemap still offering twenty fictional URLs
   * after they vanished is visible to nobody but a crawler.
   */
  const src = stripComments(read('app/sitemap-weddings.xml/route.ts'));
  assert.match(
    src,
    /sampleStoriesAreShowing\(/,
    'the sitemap decides on its own again — it will keep publishing retired samples',
  );
});
