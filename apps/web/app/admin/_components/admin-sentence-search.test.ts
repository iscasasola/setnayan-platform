/**
 * admin-sentence-search.test.ts — the box answers a sentence, and gives up
 * nothing it already answered.
 *
 * The second half is the one that needs proving. A search change that improves
 * every hard query and quietly re-orders the easy ones is a regression to the
 * person who has learned the easy ones — and the owner uses this box daily.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import { rankBySentence, keepByTokens } from '@/lib/admin-map/rank-by-sentence';
import { searchTokens } from '@/lib/search-stop-words';

import { buildDestinations, type Dest } from './admin-destinations';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALL = buildDestinations();

/**
 * The palette's scorer, copied verbatim from admin-command-palette.tsx.
 *
 * ⚠ A COPY, ON PURPOSE — the palette is a `'use client'` React component and
 * cannot be imported here. A guard below reads its source and fails if the two
 * drift, so this copy cannot silently become fiction.
 */
function score(d: Dest, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}

/** Exactly what the palette did before this change. The regression reference. */
function todaysRanking(query: string): string[] {
  const needle = query.trim().toLowerCase();
  return ALL.map((d) => ({ d, s: score(d, needle) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.label.localeCompare(b.d.label))
    .slice(0, 30)
    .map((x) => x.d.href);
}

const ranked = (q: string) => rankBySentence(ALL, q, score, 30).hits.map((d) => d.href);

test('EVERY single word the admin knows returns exactly what it returned before', () => {
  // The whole no-regression claim, checked against the real vocabulary rather
  // than a handful of examples. If one word in ~900 re-orders, this says which.
  const vocabulary = new Set<string>();
  for (const d of ALL) {
    for (const w of `${d.label} ${d.hay}`.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 2) vocabulary.add(w);
    }
  }
  assert.ok(vocabulary.size > 500, `only ${vocabulary.size} words — the corpus collapsed`);

  const changed: string[] = [];
  for (const word of vocabulary) {
    const before = todaysRanking(word).join('>');
    const after = ranked(word).join('>');
    if (before !== after) changed.push(word);
  }
  assert.deepEqual(changed, [], `${changed.length} single-word queries changed`);
});

test('an empty box is still an empty box', () => {
  assert.deepEqual(ranked(''), ALL.slice(0, 30).map((d) => d.href));
});

test("the owner's own sentences all answer, and the price ones lead with Pricing", () => {
  // Verbatim from the 2026-08-26 conversation. Every one returned NOTHING before.
  const priceSentences = [
    'take me to the pricing for papic services',
    'show me the prices of papic',
    'papic prices',
  ];
  for (const q of priceSentences) {
    const hits = rankBySentence(ALL, q, score, 5).hits;
    assert.ok(hits.length > 0, `"${q}" still answers nothing`);
    assert.match(hits[0]!.href, /\/admin\/pricing/, `"${q}" leads with ${hits[0]!.label}`);
  }
  for (const q of [
    'i want to add a new category on the taxonomy service',
    'who is waiting to be approved',
    'how many events do we have',
  ]) {
    assert.ok(rankBySentence(ALL, q, score, 5).hits.length > 0, `"${q}" answers nothing`);
  }
  assert.equal(
    rankBySentence(ALL, 'i want to add a new category on the taxonomy service', score, 5).hits[0]!
      .href,
    '/admin/taxonomy',
  );
});

test('a word no page knows is reported, never silently dropped', () => {
  const { unknown } = rankBySentence(ALL, 'i want to add a new category', score, 5);
  assert.deepEqual(unknown, ['want'], 'the unmatched word stopped being reported');
  // And a query where everything is known reports nothing.
  assert.deepEqual(rankBySentence(ALL, 'papic prices', score, 5).unknown, []);
});

test('every example the search box ADVERTISES actually works', () => {
  /*
    🪤 THE BOX PRINTED AN EXAMPLE THAT OPENED THE WRONG PAGE. Its placeholder
    reads “papic prices”, “add a category” — and "add a category" tied App
    Performance, Taxonomy and Vendors at coverage 1.0 and mean 15, so the
    ALPHABET decided and a metrics dashboard won the default-selected row. App
    Performance carries the words once, from an "add expense … category" job.

    🔑 THE EXAMPLES ARE READ OUT OF THE COMPONENT, NEVER RE-TYPED HERE. A guard
    that hard-codes the strings stops covering the box the moment somebody edits
    the placeholder — which is exactly when a new example goes unchecked.
  */
  // Stripped first, and CURLY quotes only: the docblock quotes the owner
  // (*"i do not see the AI searchbar"*) and the JSX is full of straight-quoted
  // class names. The placeholder's examples are the ones typeset with “ ”.
  const box = stripComments(readFileSync(join(HERE, 'admin-search-box.tsx'), 'utf8'));
  const examples = [...box.matchAll(/\u201C([^\u201C\u201D]{3,60})\u201D/g)].map((m) => m[1]!);
  assert.ok(examples.length >= 2, `only ${examples.length} examples found in the box — re-pin this`);

  const expected: Record<string, RegExp> = {
    'papic prices': /^\/admin\/pricing/,
    'add a category': /^\/admin\/taxonomy$/,
  };
  for (const ex of examples) {
    const hits = rankBySentence(ALL, ex, score, 5).hits;
    assert.ok(hits.length > 0, `the box advertises "${ex}" and it answers nothing`);
    const want = expected[ex];
    assert.ok(want, `the box advertises "${ex}" — add what it should open to this guard`);
    assert.match(
      hits[0]!.href,
      want,
      `"${ex}" opens ${hits[0]!.label} (${hits[0]!.href}) — the box advertises it, so it must land`,
    );
  }
});

test('an apostrophe does not make the box say something false', () => {
  // 🪤 "vendor's payouts" answered correctly AND printed “No page has the word
  // “vendor's”.” above it — about a word 26 destinations contain. Phones type
  // the curly one (U+2019), so the person cannot see what is wrong. Only the
  // REPORT is corrected; the splitter is shared with the public site search.
  for (const q of ["vendor's payouts", 'vendor\u2019s payouts', "the couple's event"]) {
    const { unknown } = rankBySentence(ALL, q, score, 5);
    const wrong = unknown.filter((w) => /['\u2019]/.test(w));
    assert.deepEqual(wrong, [], `"${q}" reported ${wrong.join(', ')} as unknown`);
  }
  // …and a word the product genuinely does not have is still reported.
  assert.deepEqual(rankBySentence(ALL, 'i want a category', score, 5).unknown, ['want']);
});

test('a word that is only a SUBSEQUENCE is not a match', () => {
  // 🪤 At the palette's weakest band (8, letters of the name in order) the word
  // "prices" matched *Profile corrections* — p·r·i·c·e·s appear in that order —
  // so a price search answered with a page about correcting shop details AND
  // suppressed the honest "no page has that word" report. The per-word floor is
  // 15 for exactly this. Subsequence tolerance still applies to the whole query.
  const profile = ALL.find((d) => d.label === 'Profile corrections');
  assert.ok(profile, 'Profile corrections is gone — pick another example');
  assert.equal(score(profile, 'prices'), 8, 'the subsequence band moved — re-pin this');
  const hits = rankBySentence(ALL, 'papic prices', score, 30).hits;
  assert.ok(
    !hits.some((h) => h.label === 'Profile corrections'),
    'a subsequence coincidence is being offered as a match',
  );
});

test('a one-letter fragment cannot match everything', () => {
  // 🪤 REV 1 OF THIS TEST WAS DECORATION, caught only by mutation. It asserted
  // that "a" was absent from `searchTokens('a b pending')` — but "a" is a STOP
  // WORD, so it was dropped for a different reason entirely, and removing the
  // two-character minimum left the test GREEN. The floor is only observable on a
  // single letter that is NOT filler.
  assert.ok(!searchTokens('s pending').includes('s'), 'a bare letter survived tokenising');
  assert.deepEqual(searchTokens('s pending'), ['pending']);

  // And the consequence it exists to prevent: a lone "s" scores 8 on every page
  // whose name merely contains those letters in order, so it would drag a page
  // of noise into a real query.
  const noisy = ALL.filter((d) => score(d, 's') >= 8).length;
  assert.ok(noisy > 30, `a bare "s" matches ${noisy} pages — that is why it is dropped`);
  assert.equal(
    rankBySentence(ALL, 's pending', score, 30).hits[0]!.href,
    rankBySentence(ALL, 'pending', score, 30).hits[0]!.href,
    'a stray letter changed the answer',
  );
});

test('the whole-string score is the FIRST sort key, not the word average', () => {
  // "pay" scores 100 on Payments/Payouts as a whole string. If the word average
  // led, a page whose haystack merely repeats "pay" could climb above them.
  const first = ranked('pay')[0];
  assert.equal(first, todaysRanking('pay')[0], 'a working query was re-ranked');
});

test('the phone shows EXACTLY the set the laptop ranks — the owner\'s sentences included', () => {
  // 🪤 The existing parity guard compares SOURCE TEXT — whether both files import
  // the shared alias list — so it would have waved through a laptop-only fix.
  // This one runs both rules over one input.
  // 🪤 REV 1 OF THIS GUARD COULD NOT FAIL FOR THE DIVERGENCE IT WAS NAMED FOR.
  // It asked only whether the laptop's TOP hit was somewhere in the phone's set,
  // over four queries that pass either way — while the phone required EVERY word
  // and the laptop any one, so the two owner sentences 70 lines above showed
  // 0 cards against 10 and 16. A one-directional check over hand-picked queries
  // is not a set comparison. Compare the SETS, and include the sentences the
  // feature exists for.
  const hays = ALL.map((d) => d.hay);
  const queries = [
    'papic prices',
    'pending',
    'taxonomy',
    'take me to the pricing for papic services',
    'i want to add a new category on the taxonomy service',
    'who is waiting to be approved',
    'how many events do we have',
  ];
  for (const q of queries) {
    const keep = keepByTokens(hays, q);
    const phone = ALL.filter((_, i) => keep[i]).map((d) => d.href).sort();
    const laptop = rankBySentence(ALL, q, score, ALL.length).hits.map((d) => d.href).sort();
    assert.ok(phone.length > 0, `the phone hides every card for "${q}"`);
    assert.deepEqual(
      phone,
      laptop,
      `the phone and the laptop disagree for "${q}" (${phone.length} vs ${laptop.length})`,
    );
  }
});

test('the palette really uses the sentence ranker, and its scorer matches this copy', () => {
  const src = readFileSync(join(HERE, 'admin-command-palette.tsx'), 'utf8');
  assert.match(src, /rankBySentence\(all, q, score, 30\)/, 'the palette stopped ranking sentences');
  assert.match(src, /unknownNote/, 'the palette stopped reporting unmatched words');
  // The copied scorer above must stay identical to the shipped one.
  // 🪤 THIS LIST IS WHAT MAKES THE COPY HONEST, and it was one band short. A
  // mutation moving the ROW band (`raw / 3` → `raw * 3`) — which would let one
  // catalogue entry shadow the screen that edits all of them — changed nothing
  // any test could see, because the tests score with the copy above. Every band
  // the palette has must be named here or it is unguarded.
  for (const band of [
    'raw = 100',
    'Math.max(20, 60 - i)',
    'raw = 15',
    "if (d.source === 'map') return raw / 2;",
    "if (d.source === 'row') return raw / 3;",
  ]) {
    assert.ok(src.includes(band), `the palette's scorer changed (${band}) — update the copy here`);
  }
});
