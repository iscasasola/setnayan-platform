/**
 * people-search.test.ts — the wildcard escape, and the shape a result may take.
 *
 * The search itself needs a database; what is unit-testable here is the part
 * that has already cost this codebase real money once — the ILIKE escape — and
 * the contract the rest of the feature is built on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  escapeLikeQuery,
  MAX_QUERY_TERMS,
  MAX_RESULTS,
  MIN_QUERY_LENGTH,
  nameSearchTerms,
} from './people-search-query';

test('🚨 a typed % searches for a per-cent sign, not for everybody', () => {
  // Unescaped, `%` in an ILIKE pattern means "any run of characters", so a
  // single character would return the whole users table one page at a time.
  assert.equal(escapeLikeQuery('%'), '\\%');
  assert.equal(escapeLikeQuery('%%%'), '\\%\\%\\%');
  assert.equal(escapeLikeQuery('ma%ria'), 'ma\\%ria');
});

test('🚨 a typed _ matches an underscore, not "any character"', () => {
  // This is the exact defect that let an admin correction move a DIFFERENT
  // shop's address (2026-08-12): `banawe_` quietly matched `banawes`.
  assert.equal(escapeLikeQuery('_'), '\\_');
  assert.equal(escapeLikeQuery('ana_cruz'), 'ana\\_cruz');
});

test('a backslash is escaped too — otherwise it escapes the next character', () => {
  assert.equal(escapeLikeQuery('a\\b'), 'a\\\\b');
  // The nastiest case: a trailing backslash would otherwise escape the closing
  // `%` the caller appends, changing what the pattern means.
  assert.equal(escapeLikeQuery('ana\\'), 'ana\\\\');
});

test('ordinary names pass through untouched', () => {
  for (const name of ['Maria', 'José', 'Ana Cruz', "O'Brien", 'Ng', '陳', 'Nguyễn']) {
    assert.equal(escapeLikeQuery(name), name, `${name} was altered`);
  }
});

test('the thresholds are the enumeration guard, and they are not zero', () => {
  // One character is a crawl of the whole table, not a search for a person.
  assert.ok(MIN_QUERY_LENGTH >= 2, 'a single character can be searched — that is enumeration');
  // A result list, not a dataset.
  assert.ok(MAX_RESULTS <= 25, 'the result cap is high enough to page a directory');
});

// ── ANY ORDER (owner, 2026-09-21: "Casasola Ice … this should work also") ──

/** What the users read does with the terms: every word, anywhere, any case. */
function matches(displayName: string, query: string): boolean {
  const terms = nameSearchTerms(query);
  const name = displayName.toLowerCase();
  return terms.length > 0 && terms.every((t) => name.includes(t.toLowerCase()));
}

test('surname-first finds the same person as first-name-first', () => {
  for (const q of ['Ice Casasola', 'Casasola Ice', 'casasola ice', 'Casasola, Ice', '  Ice   Casasola ']) {
    assert.ok(matches('Ice Casasola', q), `"${q}" did not find Ice Casasola`);
  }
  // Parts of words still work, in either order.
  assert.ok(matches('Ice Casasola', 'sasola ic'));
  // A single word still works on its own.
  assert.ok(matches('Ice Casasola', 'Ice'));
  assert.ok(matches('Ice Casasola', 'Casasola'));
});

test('every word must be in the name — another word narrows, never widens', () => {
  assert.equal(matches('Ice Casasola', 'Casasola Maria'), false);
  assert.equal(matches('Maria Casasola', 'Casasola Ice'), false);
  assert.ok(matches('Maria Casasola', 'Casasola'));
});

test('words are split on spaces and commas, and repeats collapse', () => {
  assert.deepEqual(nameSearchTerms('Casasola, Ice'), ['Casasola', 'Ice']);
  assert.deepEqual(nameSearchTerms(' Ice\tCasasola  '), ['Ice', 'Casasola']);
  assert.deepEqual(nameSearchTerms('Ice ice ICE'), ['Ice']);
  assert.ok(nameSearchTerms('a b c d e f g h').length <= MAX_QUERY_TERMS);
});

test('the enumeration guard survives the split: single letters alone search nothing', () => {
  assert.deepEqual(nameSearchTerms(''), []);
  assert.deepEqual(nameSearchTerms('a'), []);
  // Two single letters are a crawl of the table, not a name.
  assert.deepEqual(nameSearchTerms('a b'), []);
  assert.deepEqual(nameSearchTerms(', ,'), []);
  // …but an initial beside a real word only narrows the search, so it is kept.
  assert.deepEqual(nameSearchTerms('Casasola I'), ['Casasola', 'I']);
});

test('the users read filters on each term, escaped — not on the raw string', () => {
  const src = readFileSync(join(__dirname, 'people-search.ts'), 'utf8');
  assert.match(src, /nameSearchTerms\(rawQuery\)/, 'the search no longer splits the query into words');
  assert.match(
    src,
    /for \(const term of terms\)\s*\{\s*query = query\.ilike\('name_search', `%\$\{escapeLikeQuery\(term\)\}%`\);/,
    'each word must get its own escaped ILIKE on name_search (nickname + full name + @tag)',
  );
  assert.equal(
    (src.match(/\.ilike\(/g) ?? []).length,
    1,
    'a second ILIKE on the users read would bring back whole-string matching',
  );
});

test('"@ice" searches the tag "ice" — the @ is how a tag is shown, not stored', () => {
  assert.deepEqual(nameSearchTerms('@ice'), ['ice']);
  assert.deepEqual(nameSearchTerms('@@ice casasola'), ['ice', 'casasola']);
  assert.deepEqual(nameSearchTerms('@'), []);
  assert.deepEqual(nameSearchTerms('@i'), []);
});

test('the haystack the search reads holds nickname, all five parts and the slug', () => {
  const sql = readFileSync(
    join(__dirname, '../../../supabase/migrations/20271237898004_users_formal_name.sql'),
    'utf8',
  );
  const gen = sql.slice(sql.indexOf('name_search TEXT GENERATED'));
  for (const col of ['display_name', 'name_prefix', 'first_name', 'middle_name', 'last_name', 'name_suffix', 'slug']) {
    assert.ok(gen.includes(`coalesce(${col},`), `name_search does not include ${col}`);
  }
});
