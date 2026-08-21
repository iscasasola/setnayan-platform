/**
 * THE SEARCH BOX IS A POSTGREST FILTER EXPRESSION.
 *
 * `supabase.or()` takes a filter as a STRING. It is not a parameterised query
 * and there is no escaping layer underneath it: a comma typed into the search
 * box does not become part of the search term, it becomes a filter separator.
 * A closing bracket ends a group. `*` is a wildcard.
 *
 * 🔑 SO THIS IS AN ALLOW-LIST, NOT AN ESCAPE. A denylist here is a bill you
 * have to keep paying, and the currency is somebody else's rows. These tests
 * exist to make the allow-list impossible to loosen by accident.
 *
 * ⚠ AND IT DROPS RATHER THAN REJECTS. A couple searching for "cake?" wants cake,
 * not an error message about punctuation. Every hostile input below must come
 * back HARMLESS, never empty-with-an-error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeQuery, readFilters, isDefaultView, orderForShelf } from './papic-challenge-picker';

test('a plain search survives intact', () => {
  assert.equal(sanitizeQuery('cake'), 'cake');
  assert.equal(sanitizeQuery('a story'), 'a story');
  // Filipino names and words are the point of the product, not an edge case.
  assert.equal(sanitizeQuery('lola'), 'lola');
  assert.equal(sanitizeQuery('niño'), 'niño');
  assert.equal(sanitizeQuery('José'), 'José');
});

test('an apostrophe and a hyphen survive — they are in real prompts', () => {
  assert.equal(sanitizeQuery("lola's"), "lola's");
  assert.equal(sanitizeQuery('halo-halo'), 'halo-halo');
  assert.equal(sanitizeQuery('couple’s'), 'couple’s');
});

test('every PostgREST filter metacharacter is dropped, not escaped', () => {
  // Each of these would otherwise change the SHAPE of the filter, not the term.
  for (const hostile of [
    'cake,library_id.gt.0',
    'cake)',
    '(cake',
    'cake.eq.1',
    'cake*',
    'cake"',
    'cake\\',
    'cake;drop',
  ]) {
    const out = sanitizeQuery(hostile);
    for (const ch of [',', '(', ')', '.', '*', '"', '\\', ';']) {
      assert.ok(!out.includes(ch), `"${ch}" survived sanitising of ${hostile} -> ${out}`);
    }
    assert.ok(out.startsWith('cake'), `${hostile} lost the real search term: ${out}`);
  }
});

test('a hostile input still searches for something, rather than erroring', () => {
  // 🔑 THE FAILURE MODE MATTERS. Returning '' for anything with punctuation
  // would silently turn a search into "show me everything", which reads as the
  // search box being broken.
  assert.equal(sanitizeQuery('cake, please'), 'cake please');
  assert.equal(sanitizeQuery('...'), '');
});

test('whitespace is collapsed and the length is capped', () => {
  assert.equal(sanitizeQuery('   a    story   '), 'a story');
  assert.equal(sanitizeQuery('x'.repeat(500)).length, 60);
});

test('a non-string is not a search', () => {
  // A URL param can arrive as an array (`?cq=a&cq=b`) or absent entirely.
  for (const v of [undefined, null, 42, ['a', 'b'], {}]) {
    assert.equal(sanitizeQuery(v), '');
  }
});

// ── The filters ────────────────────────────────────────────────────────────

test('an unknown category or kind is ignored, never passed through', () => {
  const f = readFilters({ ccat: 'not_a_category', ckind: 'gif' });
  assert.equal(f.category, null);
  assert.equal(f.kind, null);
});

test('a known category and kind are kept', () => {
  const f = readFilters({ ccat: 'stories', ckind: 'clip' });
  assert.equal(f.category, 'stories');
  assert.equal(f.kind, 'clip');
});

test('the default view is exactly "nothing chosen"', () => {
  // The "Most picked" shelf shows ONLY here. A search or a chip means the couple
  // asked a question, and answering it with popular-but-unrelated rows would be
  // the screen overriding them.
  assert.equal(isDefaultView(readFilters({})), true);
  assert.equal(isDefaultView(readFilters({ cq: 'cake' })), false);
  assert.equal(isDefaultView(readFilters({ ccat: 'selfie' })), false);
  assert.equal(isDefaultView(readFilters({ ckind: 'photo' })), false);
  // Junk that sanitises away is NOT a question.
  assert.equal(isDefaultView(readFilters({ cq: '...', ccat: 'nope' })), true);
});

// ── The shelf must not claim popularity it does not have ───────────────────

const row = (library_id: number, picks: number, priority_rank: number | null = null) => ({
  library_id,
  picks,
  priority_rank,
  category: 'selfie' as const,
  title: `T${library_id}`,
  prompt: `P${library_id}`,
  capture_kind: 'photo' as const,
});

test('with zero picks the shelf keeps the curated order and says it is not popularity', () => {
  // 🔑 THE CASE THAT IS TRUE IN PRODUCTION TODAY. Nobody has picked anything, so
  // "the 20 other hosts add most often" would be a claim about other people that
  // is simply false. A mutation run caught this being unguarded.
  const rows = [row(3, 0, 3), row(1, 0, 1), row(2, 0, 2)];
  const out = orderForShelf(rows, readFilters({}));
  assert.equal(out.rankedByPicks, false);
  assert.deepEqual(out.rows.map((r) => r.library_id), [3, 1, 2], 'the order must not be touched');
});

test('with real picks the shelf sorts by them and says so', () => {
  const out = orderForShelf([row(1, 2, 1), row(2, 9, 2), row(3, 0, 3)], readFilters({}));
  assert.equal(out.rankedByPicks, true);
  assert.deepEqual(out.rows.map((r) => r.library_id), [2, 1, 3]);
});

test('a tie is broken by our own order, never left to chance', () => {
  const out = orderForShelf([row(50, 4, null), row(9, 4, 2), row(7, 4, 1)], readFilters({}));
  assert.deepEqual(out.rows.map((r) => r.library_id), [7, 9, 50]);
});

test('a search or a chip turns popularity OFF, even when picks exist', () => {
  for (const search of [{ cq: 'cake' }, { ccat: 'stories' }, { ckind: 'photo' }]) {
    const out = orderForShelf([row(1, 0), row(2, 99)], readFilters(search));
    assert.equal(out.rankedByPicks, false, `${JSON.stringify(search)} must answer the question asked`);
    assert.deepEqual(out.rows.map((r) => r.library_id), [1, 2]);
  }
});
