import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PUBLISH_REQUIREMENTS } from '@/lib/service-publish-gate';

/**
 * S43 · 6 — the card maker's first-card intro sample shows only what a supplier
 * can actually write, in words that fit every trade.
 *
 * It showed a photographer's card promising a free "engagement mini-shoot" as a
 * Setnayan Exclusive (a free-text perk retired 2026-09-09, which no supplier can
 * author), told a new shop "the price can wait" (a starting price has been a
 * publish requirement since), and said "two answers" go live (it is three).
 */

const SRC = stripComments(
  readFileSync(join(process.cwd(), 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'),
);

function introSheet(): string {
  const open = SRC.indexOf('id="canvas-intro"');
  assert.ok(open > 0, 'the intro sheet is gone — update this guard');
  const close = SRC.indexOf('</CanvasSheet>', open);
  assert.ok(close > open);
  return SRC.slice(open, close);
}

test('the intro sample promises no retired Exclusive and speaks to no single trade', () => {
  const intro = introSheet();
  assert.ok(intro.length > 1500, `intro window is ${intro.length} chars — the slice missed the sheet`);
  assert.ok(!/exclusive/i.test(intro), 'the intro sample still sells the retired Setnayan Exclusive');
  assert.ok(!/shoot/i.test(intro), 'the intro sample is written in one trade’s words ("shoot")');
  assert.ok(!/photo\s*&amp;\s*video/i.test(intro), 'the sample card is a photographer’s again');
});

test('the gift on the sample is the ONE shared gift line, not hand-written copy', () => {
  const intro = introSheet();
  assert.equal([...intro.matchAll(/<SetnayanGiftLine\b/g)].length, 1);
});

test('the intro says what a card needs to go live — the publish gate’s own list', () => {
  const intro = introSheet();
  assert.deepEqual([...PUBLISH_REQUIREMENTS], ['cover', 'price', 'inclusions'],
    'the publish requirements changed — rewrite the intro’s "can go live" line to match');
  assert.match(intro, /A photo, a starting price and what&rsquo;s included, and your card can go live\./);
  assert.ok(!/price can wait/i.test(intro), 'the intro tells a new shop a price is optional; it is a publish requirement');
  assert.ok(!/Two answers/.test(intro), 'the intro counts two answers; the gate asks three');
});
