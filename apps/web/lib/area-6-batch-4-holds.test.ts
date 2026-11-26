/**
 * Final check 25 Nov, area 6, batch 4 — each test fails if its fix is reverted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

test('A6-03 · a refused headcount is null, never 0 — and finalizing refuses rather than freeze a guess', () => {
  const pax = read('lib/pax.ts');
  assert.match(pax, /async function liveHeadcount\([\s\S]*?\): Promise<number \| null>/);
  assert.match(pax, /const \{ count, error \} = await q;\s*if \(error\) \{[\s\S]*?return null;/);
  assert.match(pax, /if \(count === null\) return \{ ok: false, error: 'Couldn’t count your guests just now — nothing was changed\.' \}/);
  const fin = pax.slice(pax.indexOf('if (count === null)'));
  assert.ok(fin.indexOf('if (count === null)') < fin.indexOf("guest_count_locked_at: new Date()"), 'the refusal comes before the freeze');
});

test('A6-24 · an unread Papic ledger sells nothing and the album does not refuse an import on a guessed 0', () => {
  assert.match(read('lib/vendor-papic-grants.ts'), /offerPack: credits === null \? false : offerPack\(credits\)/);
  assert.match(read('app/vendor-dashboard/on-the-day/live/[eventId]/papic/page.tsx'), /creditsLeft=\{portfolioCredits\.credits === null \? null : portfolioCredits\.left\}/);
  assert.match(read('lib/shop-wallet.server.ts'), /if \(pc\.credits != null && pc\.left != null\) parts\.push/);
});

test('A6-B06 · the Money bar says what it measures: received, not booked', () => {
  const view = read('app/vendor-dashboard/customers/_components/money-view.tsx');
  assert.match(view, /% of \{formatPhp\(totals\.bookedPhp\)\} received/);
  assert.doesNotMatch(view, /% of \{formatPhp\(totals\.bookedPhp\)\} booked/);
});
