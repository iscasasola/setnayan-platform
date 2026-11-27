/**
 * 🪟 THE SHOP'S ONE COUNTING WINDOW (L6 · S3, walk 27 Nov 2026: Today "207 · last 28 days" beside Your page "214 ·
 * 30 d" — one reader, two windows).
 *   1 · the window is Analytics' first window, and its words are built from it.
 *   2 · Today's Views and Inquiries and Your page's "opened" all count it — no hand-typed 28 or 30 days left there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { GROWTH_WINDOWS } from './analytics-growing';
import { SHOP_COUNT_WINDOW_DAYS, SHOP_COUNT_WINDOW_SHORT, SHOP_COUNT_WINDOW_WORDS, shopCountSinceIso, shopCountSinceMs } from './shop-count-window';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the window is Analytics’ first window ("Last 30 days"), and the words say that number', () => {
  assert.equal(String(SHOP_COUNT_WINDOW_DAYS), GROWTH_WINDOWS[0]!.key, 'the shop counts a window Analytics does not show');
  assert.equal(SHOP_COUNT_WINDOW_WORDS, `last ${SHOP_COUNT_WINDOW_DAYS} days`);
  assert.equal(SHOP_COUNT_WINDOW_SHORT, `${SHOP_COUNT_WINDOW_DAYS} d`);
  const now = Date.parse('2026-11-27T00:00:00Z');
  assert.equal(shopCountSinceMs(now), now - SHOP_COUNT_WINDOW_DAYS * 86_400_000);
  assert.equal(shopCountSinceIso(now), new Date(shopCountSinceMs(now)).toISOString());
});

test('2 · Today and Your page count the one window', () => {
  const today = read('app/vendor-dashboard/page.tsx');
  assert.match(today, /readTodayViews\(supabase, vendorProfileId, shopCountSinceIso\(Date\.now\(\)\)\)/, 'Today’s views left the window');
  assert.doesNotMatch(today, /\b28 \* 86_400_000/, 'Today counts its own 28 days again');
  assert.match(read('lib/vendor-overview.ts'), /const since28 = shopCountSinceMs\(Date\.now\(\)\)/, 'Today’s inquiries left the window');
  const page = read('app/vendor-dashboard/website/page-data.ts');
  assert.match(page, /readCouplesWhoOpened\(supabase, vendorId, shopCountSinceIso\(Date\.now\(\)\)\)/, 'Your page’s "opened" left the window');
  assert.doesNotMatch(page, /\b30 \* 86_400_000/, 'Your page counts its own 30 days again');
  const stats = read('app/vendor-dashboard/_components/today-stats.tsx');
  assert.doesNotMatch(stats, /last \d+ days/, 'Today types the window by hand again');
  assert.match(read('lib/shop-section-figures.ts'), /`opened · \$\{SHOP_COUNT_WINDOW_SHORT\}`/);
  assert.match(read('lib/supplier-today-v2.ts'), /asked in \$\{SHOP_COUNT_WINDOW_DAYS\} days/);
});
