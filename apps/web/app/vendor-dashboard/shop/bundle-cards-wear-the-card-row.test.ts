/**
 * 🧺 BUNDLE CARDS WEAR THE SERVICE CARD ROW · THE LIST IS "YOUR BUNDLES AND SERVICES" (Build 6 · Lane D).
 *
 * Owner 11 Nov 2026 (DECISION_LOG "BUNDLE CARDS FOLLOW THE SERVICE CARD ROW RULE"): a bundle card wears the same row as
 * a service card — the card is the only frame; under it Edit icon · Share icon · worded Online/Offline toggle; swipe left
 * deletes with the delete warning; off/delete refused while any booking of it is open. Owner 9 Nov: "Your Bundles and
 * Services instead of Your services" — bundles listed first. And the shared lock is SHOWN on the Bundles section.
 *
 * Anchored per part; each failure names what was lost.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bundleHoldLine, BUNDLE_DELETE_WARNING } from '@/lib/bundle-card-row';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const CARD = read('_components/shop-bundle-card.tsx');
const LIST = read('_components/shop-bundles.tsx');
const HEAD = read('_components/shop-services-head.tsx');
const PAGE = read('page.tsx');

test('1 · the bundle is drawn as a card — the ONE face Find draws — and opens the Bundle Maker', () => {
  assert.match(CARD, /<ServiceCardFace\b/, 'the bundle is no longer drawn by the card face couples see');
  assert.match(CARD, /<Link href=\{`\/vendor-dashboard\/packages\/\$\{bundle\.id\}`\}[^>]*data-shop-bundle-open/, 'tapping the bundle card no longer opens the Bundle Maker');
  assert.match(LIST, /<ShopBundleCard key=\{b\.id\} bundle=\{b\} \/>/, 'the Bundles list no longer draws bundle cards');
  assert.doesNotMatch(LIST, /<ChevronRight/, 'the old plain bundle row (with its chevron) is back');
});

test('2 · under it ONE row: Edit icon · Share icon · the worded Online/Offline switch', () => {
  const at = CARD.indexOf('data-bundle-menu-line');
  assert.ok(at > 0, 'the row under the bundle card is gone');
  const row = CARD.slice(at, CARD.indexOf('{refusal ?', at));
  const edit = row.indexOf('icon={Pencil} iconOnly');
  const share = row.indexOf('icon={Share} iconOnly');
  const sw = row.indexOf('<SwitchTrack on={live} words={{ on: \'Online\', off: \'Offline\' }} />');
  assert.ok(edit > 0 && share > edit && sw > share, 'the row is no longer Edit · Share · Online/Offline, in that order');
  assert.match(row, /role="switch"/, 'Online/Offline is no longer a switch');
});

test('3 · swipe left deletes — after the house warning, with Cancel · Delete at equal widths, then Undo', () => {
  assert.match(CARD, /<SwipeToDelete label=\{`Delete \$\{bundle\.name\}`\} onDelete=\{onSwipeDelete\}/, 'the bundle card lost its swipe to delete');
  assert.match(CARD, /<Sheet open=\{warn\}/, 'deleting a bundle no longer warns first');
  assert.match(CARD, /<EqualRow data="bundle-delete">[\s\S]*?label="Cancel"[\s\S]*?tone="danger" main[\s\S]*?label="Delete"/, 'the warning is not Cancel · Delete at equal widths');
  assert.match(CARD, /deleteWithUndo\(\{/, 'a deleted bundle has no Undo');
  assert.ok(BUNDLE_DELETE_WARNING.length > 0 && BUNDLE_DELETE_WARNING.every((l) => l.length > 0), 'the warning says nothing');
});

test('4 · off and delete are refused while any booking of it is open — and an unread count refuses too', () => {
  assert.equal(bundleHoldLine(0), null);
  assert.match(bundleHoldLine(2) ?? '', /2 open bookings/);
  assert.match(bundleHoldLine(null) ?? '', /Couldn’t check/, 'an unread booking count must never read as "none"');
  assert.match(CARD, /if \(live && hold\) \{\s*setRefusal\(hold\)/, 'Offline no longer waits for the open bookings');
  assert.match(CARD, /function onSwipeDelete[\s\S]{0,120}if \(hold\) \{\s*setRefusal\(hold\)/, 'Delete no longer waits for the open bookings');
  assert.match(PAGE, /countActiveBookings\(supabase, p\.package_id\)/, 'the Shop no longer reads each bundle’s open bookings');
});

test('5 · Share is drawn waiting, like the service card’s — no new notice without the owner’s word', () => {
  assert.match(CARD, /icon=\{Share\} iconOnly[^\n]*\bwaiting\b/, 'Share posts something now — the owner holds the chat notice (email allowlist)');
});

test('6 · the list is "Your bundles and services", bundles first', () => {
  assert.match(HEAD, />\s*Your bundles and services\s*</, 'the head no longer reads "Your bundles and services"');
  assert.doesNotMatch(HEAD, />\s*Your services\s*</, 'the head says "Your services" again');
  const bundles = PAGE.indexOf('<ShopBundles ');
  const cards = PAGE.indexOf('<VendorServicesManager ');
  assert.ok(bundles > 0 && cards > bundles, 'bundles are no longer listed first');
});

test('7 · the Bundles section shows the shared lock, never hides it', () => {
  assert.match(LIST, /lock \? \([\s\S]{0,200}<LockedFeature lock="bundleMaker"/, 'a locked shop’s Bundles section hides the lock');
  assert.match(PAGE, /canUse\('bundleMaker', lockShop\)/, 'the Shop draws the lock from a rule of its own, not the shared canUse');
});
