/**
 * A8·D-11: a rollup reads past the 1,000-row reply ceiling, a refused page is
 * "couldn't read", and a read stopped at its ceiling says it is incomplete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { readEveryPage } from './read-every-page';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A fake table of `n` rows that, like PostgREST, never answers more than 1,000 per request. */
function table(n: number, failAt?: number) {
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    if (failAt !== undefined && from >= failAt) return { data: null, error: new Error('refused') };
    const end = Math.min(to + 1, n, from + 1000);
    return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null };
  };
  return { page, calls };
}

test('reads every row past the 1,000-row ceiling', async () => {
  const t = table(2500);
  const r = await readEveryPage(t.page, 50_000);
  assert.equal(r?.rows.length, 2500);
  assert.equal(r?.complete, true);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('an exact multiple of the page still ends complete', async () => {
  const r = await readEveryPage(table(2000).page, 50_000);
  assert.equal(r?.rows.length, 2000);
  assert.equal(r?.complete, true);
});

test('a refused page is null — never a partial count', async () => {
  assert.equal(await readEveryPage(table(2500, 1000).page, 50_000), null);
});

test('stopping at the ceiling says the read is incomplete', async () => {
  const r = await readEveryPage(table(5000).page, 2000);
  assert.equal(r?.rows.length, 2000);
  assert.equal(r?.complete, false);
});

test('the Events and Demo tabs read their rollups through readEveryPage', () => {
  const ev = stripComments(readFileSync(join(WEB, 'app/admin/accounts/_surfaces/events-surface.tsx'), 'utf8'));
  assert.match(ev, /readEveryPage[\s\S]*?from\('guests'\)/, 'guests per event are paged');
  assert.match(ev, /readEveryPage[\s\S]*?from\('event_std_views'\)/, 'save-the-date views are paged');
  const demo = stripComments(readFileSync(join(WEB, 'app/admin/accounts/_surfaces/demo-vendors-surface.tsx'), 'utf8'));
  assert.equal((demo.match(/readEveryPage[<(]/g) ?? []).length, 3, 'batch, category and city scans are paged');
  assert.doesNotMatch(demo, /\.limit\((BATCH|CATEGORY|CITY)_SCAN_LIMIT\)/, 'no single-request scan the ceiling cuts first');
});
