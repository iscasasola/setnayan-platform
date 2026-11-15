/**
 * 🔒 YOUR BEST WORK (ruling 5940) — `lib/portfolio-best-work.ts`, and that the Portfolio draws it FIRST from the
 * counter that already exists (no second counter, no new table).
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-12): `if (views === null) return null;` → `return []` (red: 2);
 *   the sort's `b.views - a.views` → `a.views - b.views` (red: 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bestWorkLine, bestWorkOf } from './portfolio-best-work';

const urls = { a: 'u/a', b: 'u/b', c: 'u/c', d: 'u/d' };

test('1 · most viewed first; ties to the later photo; no views and unsigned photos left out', () => {
  const views = new Map([
    ['a', 5],
    ['b', 12],
    ['c', 5],
    ['gone', 99],
  ]);
  assert.deepEqual(
    bestWorkOf(['a', 'b', 'c', 'd'], urls, views)!.map((p) => p.key),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(bestWorkOf(['a', 'b'], { a: 'u/a' }, new Map([['b', 3]])), [], 'a photo that would not sign was drawn');
});

test('2 · an unread count is null (said as "couldn’t load"), never an empty rail', () => {
  assert.equal(bestWorkOf(['a'], urls, null), null);
  assert.deepEqual(bestWorkOf(['a'], urls, new Map()), []);
});

test('3 · the line under a tile', () => {
  assert.equal(bestWorkLine(212, true), 'Most viewed · 212 views');
  assert.equal(bestWorkLine(1, false), '1 view');
});

test('4 · the Portfolio reads the EXISTING counter and draws Your best work as its first section', () => {
  const data = readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/collections-data.ts'), 'utf8');
  assert.match(data, /readPortfolioPhotoViews\(supabase, vendorId\)/, 'best work does not read the shipped view counter');
  assert.doesNotMatch(data, /from\('vendor_portfolio_photo_views'\)/, 'a second reader of the view counter appeared');
  const list = readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/_components/collections-list.tsx'), 'utf8');
  assert.match(list, /id="best"\s+title="Your best work"/, 'Your best work is not a section');
  const order = readFileSync(join(process.cwd(), 'lib/portfolio-section-order.ts'), 'utf8');
  assert.match(order, /PORTFOLIO_SECTIONS = \[\s*'best',/, 'Your best work is not first');
});
