/**
 * 🧭 FIND'S SORT IS ONE ≡ ON THE THUMB ROW (owner 2026-10-30) — *"this is a filter and sort parameter? shouldn't this
 * be on the thumb row?"* · *"so it applies to all?"* · "Nearest" = "Reception + Ceremony" · "Budget fit" asks a range
 * whose boxes start at the category's cheapest and priciest card.
 *
 * Source guard over `shortlist-categories.tsx` (the bench), `find-thumb-row.tsx` (the row) and
 * `find-budget-range.tsx` (the range line); the arithmetic is executed in `lib/find-sort-choices.test.ts` and
 * `lib/bench-sort.test.ts`.
 *
 * SABOTAGE, each seen red before this shipped:
 *   1  draw `{sortMenu}` back into MoreToCompare's head            → "a category head draws the sort"
 *   2  drop `right={sort ? [sort] : []}` from FindThumbRow          → "the row draws no ≡"
 *   3  build the Nearest rows from a fixed list, not `nearOptions`  → "Nearest is not one row per venue"
 *   4  draw the range line for every sort                          → "the range shows outside Budget fit"
 *   5  write the range anywhere (a server action, a fetch)          → "the range is written"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(import.meta.dirname, '_components');
const read = (f: string) => readFileSync(join(HERE, f), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const BENCH = strip(read('shortlist-categories.tsx'));
const ROW = strip(read('find-thumb-row.tsx'));
const RANGE = strip(read('find-budget-range.tsx'));
const LIST = BENCH.slice(BENCH.indexOf('function MoreToCompare('), BENCH.indexOf('export function ShortlistCategories('));

test('the sort is the thumb row’s ≡ — never inside a category', () => {
  assert.ok(LIST.length > 2000, 'MoreToCompare was not found — the guard would read nothing');
  assert.doesNotMatch(LIST, /\{sortMenu\}/, 'a category head draws the sort');
  assert.match(BENCH, /sort=\{thumbSort\}/, 'the bench hands the row no sort');
  assert.match(ROW, /right=\{sort \? \[sort\] : \[\]\}/, 'the row draws no ≡');
  assert.match(BENCH, /const thumbSort: ThumbMenu \| null = replan/);
});

test('Nearest is one row per venue with a pin, picked in the same list', () => {
  assert.match(
    BENCH,
    /c\.key === 'near' && nearOptions\?\.length\s*\?\s*nearOptions\.map\(\(o\) => \(\{ key: nearKey\(o\.from\), label: o\.label/,
    'Nearest is not one row per venue',
  );
  assert.match(BENCH, /const from = nearFromKey\(key\);/);
  assert.match(BENCH, /distanceKm: f\.ceremonyKm/, 'the ceremony is never measured from');
});

test('the range line shows only under Budget fit, from the category’s own cards, and is never written', () => {
  assert.match(BENCH, /budgetRange=\{\s*effectiveSort === 'budget'/, 'the range shows outside Budget fit');
  assert.match(LIST, /priceSpan\(\[\.\.\.budgetRange\.benchPrices, \.\.\.moreRows\.map\(\(r\) => r\.startsAtPhp\)\]\)/);
  assert.match(BENCH, /useState<Record<string, BudgetRange>>\(\{\}\)/);
  for (const [name, src] of [['the range line', RANGE], ['the bench', BENCH]] as const) {
    assert.doesNotMatch(src, /setBudgetRanges[\s\S]{0,200}(fetch\(|\.rpc\(|\.from\(|Action\()/, `the range is written by ${name}`);
  }
  assert.doesNotMatch(RANGE, /'use server'|fetch\(|localStorage/, 'the range is written');
});
