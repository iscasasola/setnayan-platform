/**
 * 🔒 THE SHOP TAB IS v113 (THE ONE BUILD, lane C4 — A3 §5 guard 1, as cut by spec §9 #8).
 *   1 · ONE scroll, in the ruled order: the cover → Analytics → Badges → Makers → Services.
 *       🔁 UPDATED ON PURPOSE 2026-11-08 (Build 2 §10 #31, owner: *"these menu are lost. isn't your details inside the
 *       upper right menu? isn't your page inside the shop settings?"*): the two door rows under the cover are gone —
 *       Your page is the Shop ⚙'s first row, Your details the account sheet's (`lib/my-shop-doors-keep-every-control`
 *       pins both). The order is still pinned, one part shorter, and the doors are pinned ABSENT.
 *   2 · The app's words, never the prototype's WRONG/INVENTED ones: no Explore / Boost / Approve first / Owner ID /
 *       Enterprise / Custom plan / Take a photo / Request a name change; the unverified chip is "Get verified · N of 2".
 *   3 · Makers = ONE row of tiles — Forms Maker + Specialized tools (Lane E, 9 Nov: Scanner = its first tile, the shipped
 *       ServiceScannerPick), each opening into the body
 *       (§10 #33); NO Tools Maker in this build. 🔁 UPDATED ON PURPOSE 2026-11-08: the Forms door was a link to the Forms
 *       page (`formsHref ? (`); it is now a tile whose body is the server's, drawn while `?maker=forms` — pinned below
 *       so it can never be a tile with nothing behind it.
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
  // 🔁 UPDATED ON PURPOSE 2026-11-08 (release gate): Analytics STREAMS — the page draws `<ShopAnalyticsSection` in a
  // <Suspense>. The order is still pinned at the place it is drawn.
  // 🔁 UPDATED ON PURPOSE 2026-11-10 (Build 6 Lane I, "no dupes"): the section draws ONE door into Shop › Analytics,
  // not the five-card carousel — `shop/one-analytics-not-two.test.ts` holds that.
  const order = [at(/<ShopCover\b/), at(/<ShopAnalyticsSection\b/), at(/<ShopBadgeRow\b/), at(/<ShopMakers\b/), at(/id="services"/)];
  assert.match(PAGE, /async function ShopAnalyticsSection\b[\s\S]*?<ShopAnalyticsDoor\b/, 'the Analytics section no longer draws its one door');
  assert.ok(order.every((i) => i > 0), `a Shop part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the Shop tab is out of the ruled order (cover · Analytics · Badges · Makers · Services)');
  assert.doesNotMatch(PAGE, /data-shop-doors=""/, 'loose door rows are back under the cover (§10 #31)');
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

test('3 · Makers = one row of tiles (Forms Maker + Specialized tools, Scanner first inside); no Tools Maker', () => {
  // 🔁 UPDATED ON PURPOSE 2026-11-09 (Build 3 Lane E item 13, owner: "our scanner will live inside the specialized
  // tools"): the Scanner tile left the row and is the FIRST tile of the Specialized tools carousel, same shipped body.
  assert.match(MAKERS, /<ServiceScannerPick\b/);
  assert.match(MAKERS, /data-maker=\{t\.k\}/, 'the Makers are not one row of tiles');
  assert.match(MAKERS, /k: 'tools', title: 'Specialized tools'/);
  assert.match(MAKERS, /k: 'forms' as const, title: 'Forms Maker'/);
  assert.match(PAGE, /<ShopMakers\s+scanners=\{scanners\}\s+formsBody=\{shopFormsBody\(sp\)\}/, 'the Forms tile has no body behind it (a dead tile)');
  assert.match(read('_components/shop-forms-body.tsx'), /return sp\.maker === 'forms' \? <ShopFormsBody \/> : null;/, 'the Forms body is read when the panel is shut');
  // The tools' lines are already on the page — opening them must not touch the address (a server re-draw of the Shop).
  assert.match(MAKERS, /if \(k !== 'forms' && !params\.get\('maker'\)\) return;/, 'opening the tools costs a server round-trip');
  // A tile with no door is not drawn: no Tools Maker and no "Make your own" until the Tools Maker exists.
  assert.doesNotMatch(MAKERS + PAGE, /Tools Maker'|data-maker="tools-maker"|Make your own/, 'a Tools Maker tile is drawn with no maker behind it');
});

test('4 · the Booked Loop is C2’s counter, hidden whenever it was not read', () => {
  const ROW = stripComments(readFileSync(join(HERE, '../../../lib/shop-badge-row.ts'), 'utf8'));
  const SERVER = stripComments(readFileSync(join(HERE, '../../../lib/badge-rewards.server.ts'), 'utf8'));
  assert.match(SERVER, /readShopBookedLoopCount\(admin, vendorProfileId\)/, 'the loop is not read from C2’s counter');
  assert.match(ROW, /if \(NEEDS_LOOP_COUNTER\.has\(row\.key\) && !loopsRead\(i\)\) return null;/, 'an unread loop is drawn');
});
