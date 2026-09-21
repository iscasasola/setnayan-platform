/**
 * payment-priors-scan.test.ts — CTRL-B1 build 3.
 *
 * THE PROPERTY: the classifier's verdict does not change when the table is
 * large. Everything below executes the paginator; nothing greps for it.
 *
 * 🛡 Mutation-checked — sabotages listed per test, all confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanAllPriors,
  PRIORS_PAGE_SIZE,
  PRIORS_MAX_PAGES,
  type PageResult,
} from '@/lib/payment-priors-scan';

/** A fake table of `n` rows, served in pages, counting the calls it received. */
function table(n: number, opts: { failOnPage?: number } = {}) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number): Promise<PageResult<{ id: number }>> => {
    calls.push([from, to]);
    if (opts.failOnPage !== undefined && calls.length === opts.failOnPage) {
      return { ok: false, error: 'read refused' };
    }
    return { ok: true, rows: rows.slice(from, to + 1) };
  };
  return { fetchPage, calls };
}

// SABOTAGE: stop paging after the first page → RED on the 1,201-row case.
test('every row is read, whatever the table size', async () => {
  for (const n of [0, 1, 9, 10, 11, 19, 20, 21, 1201]) {
    const t = table(n);
    const out = await scanAllPriors(t.fetchPage, { pageSize: 10 });
    assert.ok(out.ok, `scan of ${n} rows must succeed`);
    assert.equal(out.rows.length, n, `${n} rows in, ${out.rows.length} out — a short read is the whole defect`);
    assert.deepEqual(
      out.rows.map((r) => r.id),
      Array.from({ length: n }, (_, i) => i),
      'rows must come back complete and in order',
    );
  }
});

// SABOTAGE: change `page.rows.length < pageSize` to `<=` → RED (stops at page 1).
// SABOTAGE: change it to `=== 0` → RED (one wasted page on every exact multiple).
test('a full last page asks again; a short one stops', async () => {
  const exact = table(20);
  await scanAllPriors(exact.fetchPage, { pageSize: 10 });
  assert.equal(
    exact.calls.length,
    3,
    'an exact multiple must ask once more and get an empty page — stopping on a full page is the off-by-one that loses the tail',
  );
  const short = table(15);
  await scanAllPriors(short.fetchPage, { pageSize: 10 });
  assert.equal(short.calls.length, 2, 'a short page is the last page');
});

// SABOTAGE: return the rows gathered so far instead of ok:false → RED.
test('a failed page is a FAILURE, never a short answer', async () => {
  const t = table(100, { failOnPage: 2 });
  const out = await scanAllPriors(t.fetchPage, { pageSize: 10 });
  assert.equal(out.ok, false, 'a refused read must not be reported as the end of the data');
  if (!out.ok) {
    assert.match(out.error, /read refused/, 'the reason must survive — a money guard that cannot read must say why');
    assert.equal(out.pagesRead, 2);
  }
});

// SABOTAGE: return the partial rows on hitting the ceiling → RED.
test('hitting the page ceiling fails closed — it never returns a partial read', async () => {
  const t = table(10_000);
  const out = await scanAllPriors(t.fetchPage, { pageSize: 10, maxPages: 5 });
  assert.equal(
    out.ok,
    false,
    'a partial read wearing the shape of a complete one is exactly the defect this file removes',
  );
  if (!out.ok) assert.match(out.error, /partial read/i);
});

// SABOTAGE: make the ranges overlap (from = pages * (pageSize - 1)) → RED.
test('the ranges tile the table exactly — no gap, no overlap', async () => {
  const t = table(95);
  await scanAllPriors(t.fetchPage, { pageSize: 10 });
  for (let i = 0; i < t.calls.length; i += 1) {
    assert.deepEqual(
      t.calls[i],
      [i * 10, i * 10 + 9],
      `page ${i} asked for the wrong range — an overlap double-counts a prior, a gap loses one`,
    );
  }
});

test('the shipped page size is below any plausible platform cap, and the ceiling is real', () => {
  assert.ok(
    PRIORS_PAGE_SIZE <= 1000,
    'a page at or above the PostgREST cap would come back truncated, and a truncated full page reads as "there is more" forever',
  );
  assert.ok(PRIORS_MAX_PAGES >= 10, 'the ceiling must allow a realistic table');
  assert.ok(
    PRIORS_PAGE_SIZE * PRIORS_MAX_PAGES >= 100_000,
    'the ceiling must be far beyond any real payments table — it is a hang-stop, not a limit',
  );
});
