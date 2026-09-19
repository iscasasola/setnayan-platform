/**
 * paginate.test.ts — the ONE paging rule, EXECUTED.
 *
 * Owner 2026-09-19: "if they have 1000 inquiries, they can still manage all and
 * still be able to see the lower parts of the page?" Every supplier list pages
 * through `paginate()` / `pageWindowFor()`, so these are the boundaries all of
 * them share: 1-based pages, junk → page 1, past-the-end → last page, `total`
 * is the whole list, and the slice keeps the caller's order.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIST_PAGE_SIZE,
  filterBySearch,
  pageHref,
  pageWindowFor,
  pagerWindow,
  paginate,
  parsePageParam,
  parseSearchParam,
} from './paginate';

const thousand = Array.from({ length: 1000 }, (_, i) => i + 1);

test('the page size is 20 — one constant for every list', () => {
  assert.equal(LIST_PAGE_SIZE, 20);
});

test('page 1 of 1,000 is rows 1–20, and total is the whole list', () => {
  const p = paginate(thousand, undefined);
  assert.deepEqual(p.items, thousand.slice(0, 20));
  assert.equal(p.page, 1);
  assert.equal(p.pageCount, 50);
  assert.equal(p.total, 1000);
  assert.equal(p.from, 1);
  assert.equal(p.to, 20);
});

test('a middle page and the last page slice exactly', () => {
  const p3 = paginate(thousand, '3');
  assert.deepEqual(p3.items, thousand.slice(40, 60));
  assert.equal(p3.from, 41);
  assert.equal(p3.to, 60);
  const last = paginate(thousand, '50');
  assert.deepEqual(last.items, thousand.slice(980, 1000));
  assert.equal(last.to, 1000);
});

test('a short last page reports its real range', () => {
  const p = paginate(Array.from({ length: 45 }, (_, i) => i), '3');
  assert.equal(p.items.length, 5);
  assert.equal(p.from, 41);
  assert.equal(p.to, 45);
  assert.equal(p.pageCount, 3);
});

test('a page past the end CLAMPS to the last page — never an empty page', () => {
  const p = paginate(thousand, '9999');
  assert.equal(p.page, 50);
  assert.equal(p.items.length, 20);
  assert.equal(p.items[0], 981);
  const small = paginate([1, 2, 3], '2');
  assert.equal(small.page, 1);
  assert.deepEqual(small.items, [1, 2, 3]);
});

test('junk page values read as page 1', () => {
  for (const raw of [undefined, null, '', 'abc', '0', '-2', '1.5', ' ', '2e3', ['x']]) {
    assert.equal(parsePageParam(raw as never), 1, `"${String(raw)}" should be page 1`);
    assert.equal(paginate(thousand, raw as never).page, 1);
  }
  assert.equal(parsePageParam(['4', '9']), 4, 'a repeated param reads the first');
  assert.equal(paginate(thousand, 0).page, 1);
  assert.equal(paginate(thousand, 7).page, 7);
});

test('an empty list is page 1 of 1, rows 0–0', () => {
  const p = paginate([], '5');
  assert.deepEqual(p.items, []);
  assert.equal(p.page, 1);
  assert.equal(p.pageCount, 1);
  assert.equal(p.total, 0);
  assert.equal(p.from, 0);
  assert.equal(p.to, 0);
});

test('the slice keeps the caller ORDER (it pages, it never sorts)', () => {
  const ordered = ['waiting-b', 'waiting-a', ...Array.from({ length: 30 }, (_, i) => `z${i}`)];
  assert.deepEqual(paginate(ordered, '1').items.slice(0, 2), ['waiting-b', 'waiting-a']);
});

test('pageWindowFor (the SQL-paged lists) clamps exactly like paginate', () => {
  for (const total of [0, 1, 19, 20, 21, 45, 1000]) {
    for (const raw of [undefined, '1', '2', '3', '999', 'abc']) {
      const w = pageWindowFor(total, raw);
      const p = paginate(Array.from({ length: total }, (_, i) => i), raw);
      assert.equal(w.page, p.page, `page for total=${total} raw=${raw}`);
      assert.equal(w.pageCount, p.pageCount);
      assert.equal(w.from, p.from);
      assert.equal(w.to, p.to);
      assert.equal(w.end - w.start + 1, LIST_PAGE_SIZE, '.range() asks for one page');
    }
  }
  assert.deepEqual(
    [pageWindowFor(1000, '3').start, pageWindowFor(1000, '3').end],
    [40, 59],
  );
});

test('pagerWindow keeps first, last, and the neighbours; gaps are null', () => {
  assert.deepEqual(pagerWindow(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagerWindow(1, 50), [1, 2, 3, 4, null, 50]);
  assert.deepEqual(pagerWindow(25, 50), [1, null, 24, 25, 26, null, 50]);
  assert.deepEqual(pagerWindow(50, 50), [1, null, 47, 48, 49, 50]);
  for (let page = 1; page <= 50; page++) {
    const w = pagerWindow(page, 50);
    assert.ok(w.length <= 7, `page ${page} drew ${w.length} slots`);
    assert.ok(w.includes(page) && w.includes(1) && w.includes(50));
  }
});

test('pageHref keeps every other param and drops page=1', () => {
  assert.equal(pageHref('lane=waiting&q=rosa&open=messages', 'page', 3, 'customers'),
    '?lane=waiting&q=rosa&open=messages&page=3#customers');
  assert.equal(pageHref('lane=waiting&page=4', 'page', 1, 'customers'), '?lane=waiting#customers');
  assert.equal(pageHref('', 'mpage', 2), '?mpage=2');
  // Another list's page survives this list's paging.
  assert.equal(pageHref('page=4', 'mpage', 2), '?page=4&mpage=2');
});

test('search runs before paging, matches every word, ignores case and accents', () => {
  const rows = [
    ...Array.from({ length: 60 }, (_, i) => ({ title: `Couple ${i}` })),
    { title: 'Rosa & Ben Peña' },
  ];
  const needle = parseSearchParam('  PENA   rosa ');
  assert.equal(needle, 'pena rosa');
  const hit = paginate(filterBySearch(rows, needle, (r) => r.title), '1');
  assert.equal(hit.total, 1, 'the one match on page 4 of the full list is the whole search');
  assert.equal(hit.items[0]!.title, 'Rosa & Ben Peña');
  assert.equal(parseSearchParam('   '), null);
  assert.equal(filterBySearch(rows, null, (r) => r.title).length, 61);
});
