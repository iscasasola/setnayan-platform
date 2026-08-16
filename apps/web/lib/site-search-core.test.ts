/**
 * lib/site-search-core.test.ts — THE BOX MUST FIND WHAT ITS WORDS PROMISE.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * The public search box read "Search suppliers, stories and guides" from the
 * day it shipped, and its form went to the supplier marketplace and nowhere
 * else. Measured on the live site 2026-08-15: `/explore?q=doves` answered
 * "No vendors match exactly" while `/blog/release-of-doves-filipino-wedding`
 * returned a real, indexed page.
 *
 * 🔑 THE REGRESSION IS SILENT BY CONSTRUCTION. Nothing throws when a promised
 * noun has no source — the page renders, the query runs, and the visitor is
 * told there is nothing. That is indistinguishable from "we have no articles
 * about doves", which is why it survived from the day it shipped. Only an
 * assertion that a KNOWN-PUBLISHED document is findable can catch it.
 *
 * ── AND THE OTHER HALF: THE PROMISE IS DERIVED, NOT RE-TYPED ───────────────
 * A guard comparing two hand-typed strings is not a guard. The placeholder is
 * BUILT from `PUBLIC_SEARCH_NOUNS`, and the resolvers derive their noun list
 * from the sources themselves — so deleting a source drops its noun, and the
 * coverage test below goes red against a placeholder still promising it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  searchInCodeReads,
  searchTokens,
  scoreDocument,
  rankReads,
  normalizedPhrase,
  IN_CODE_READ_NOUNS,
  IN_CODE_SOURCES,
  MARKETPLACE_NOUN,
} from './site-search-core';
import { PUBLIC_SEARCH_NOUNS, publicSearchPlaceholder } from './public-search-nouns';
import { publishedBlogArticles } from './blog';
import { ALL_HELP_ARTICLES } from './help';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

/**
 * Strip comments before scanning source. This repo has shipped five separate
 * guards that matched their own explanatory prose — including one whose
 * comment named the very import it was hunting.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── The promise and the mechanism ──────────────────────────────────────────

test('every noun the box promises has a resolver behind it', () => {
  // `stories` is resolved by the server half; asserted separately below,
  // because importing that module here dies on the uninstalled `server-only`.
  const storyNoun = 'stories';
  const covered = new Set<string>([MARKETPLACE_NOUN, ...IN_CODE_READ_NOUNS, storyNoun]);
  const unbacked = PUBLIC_SEARCH_NOUNS.filter((n) => !covered.has(n));
  assert.deepEqual(
    unbacked,
    [],
    `The box promises ${unbacked.join(', ')} with no resolver — the exact defect ` +
      `this file exists to prevent.`,
  );
});

test('the in-code sources really do cover the noun they claim', () => {
  // Not a declaration check: run each source and require the noun it stamps on
  // its own hits to be the noun it registered. A source that registers
  // 'guides' and emits something else would satisfy a list-only assertion.
  const tokens = searchTokens('wedding');
  for (const source of IN_CODE_SOURCES) {
    const hits = source.find(tokens, 'wedding');
    for (const h of hits) {
      assert.equal(h.noun, source.noun);
    }
  }
  assert.ok(IN_CODE_READ_NOUNS.includes('guides'));
});

test('the story source exists in the server half and is wired to the public pools', () => {
  const src = stripComments(read('lib/site-search.ts'));
  // The two already-public loaders /realstories reads. If a refactor drops
  // them, `stories` becomes a promise with nothing behind it and the words
  // above keep offering it.
  assert.match(src, /\bloadPublishedShowcases\s*\(/, 'no editorial source in site-search.ts');
  assert.match(src, /\bloadFeaturedChapters\s*\(/, 'no chapter source in site-search.ts');
  assert.match(
    src,
    /READ_SOURCE_NOUNS[\s\S]{0,200}STORY_NOUN/,
    'READ_SOURCE_NOUNS no longer derives from the story source',
  );
  /*
   * 🪤 THE STORY RANKING MUST GET THE WHOLE QUERY, NOT THE STRIPPED TOKENS.
   * Caught by mutation: swapping `normalizedPhrase(query)` for
   * `tokens.join(' ')` here left the suite GREEN, because every phrase test
   * calls `scoreDocument` directly and none of them exercises this file's
   * wiring — and this file cannot be imported by a unit test at all
   * (uninstalled `server-only`). A source assertion is the only thing that can
   * fail here, so it is the thing that has to exist.
   */
  assert.match(
    src,
    /storyHits\(\s*tokens\s*,\s*normalizedPhrase\(query\)\s*\)/,
    'the story source no longer receives the whole typed query as its phrase',
  );
});

test('the placeholder is built from the promise, and still reads as it shipped', () => {
  assert.equal(publicSearchPlaceholder(), 'Search suppliers, stories and guides');
});

test('the shell renders the derived placeholder, not a typed copy of it', () => {
  const shell = stripComments(
    read('app/_components/frontdoor/front-door-shell.tsx'),
  );
  assert.match(
    shell,
    /placeholder=\{publicSearchPlaceholder\(\)\}/,
    'the search box went back to a hand-typed placeholder',
  );
  const hardcoded = (shell.match(/Search suppliers, stories and guides/g) ?? []).length;
  assert.equal(
    hardcoded,
    0,
    'the promise is typed into the shell again — that is how it drifted from the ' +
      'mechanism for two days',
  );
});

// ── Matching behaviour ─────────────────────────────────────────────────────

test('an untyped box returns nothing', () => {
  assert.deepEqual(searchTokens(''), []);
  assert.deepEqual(searchTokens('   '), []);
  // One stray character matches nearly every document; a page of noise for a
  // single keystroke is worse than nothing.
  assert.deepEqual(searchTokens('a'), []);
  assert.deepEqual(searchInCodeReads(''), []);
});

test('every token must appear — two words mean both', () => {
  // The claim is AND semantics, so assert the BEHAVIOUR, not a magic total: a
  // score pinned to an exact number breaks whenever the weights are retuned
  // and teaches the next person to edit the expectation rather than think.
  const both = scoreDocument('A Filipino wedding checklist', 'body', ['wedding', 'checklist']);
  const onlyOne = scoreDocument('A Filipino wedding checklist', 'body', ['wedding', 'kangaroo']);
  assert.ok(both > 0, 'a document containing both words must match');
  assert.equal(onlyOne, 0, 'one missing word must reject the document outright');
});

test('a title match outranks a body match', () => {
  /*
   * 🪤 THE TOKENS ARE DELIBERATELY OUT OF PHRASE ORDER.
   *
   * The obvious version of this test — one token, "brownout", in a title vs in
   * a body — PASSED with the title weight sabotaged to equal the body weight.
   * The exact-phrase bonus was doing all the work, so a test named for the
   * title weight proved nothing about it. Caught by mutation, not by reading.
   *
   * Searching ['brownout','wedding'] against "wedding … brownout" means the
   * joined phrase appears in neither document, so the bonus is zero on both
   * sides and the only thing separating them is the weight this test is about.
   */
  const tokens = ['brownout', 'wedding'];
  const titled = scoreDocument('The wedding brownout plan', 'unrelated body', tokens);
  const buried = scoreDocument('Something else entirely', 'the wedding brownout plan', tokens);
  assert.ok(titled > buried, `title ${titled} should outrank body ${buried}`);
});

test('an exact phrase in the title beats scattered tokens', () => {
  const phrase = scoreDocument('The release of doves', '', ['release', 'of', 'doves']);
  const scattered = scoreDocument('Doves fly and the release form', '', ['release', 'of', 'doves']);
  assert.ok(phrase > scattered, `${phrase} should beat ${scattered}`);
});

// ── The owner's own failing case, end to end ───────────────────────────────

test("the owner's query finds the guide the live site could not", () => {
  const doves = publishedBlogArticles().find(
    (a) => a.slug === 'release-of-doves-filipino-wedding',
  );
  assert.ok(
    doves,
    'The doves guide is no longer published — point this at another published ' +
      'slug rather than deleting the test; the assertion is the point.',
  );

  const hrefs = searchInCodeReads('doves').map((h) => h.href);
  assert.ok(
    hrefs.includes('/blog/release-of-doves-filipino-wedding'),
    `searched "doves" and got ${hrefs.length ? hrefs.join(', ') : 'nothing'}`,
  );
});

test('guides are reachable and every row says what it is', () => {
  const hits = searchInCodeReads('wedding');
  assert.ok(hits.length > 0, 'no published guide matched "wedding"');
  for (const h of hits) {
    // A row with no kind label reads as a shop on a marketplace page.
    assert.ok(h.tag.length > 0, `${h.href} has no kind label`);
    assert.ok(h.href.startsWith('/'), `expected an in-app path, got ${h.href}`);
    assert.ok(h.title.length > 0);
  }
});

test('the help corpus is searchable too — it is a guide to a reader', () => {
  // Search a real help article's own title, so this cannot pass on a word that
  // happens to live in the Journal instead.
  const sample = ALL_HELP_ARTICLES[0];
  assert.ok(sample, 'the help corpus is empty');
  const hits = searchInCodeReads(sample.article.title);
  assert.ok(
    hits.some((h) => h.href === `/help/${sample.article.slug}`),
    `searching a help article's exact title did not return it (${sample.article.slug})`,
  );
});

test('a query with no answer returns nothing rather than everything', () => {
  assert.deepEqual(searchInCodeReads('zzzqqxvv nonexistent gibberish'), []);
});

test('results are capped, so one broad word cannot print the whole library', () => {
  const all = searchInCodeReads('the');
  assert.ok(rankReads(all, 8).length <= 8);
});

test('ranking is stable — the same query cannot reshuffle between renders', () => {
  const hits = searchInCodeReads('wedding');
  const a = rankReads(hits, 8).map((h) => h.href);
  const b = rankReads([...hits].reverse(), 8).map((h) => h.href);
  assert.deepEqual(a, b);
});

test('a sentence-shaped question is not vetoed by its function words', () => {
  /*
   * 🪤 THE REGRESSION THIS CATCHES IS A ZERO, NOT A CRASH. Matching is AND, so
   * before the stop-word list every word had to appear — "my" appearing
   * nowhere in a help article rejected the article that answered the question.
   * Measured: "cancel my order" returned 0 results against a corpus that
   * plainly covers it. Help queries are the sentence-shaped ones.
   */
  assert.ok(!searchTokens('cancel my order').includes('my'));
  assert.ok(searchTokens('cancel my order').includes('cancel'));
});

test('a query of nothing but function words still means those words', () => {
  // Stripping them all would silently turn a real query into an empty one.
  assert.deepEqual(searchTokens('the of and'), ['the', 'of', 'and']);
});

test('the phrase bonus reads the WHOLE query, not the stripped tokens', () => {
  // "of" is a stop word, so a phrase built from tokens would be "release
  // doves" and would miss the article actually titled "The release of doves".
  assert.equal(normalizedPhrase('The release of doves'), 'the release of doves');
  const withPhrase = scoreDocument(
    'The release of doves: a Filipino wedding tradition',
    '',
    searchTokens('The release of doves'),
    normalizedPhrase('The release of doves'),
  );
  const withoutPhrase = scoreDocument(
    'Doves, and how we release them',
    '',
    searchTokens('The release of doves'),
    normalizedPhrase('The release of doves'),
  );
  assert.ok(withPhrase > withoutPhrase, `${withPhrase} should beat ${withoutPhrase}`);
});
