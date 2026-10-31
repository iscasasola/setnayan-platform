/**
 * 💸 FIND'S PRICE IS A SORT ONLY (owner 2026-10-31, corpus DECISION_LOG "SEVEN OWNER ANSWERS" (1): *"sort only"*) —
 * and Find has ONE sort control, the thumb row's ⇅ (#7054, `find-sort-menu.tsx`).
 *
 *   S1  ONE sort control on Find: the bench builds the ⇅ once (`findSortMenu(` once), the thumb row draws it in its one
 *       sort seat, no category head draws a sort, and the row takes no second sort prop;
 *   S2  price is a SORT: the ⇅'s Sort offers "Lowest price", and the ⇅ carries no Price section, no `price:` key;
 *   S3  price never REMOVES a card: `FindFilters` has no price field, and with Rating at "any" every card passes —
 *       priced or unpriced, cheap or dear;
 *   S4  no range sheet: no `find-budget-range.tsx`, and no range input/state/scorer anywhere on Find;
 *   S5  "Nearest" picks the venue IN the same Sort list (owner 2026-10-30, "Reception + Ceremony"): its rows come from
 *       `nearOptions`, keyed `nearKey(…)`, inside the one `findSortMenu(` call.
 *
 * Executed where the code is pure (`findSortMenu`, `passesFindFilters`); source assertions, comments stripped, where it
 * is a client component this runner cannot mount.
 *
 * SABOTAGE, each seen red before this shipped:
 *   S1  build a second `findSortMenu(` for a category head           → "the ⇅ is built once"
 *   S2  push a `price:low` row back into the ⇅                       → "the ⇅ has no Price section"
 *   S3  put `price` back in `FIND_FILTERS_OFF` / drop a priced card   → "price never removes a card"
 *   S4  re-add a `FindBudgetRange` line                               → "no range sheet"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { stripComments as strip } from '@/lib/strip-comments';
import { findSortMenu } from './_components/find-sort-menu';
import { FIND_FILTERS_OFF, passesFindFilters, type FindCardRow } from '@/lib/find-service-cards';
import { BENCH_PLAIN_SORTS } from '@/lib/bench-sort';

// The ⇅'s face is JSX; this runner compiles it to `React.createElement` without importing React.
(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(import.meta.dirname, '_components');
const read = (f: string) => strip(readFileSync(join(HERE, f), 'utf8'));
const BENCH = read('shortlist-categories.tsx');
const ROW = read('find-thumb-row.tsx');
const MENU = read('find-sort-menu.tsx');
const LIST = BENCH.slice(BENCH.indexOf('function MoreToCompare('), BENCH.indexOf('export function ShortlistCategories('));
const count = (src: string, needle: string) => src.split(needle).length - 1;

test('S1 — Find has ONE sort control: the thumb row’s ⇅, built once', () => {
  assert.equal(count(BENCH, 'findSortMenu('), 1, 'the ⇅ is built once, for the whole page');
  assert.match(BENCH, /<FindThumbRow[\s\S]*?sortMenu=\{findSortMenu\(/, 'the thumb row carries it');
  assert.ok(LIST.length > 0, 'MoreToCompare is where it was');
  assert.doesNotMatch(LIST, /sortMenu|<PickMenu[^>]*data-bench-sort|findSortMenu/, 'a category head draws no sort of its own');
  assert.equal(count(ROW, 'right={'), 1, 'the row has one sort seat');
  assert.doesNotMatch(ROW, /\bsort\s*=\s*null|\bsort\?:\s*ThumbMenu/, 'the row takes no second sort prop');
});

const SORTS = [
  { key: 'fit', label: 'Best matches' },
  { key: 'near:reception', label: 'Nearest to reception' },
  { key: 'near:ceremony', label: 'Nearest to ceremony' },
  ...BENCH_PLAIN_SORTS.map((s) => ({ key: s.key as string, label: s.label })),
];
const menuFor = (scope: string | null) =>
  findSortMenu({
    sorts: SORTS,
    sort: 'near:reception',
    defaultSort: 'near:reception',
    onSort: () => {},
    scope,
    filters: FIND_FILTERS_OFF,
    onFilters: () => {},
  });

test('S2 — price is a SORT in the ⇅ ("Lowest price"), never a Price section', () => {
  for (const scope of [null, 'Catering']) {
    const m = menuFor(scope);
    const sortRows = m.menu.filter((o) => o.group === 'Sort');
    assert.ok(sortRows.some((o) => o.key === 'sort:price' && o.label === 'Lowest price'), 'price orders the cards');
    assert.equal(m.menu.filter((o) => o.group === 'Price').length, 0, 'the ⇅ has no Price section');
    assert.equal(m.menu.filter((o) => String(o.key).startsWith('price:')).length, 0, 'no price filter key');
  }
  assert.doesNotMatch(MENU, /group:\s*'Price'|`price:|priceOptions|bands/, 'the menu source cuts no price bands');
});

test('S3 — price never removes a card: no price filter exists, every card passes at Rating "any"', () => {
  assert.deepEqual(Object.keys(FIND_FILTERS_OFF), ['rating'], 'the ⇅ filters carry no price field');
  const shop = { rating: 4.8, reviewCount: 12 };
  const card = (fromPhp: number | null): FindCardRow => ({ serviceId: `s${fromPhp}`, profileId: 'p', service: 'catering', card: null, fromPhp });
  for (const p of [null, 1, 5_000, 80_000, 2_000_000]) {
    assert.equal(passesFindFilters(card(p), shop, FIND_FILTERS_OFF), true, `a ₱${p ?? '—'} card stays`);
  }
  assert.doesNotMatch(BENCH, /priceBands|filters\.price/, 'the bench filters nothing by price');
});

test('S4 — no range sheet: nothing on Find asks for a price range', () => {
  assert.equal(existsSync(join(HERE, 'find-budget-range.tsx')), false, 'the range line is gone');
  for (const [name, src] of [['shortlist-categories.tsx', BENCH], ['find-thumb-row.tsx', ROW], ['find-sort-menu.tsx', MENU]] as const) {
    assert.doesNotMatch(src, /FindBudgetRange|budgetRange|BudgetRange|rangeFitRatio|priceSpan|Your range/, `${name} asks no price range`);
  }
});

test('S5 — "Nearest" picks the venue inside the same Sort list', () => {
  const call = BENCH.slice(BENCH.indexOf('findSortMenu('), BENCH.indexOf('findSortMenu(') + 2400);
  assert.match(call, /nearOptions\.map\(\(o\) => \(\{ key: nearKey\(o\.from\)/, 'one Sort row per venue with a pin');
  assert.match(call, /nearFromKey\(k\)/, 'picking a venue row sorts Nearest from that venue');
  const m = menuFor(null);
  assert.deepEqual(
    m.menu.filter((o) => String(o.key).startsWith('sort:near')).map((o) => o.label),
    ['Nearest to reception', 'Nearest to ceremony'],
  );
});
