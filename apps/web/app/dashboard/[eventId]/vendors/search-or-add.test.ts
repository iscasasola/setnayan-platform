/**
 * search-or-add.test.ts — SEARCH OR ADD on Suppliers (owner 2026-10-24, verbatim: *"we will show the result on the
 * page itself. not a new screen. So it searches what we already have on the shortlist, what service card has that,
 * or add my own new supplier's service card manually that i can give the supplier itself."*; *"the add manually is
 * the one with QR"*).
 *
 * The bench has no render harness (its search text is typed into the thumb row, which a static render cannot type
 * into), so this guard holds three properties at the grain each can be held:
 *
 *   1. NOTHING ON THE BENCH LEAVES FOR A SEARCH — the bench and the thumb row, comments stripped, hold no link to
 *      `/explore` or `/v/` at all (the whole-marketplace rows and the "See all results" door are gone), and the bench
 *      no longer calls the whole-marketplace name search;
 *   2. WHILE SEARCHING, THE LAST ROW IS THE ADD — the bench draws `SearchAddRow` under `searching`, AFTER the
 *      category rows, wired to the thumb row's own ＋ door (`addYourOwn`), which opens the shipped `AddYourOwnWalk`
 *      (its step 4 is the link + QR); and the row itself renders its words (rendered here);
 *   3. the empty line points at that row, never at the marketplace.
 *
 * The Guests half is `guests/_components/search-or-add.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const BENCH = stripComments(readFileSync(join(HERE, '_components/shortlist-categories.tsx'), 'utf8'));
const THUMB = stripComments(readFileSync(join(HERE, '_components/find-thumb-row.tsx'), 'utf8'));

test('nothing the Suppliers search draws leaves the page — no /explore, no /v/', () => {
  for (const [name, src] of [['shortlist-categories.tsx', BENCH], ['find-thumb-row.tsx', THUMB]] as const) {
    assert.doesNotMatch(src, /['"`]\/explore\b/, `${name} links to /explore`);
    assert.doesNotMatch(src, /['"`]\/v\//, `${name} links to a /v/ shop page`);
  }
  assert.doesNotMatch(BENCH, /searchMarketplaceForBench/, 'the bench no longer runs the whole-marketplace name search');
  assert.doesNotMatch(BENCH, /See all results|From the whole marketplace/);
});

test('while searching, the last row is the Add — the thumb row’s own door into AddYourOwnWalk', () => {
  const add = BENCH.search(/\{searching \? \(\s*<SearchAddRow\b[^>]*\bas="your own supplier"[^>]*\bonAdd=\{addYourOwn\}/);
  assert.ok(add > 0, 'the bench draws <SearchAddRow as="your own supplier" onAdd={addYourOwn}> under `searching`');
  const rows = BENCH.indexOf('{visibleFolders.map((folder) =>');
  assert.ok(rows > 0 && rows < add, 'the Add row comes AFTER the category rows the hits open under');
  // `addYourOwn` is the ＋ door: one category open → straight into the walk; none → "which category" first.
  assert.match(BENCH, /function addYourOwn\(typed = ''\) \{[\s\S]*?setManual\(\{[\s\S]*?else setAddAsk\(true\);/);
  assert.match(BENCH, /\{manual && replan \? \(\s*<AddYourOwnWalk\b/, 'the door opens the shipped walk');
});

test('the empty line points at the Add row, not the marketplace', () => {
  assert.match(BENCH, /Nothing in your shortlist matches “\{query\.trim\(\)\}”\. Add them as your own below\./);
  assert.doesNotMatch(BENCH, /try the whole marketplace/);
});

test('the row draws its words and adds the typed name', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SearchAddRow } = await import('@/components/search-add-row');
  const html = renderToStaticMarkup(
    React.createElement(SearchAddRow, { query: '  Seda  ', as: 'your own supplier', onAdd: () => {} }),
  );
  assert.match(html, /data-search-add=""/);
  assert.match(html, /aria-label="Add “Seda” as your own supplier"/);
  assert.doesNotMatch(html, /href=/, 'the row is a button, never a link');
  assert.equal(renderToStaticMarkup(React.createElement(SearchAddRow, { query: '  ', as: 'a guest', onAdd: () => {} })), '');
});
