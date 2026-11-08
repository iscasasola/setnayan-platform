/**
 * 🔒 THE SHOP TAB IS v113 (THE ONE BUILD, lane C4 — A3 §5 guard 1, as cut by spec §9 #8).
 *   1 · ONE scroll, in the ruled order: the cover → Your page · Your details → Analytics → Badges → Makers → Services.
 *   2 · The app's words, never the prototype's WRONG/INVENTED ones: no Explore / Boost / Approve first / Owner ID /
 *       Enterprise / Custom plan / Take a photo / Request a name change; the unverified chip is "Get verified · N of 2".
 *   3 · Makers = Scanner (the shipped ServiceScannerPick) + the Forms door; NO Tools Maker in this build.
 *   4 · The Booked Loop stays HIDDEN until C2's counter is read (spec §9 #11).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const COVER = read('_components/shop-cover.tsx');
const MAKERS = read('_components/shop-makers.tsx');

test('1 · one scroll, in the ruled order', () => {
  const at = (re: RegExp) => PAGE.search(re);
  const order = [at(/<ShopCover\b/), at(/data-shop-doors=""/), at(/<ShopAnalyticsCarousel\b/), at(/<ShopBadgeRow\b/), at(/<ShopMakers\b/), at(/id="services"/)];
  assert.ok(order.every((i) => i > 0), `a Shop part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the Shop tab is out of the ruled order (cover · doors · Analytics · Badges · Makers · Services)');
  assert.doesNotMatch(PAGE, /<ShopSegments\b/, 'the retired Shop ▾ row is back on the Shop tab');
});

test('2 · the app’s words, never the WRONG or INVENTED ones', () => {
  for (const [name, src] of [['page', PAGE], ['cover', COVER], ['makers', MAKERS]] as const) {
    assert.doesNotMatch(src, />[^<]*\b(Explore|Boost|Approve first|Owner ID|Enterprise|Custom plan|Take a photo|Request a name change)\b[^<]*</, `${name} draws a word the map ruled out`);
  }
  assert.match(COVER, /Get verified · \{d\.verified\.stepsDone\} of 2/);
  assert.match(COVER, /href="#docs"/, 'Verified does not open the papers');
  assert.match(COVER, /View shop/);
});

test('3 · Makers = Scanner + the Forms door; no Tools Maker', () => {
  assert.match(MAKERS, /<ServiceScannerPick\b/);
  assert.match(MAKERS, /data-maker="scanner"/);
  assert.match(MAKERS, /formsHref \? \(/, 'the Forms door is drawn with no address (a dead door)');
  assert.doesNotMatch(MAKERS + PAGE, /Tools Maker|data-maker="tools"/, 'the Tools Maker is back — out of this build (spec §9 #8)');
});

test('4 · the Booked Loop is C2’s counter, hidden whenever it was not read', () => {
  const ROW = stripComments(readFileSync(join(HERE, '../../../lib/shop-badge-row.ts'), 'utf8'));
  const SERVER = stripComments(readFileSync(join(HERE, '../../../lib/badge-rewards.server.ts'), 'utf8'));
  assert.match(SERVER, /readShopBookedLoopCount\(admin, vendorProfileId\)/, 'the loop is not read from C2’s counter');
  assert.match(ROW, /if \(NEEDS_LOOP_COUNTER\.has\(row\.key\) && !loopsRead\(i\)\) return null;/, 'an unread loop is drawn');
});
