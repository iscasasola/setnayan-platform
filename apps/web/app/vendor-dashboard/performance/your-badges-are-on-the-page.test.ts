/**
 * 🏅 THE SHOP'S BADGES ARE ON SHOP › HOW IT IS GOING — owner, verbatim, 2026-10-29: *"Their badges will be on the
 * supplier shop performance page"*.
 *
 * Properties:
 *   1 · the words are the shipped badges' own: every badge worn today (`shopBadges`) and the next step with how far
 *       (`nextToEarnLine`); a refused read is "—" + "Couldn’t load", never "none" and never "0 to go";
 *   2 · drawn by THE one pill (`ShopBadgePill`) — no second badge drawing;
 *   3 · read in the page's own batch — started once, awaited inside Batch A (no extra round trip), and shown on the
 *       tier upsell too (a badge is not a paid feature);
 *   4 · Today's earned line stays (it announces a NEW badge once; no ruling moves it).
 *   5 · 📣🗺 ONE HOME (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL": *"Make the pages live there and
 *       not jump to another menu"*): the ONE badge tracker (bars · the next badge · the action that moves each) is
 *       here, Analytics › Your badges; Shop › Page keeps the badge pills only — no tracker, no second drawing of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { badgeShelf, badgeTracker, type ShopBadgeFacts } from '@/lib/shop-badges';

const WEB = join(import.meta.dirname, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const facts = (over: Partial<ShopBadgeFacts> = {}): ShopBadgeFacts => ({
  verified: true,
  completedEvents: 46,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 },
  inBusinessSinceYear: 2019,
  awards: [],
  nowYear: 2026,
  ...over,
});

test('1 · every badge worn today, and the next step with how far', () => {
  const s = badgeShelf(facts());
  assert.equal(s.measured, true);
  assert.deepEqual(s.pills.map((p) => p.key), ['verified', 'milestone:10', 'rating', 'years']);
  assert.equal(s.next, 'Next to earn: 50 events · Silver · 4 to go');
  assert.equal(badgeShelf(facts({ completedEvents: 10_000 })).next, 'Every milestone earned');
});

test('1 · ⛔ a refused read is said — never "none", never "0 to go"', () => {
  const refused = badgeShelf(null);
  assert.equal(refused.measured, false);
  assert.equal(refused.next, '—');
  assert.deepEqual(refused.pills, []);
  const uncounted = badgeShelf(facts({ completedEvents: null }));
  assert.equal(uncounted.next, 'Next to earn: —');
  assert.ok(!uncounted.pills.some((p) => p.kind === 'milestone'), 'an uncounted milestone is claimed');
  const view = src('app/vendor-dashboard/performance/_components/your-badges.tsx');
  assert.match(view, /!shelf\.measured \? \(/, 'the unread state is not drawn first');
  assert.match(view, /Couldn’t load your badges just now\./);
});

test('2 · drawn by THE one pill — no second drawing', () => {
  const view = src('app/vendor-dashboard/performance/_components/your-badges.tsx');
  assert.match(view, /import \{ ShopBadgePill \} from '@\/app\/_components\/shop-badge-pill';/);
  assert.match(view, /<ShopBadgePill key=\{b\.key\} badge=\{b\}/);
  assert.doesNotMatch(view, /<svg/, 'a second badge drawing');
  // The tracker row's circle is the pill's own circle alone (its glyph, gold on the gold-foil ring) — exactly one.
  assert.equal(view.split('border-[1.4px] border-[#d9b866]').length - 1, 1, 'a second badge circle');
  assert.match(view, /badge\.glyph === null \? <SetnayanMark/, 'the circle does not draw the pill’s own glyph');
});

test('3 · read once, inside the page’s own batch, and shown on the upsell too', () => {
  const page = src('app/vendor-dashboard/performance/page.tsx');
  assert.equal([...page.matchAll(/readShopTrackerFacts\(/g)].length, 1, 'the tracker facts are read more than once');
  assert.match(page, /const badgeFactsRead: Promise<TrackerFacts \| null> = safeRead\(\s*readShopTrackerFacts\(profile\.vendor_profile_id\),\s*null,/);
  /* Re-anchored 6 Nov 2026 ("Analytics, growing"): Batch A grew three reads (the lanes' two series and the booked
     dates) between `pricePosition` and `badgeFacts`, so the anchor is the batch's LAST name — `badgeFacts` closing the
     destructure that `marketRegionRow` and `pricePosition` open into — not three adjacent lines. */
  const close = page.search(/\n\s*badgeFacts,\n\s*\] = await Promise\.all\(\[/);
  const destructure = close > 0 ? page.slice(page.lastIndexOf('const [', close), close) : '';
  assert.match(destructure, /\bmarketRegionRow,[\s\S]*\bpricePosition,/, 'the badges are not part of Batch A');
  const batchStart = close > 0 ? page.lastIndexOf('const [', close) : -1;
  assert.ok(batchStart > 0, 'the badges are not part of Batch A');
  const batch = page.slice(batchStart, page.indexOf(']);', batchStart));
  assert.match(batch, /\n\s*badgeFactsRead,\s*$/, 'Batch A does not await the badges');
  assert.match(page, /const shelf = badgeShelf\(badgeFacts\);/);
  assert.match(page, /<YourBadges shelf=\{shelf\} rows=\{badgeRows\} \/>/);
  assert.match(page, /const badgeRows = badgeFacts \? badgeTracker\(badgeFacts\) : null;/);
  // The upsell (free / verified tiers when the gate is on) shows them too.
  const gated = page.slice(page.indexOf('if (gateOn && !canSeePerformanceTrends(tier))'), batchStart);
  assert.match(gated, /<YourBadges shelf=\{gatedShelf\} rows=\{gatedFacts \? badgeTracker\(gatedFacts\) : null\} \/>/);
});

test('4 · Today’s earned line stays', () => {
  assert.match(src('app/vendor-dashboard/page.tsx'), /BadgeEarnedLine/, 'Today’s “You earned …” line was removed without a ruling');
});

test('5 · 📣🗺 the ONE tracker is Analytics › Your badges; Shop › Page keeps the pills only', () => {
  const view = src('app/vendor-dashboard/performance/_components/your-badges.tsx');
  // The tracker draws every row badgeTracker composes: bar, ladder, the action that moves it, the state chip.
  for (const a of ['data-badge-tracker=""', 'data-badge-row={r.kind}', 'role="progressbar"', 'data-badge-ladder=""', 'label={r.door.label}', '{r.stateWord}']) {
    assert.ok(view.includes(a), `Your badges lost the tracker’s ${a}`);
  }
  assert.match(view, /rows\.map\(\(r\) =>/);
  // The rows are the shipped composer's, on the facts the page already read — a refused read draws no rows.
  const rows = badgeTracker({ ...facts(), unreviewed: 2 });
  assert.deepEqual(rows.map((r) => r.kind), ['verified', 'milestone', 'rating', 'years']);
  assert.equal(rows.find((r) => r.kind === 'milestone')?.stateWord, '4 to go');

  // Shop › Page: the pills, and nothing of the tracker.
  const parts = src('app/vendor-dashboard/website/_components/page-parts.tsx');
  const fold = parts.slice(parts.indexOf('anchor="badges"'), parts.indexOf('</Fold>', parts.indexOf('anchor="badges"')));
  assert.ok(fold.length > 0, 'the Awards and badges fold is gone');
  assert.match(fold, /<ShopBadgePill key=\{b\.key\} badge=\{b\}/, 'Page lost the badge pills');
  assert.doesNotMatch(fold, /BadgeTracker|progressbar|data-badge-row|r\.door|Save to print/, 'Page still draws the tracker');
  assert.doesNotMatch(parts, /from '\.\/badge-tracker'/);
  const data = src('app/vendor-dashboard/website/page-data.ts');
  assert.doesNotMatch(data, /badgeTracker\(|readShopTrackerFacts\(|nextToEarnLine\(/, 'Page still composes the tracker');
  assert.match(data, /pills: shopBadges\(badgeFacts\)/);
  // No go-elsewhere link between the two homes.
  assert.doesNotMatch(fold + view, /Edit in |↗/);
});
