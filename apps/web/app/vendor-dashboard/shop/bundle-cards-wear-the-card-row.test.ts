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
import { bundleHoldLine, bundleRowRefusal, BUNDLE_DELETE_WARNING } from '@/lib/bundle-card-row';
import { validatePackageDraft, type DraftPackage } from '@/lib/package-authoring';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const CARD = read('_components/shop-bundle-card.tsx');
const LIST = read('_components/shop-bundles.tsx');
const HEAD = read('_components/shop-services-head.tsx');
const PAGE = read('page.tsx');
const ROW = read('../services/_components/service-card-menu-row.tsx');
const ACTIONS = read('../packages/actions.ts');

test('1 · the bundle is drawn as a card — the ONE face Find draws — and opens the Bundle Maker', () => {
  assert.match(CARD, /<ServiceCardFace\b/, 'the bundle is no longer drawn by the card face couples see');
  assert.match(CARD, /const editHref = `\/vendor-dashboard\/packages\/\$\{bundle\.id\}`;/, 'Edit is no longer the Bundle Maker');
  assert.match(CARD, /<Link href=\{`\/vendor-dashboard\/packages\/\$\{bundle\.id\}`\}[^>]*data-shop-bundle-open/, 'tapping the bundle card no longer opens the Bundle Maker (the same door as Edit)');
  assert.match(LIST, /<ShopBundleCard key=\{b\.id\} bundle=\{b\} \/>/, 'the Bundles list no longer draws bundle cards');
  assert.doesNotMatch(LIST, /<ChevronRight/, 'the old plain bundle row (with its chevron) is back');
});

test('2 · under it ONE row — the SHIPPED ServiceCardMenuRow itself (Edit · Share · Online/Offline), never a copy', () => {
  // Owner 10 Nov (DECISION_LOG): SERVICE CARD = full-width card, then ONE row Edit · Share · Go online — and the bundle
  // card wears that same row. Imported, not redrawn: a hand-made twin drifts the day the service row changes.
  assert.match(
    CARD,
    /import \{ ServiceCardMenuRow \} from '@\/app\/vendor-dashboard\/services\/_components\/service-card-menu-row';/,
    'the bundle card no longer imports the service card’s row',
  );
  const at = CARD.indexOf('<ServiceCardMenuRow');
  assert.ok(at > 0, 'the bundle card no longer renders ServiceCardMenuRow');
  const use = CARD.slice(at, CARD.indexOf('/>', at));
  assert.match(use, /editHref=\{editHref\}/, 'the row’s Edit is not the Bundle Maker');
  assert.match(use, /isActive=\{live\}/, 'the row’s switch does not show the bundle’s Online/Offline');
  assert.match(use, /onToggle=\{toggle\}/, 'the row’s switch is not the bundle’s own online/offline call');
  assert.doesNotMatch(use, /\bshare=/, 'the bundle hands the row a service card’s share — a bundle is not an offerServiceInterest card');
  // The row sits directly under the card: after the swipe-wrapped face, before the refusal line.
  assert.ok(at > CARD.indexOf('</SwipeToDelete>') && at < CARD.indexOf('{refusal ?'), 'the row is not directly under the bundle card');
  // No hand-made row comes back beside it.
  for (const [re, what] of [
    [/role="switch"/, 'a switch of its own'],
    [/<SwitchTrack\b/, 'a SwitchTrack of its own'],
    [/\bSWITCH_BUTTON\b/, 'the switch button class'],
    [/icon=\{Pencil\}|icon=\{Share\}/, 'its own Edit/Share icon buttons'],
    [/data-bundle-menu-line/, 'its old hand-made row'],
  ] as const) {
    assert.doesNotMatch(CARD, re, `the bundle card draws ${what} — use ServiceCardMenuRow`);
  }
  // The row, given onToggle, submits the bundle's call through the SAME switch (one switch, one form) — no door.
  assert.match(ROW, /\) : onToggle \? \(\s*<form\s+id=\{formId\}[\s\S]{0,160}e\.preventDefault\(\);\s*onToggle\(\);/, 'the row no longer runs a bundle’s onToggle from its switch');
  assert.match(ROW, /disabled=\{toggling\}/, 'the switch does not wait while the bundle’s call is on its way');
});

test('2b · a refused Go online names EVERY missing item, one per line', () => {
  // The server door: setPackageActive returns validatePackageDraft's whole list, never the first.
  assert.match(ACTIONS, /const problems = validatePackageDraft\(read\.loaded\.draft\);\s*if \(problems\.length > 0\) return \{ status: 'invalid', problems \};/, 'going online no longer refuses with every problem');
  assert.match(ACTIONS, /export async function bundleCardRow[\s\S]{0,200}setPackageActive\(packageId, op === 'online'\)/, 'the bundle row’s Online is not the shipped setPackageActive');
  const bare: DraftPackage = { package_name: '', total_price_centavos: 0, consumable_budget_centavos: 0, is_consumable_flexible: false, items: [] };
  const problems = validatePackageDraft(bare);
  assert.ok(problems.length >= 3, `expected several missing items, got ${problems.length}`);
  const said = bundleRowRefusal({ status: 'invalid', problems }) ?? '';
  for (const p of problems) assert.ok(said.includes(p.message), `the refusal dropped “${p.message}”`);
  assert.equal(said.split('\n').length, problems.length, 'each missing item is not on its own line');
  assert.equal(bundleRowRefusal({ status: 'ok', packageId: 'x' }), null);
  assert.match(CARD, /const why = bundleRowRefusal\(res\);\s*if \(why\) setRefusal\(why\);/, 'the card no longer says the refusal under the row');
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

test('5 · Share is drawn waiting, like before — no new notice without the owner’s word', () => {
  // The bundle hands the row no `share`, and the row draws Share waiting when it has none.
  assert.match(ROW, /onClick=\{share \? \(\) => setSharing\(true\) : undefined\}\s*waiting=\{!share\}/, 'a row without share no longer draws Share waiting');
  assert.match(ROW, /\{share \? \(\s*<ServiceCardShareSheet\b/, 'a row without share would open an empty share sheet');
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
