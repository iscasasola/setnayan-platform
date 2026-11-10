/**
 * 🧺 THE BUNDLE MAKER IS THE APPROVED PROTOTYPE (Build 6 · Lane D; owner 9 Nov 2026; specs `prototypes/shop_discounts_
 * bundle_card_open_2026-11-09/bundle-maker.html` v3; DECISION_LOG 2026-11-09 "A BUNDLE = 2+ SERVICE CARDS + ITS OWN
 * PINNED PRICE + OFFER SWITCHES; GIFTS LIVE ONLY IN OFFERS…"). Replaces `the-bundle-maker-keeps-its-gift-and-swipe`:
 * the 9 Nov ruling took the gift off the bundle, so that guard's gift parts are now the opposite rule.
 *
 * A source-reading guard, anchored PER PART, each failing with the sentence of what was lost:
 *   1. lines still remove by THE ONE SWIPE with Undo (kept from 7 Nov), and no line carries a remove button;
 *   2. the New total is PINNED (sticky) and slims to one line while typing;
 *   3. the price is COMPUTED — no typed "Package price" box; the server re-computes it from the cards it read;
 *   4. the extra discount is pesos only; the plan is the shipped resolver's, copied from the one default;
 *   5. NO GIFT on a bundle — no gift row in the maker, and the save forces none;
 *   6. full screen (`RiseScreen`), ✕ is Cancel, and the thumb row is Save to my shop | Send to this couple at equal widths;
 *   7. the shared lock: the page shows the shared explainer, the save asks `canUse('bundleMaker')`;
 *   8. Enter sends (saves) from the maker's typed fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const EDITOR = read('_components/package-editor.tsx');
const ACTIONS = read('actions.ts');
const PAGE = read('[packageId]/page.tsx');

/** The JSX from `marker` to the end of the SwipeToDelete that encloses it. */
function swipeAround(marker: string): string {
  const at = EDITOR.indexOf(marker);
  assert.ok(at > 0, `the bundle maker no longer draws ${marker}`);
  const open = EDITOR.lastIndexOf('<SwipeToDelete', at);
  const close = EDITOR.indexOf('</SwipeToDelete>', at);
  assert.ok(open > 0 && close > at, `${marker} is not inside a <SwipeToDelete> — the line lost its swipe`);
  assert.ok(EDITOR.indexOf('</SwipeToDelete>', open) > at, `${marker} sits after its swipe closed — it is not swiped`);
  return EDITOR.slice(open, close);
}

test('1 · card and extra lines remove by their swipe, through removeLine, with Undo', () => {
  assert.match(swipeAround('data-bundle-line="card"'), /onDelete=\{\(\) => removeLine\(item\)\}/, 'the card line’s swipe no longer removes it');
  assert.match(swipeAround('data-bundle-line="extra"'), /onDelete=\{\(\) => removeLine\(item\)\}/, 'the extra line’s swipe no longer removes it');
  const body = EDITOR.slice(EDITOR.indexOf('const removeLine = '), EDITOR.indexOf('const editPlan = '));
  assert.match(body, /pushUndo\(\{/, 'removing a line no longer offers Undo');
  assert.match(body, /items\.splice\(/, 'Undo no longer puts the line back');
  assert.match(EDITOR, /<UndoToastHost \/>/, 'the Undo toast is not mounted — the Undo would be invisible');
  assert.doesNotMatch(EDITOR, /aria-label="Remove this inclusion"/, 'the trash button on a line is back');
});

test('2 · the New total is pinned at the top and slims to one line while typing', () => {
  const at = EDITOR.indexOf('data-bundle-total-pin=');
  assert.ok(at > 0, 'the pinned New total is gone');
  const tag = EDITOR.slice(EDITOR.lastIndexOf('<div', at), at);
  assert.match(tag, /\bsticky top-0\b/, 'the New total no longer pins (sticky) — it scrolls away with the body');
  assert.match(EDITOR, /data-bundle-total-pin=\{typing \? 'slim' : 'full'\}/, 'the pinned row no longer slims while a field is typed in');
  assert.match(EDITOR, /\{typing \? null : \(/, 'the small line still shows while the keyboard is up');
  assert.match(EDITOR, /pinnedTotalLine\(sums, php\)/, 'the small line is not the one sums line');
});

test('3 · the price is computed, never typed — on the client and again on the server', () => {
  assert.doesNotMatch(EDITOR, /id="pkg-price"/, 'the typed Package price box is back — the owner’s sums leave nothing to type');
  assert.match(EDITOR, /bundleSums\(picked, extraPhp, clock\)/, 'the maker no longer sums the cards at their lowest');
  const priced = ACTIONS.slice(ACTIONS.indexOf('async function priceTheBundle('));
  assert.match(priced, /readBundleCards\(supabase, vendorProfileId\)/, 'the save no longer re-reads the cards it prices');
  assert.match(priced, /if \(!cards\) return \{ status: 'error'/, 'a refused card read no longer refuses the save');
  assert.match(priced, /total_price_centavos: totalCentavos\(sums\)/, 'the save no longer writes the total IT computed');
  assert.match(ACTIONS, /if \(isBundle\) \{\s*const priced = await priceTheBundle\(/, 'a bundle save is no longer priced on the server');
});

test('4 · the extra discount is pesos only; the plan is the shipped resolver from the one default', () => {
  const at = EDITOR.indexOf('id="pkg-extra"');
  assert.ok(at > 0, 'the extra bundle discount field is gone');
  assert.match(EDITOR.slice(at, at + 900), /inputMode="numeric"/, 'the extra discount takes more than whole pesos');
  assert.doesNotMatch(EDITOR, /extra[^\n]{0,60}%/i, 'the extra discount offers a percent — pesos only (owner 9 Nov)');
  assert.match(EDITOR, /resolveBundlePlan\(plan, sums\.newTotalPhp\)/, 'the plan no longer balances against the new total');
  assert.match(EDITOR, /planDraftsOrDefault\(initial\.plan\)/, 'the plan no longer starts from a copy of the default');
  assert.match(read('../../../lib/bundle-sums.ts'), /DEFAULT_QUOTE_PLAN/, 'the bundle typed its own default plan — copy the one default');
  assert.match(read('../../_components/proposal-maker.tsx'), /DEFAULT_QUOTE_PLAN/, 'the quote maker typed its own default plan again');
});

test('5 · no gift on a bundle — gifts live only in offers', () => {
  assert.doesNotMatch(EDITOR, /data-bundle-gift/, 'the bundle maker grew a Gift row again (9 Nov: gifts live only in offers)');
  assert.doesNotMatch(EDITOR, /packageGiftMenu/, 'the bundle maker offers gifts again');
  assert.match(ACTIONS.slice(ACTIONS.indexOf('async function priceTheBundle(')), /gift: '',/, 'a bundle save can carry a gift again');
});

test('6 · full screen; ✕ is Cancel; Save to my shop | Send to this couple at equal widths', () => {
  assert.match(EDITOR, /<RiseScreen\b/, 'the Bundle Maker is not full screen (RiseScreen) — the bottom nav would show');
  assert.match(EDITOR, /onClose=\{\(\) => router\.push\(closeHref\)\}/, '✕ no longer returns to the Shop');
  const at = EDITOR.indexOf('<EqualRow data="bundle-thumb">');
  assert.ok(at > 0, 'the thumb row is not one equal-width row');
  const row = EDITOR.slice(at, EDITOR.indexOf('</EqualRow>', at));
  assert.match(row, /label=\{pending \? 'Saving…' : 'Save to my shop'\}/, 'Save to my shop is gone');
  assert.match(row, /label="Send to this couple"/, 'Send to this couple is gone');
  assert.doesNotMatch(row, /label="Cancel"/, 'Cancel is back in the thumb row — it is the ✕ of the rise');
  assert.doesNotMatch(EDITOR, /<SupplierThumbRow name="bundle"/, 'the old floating thumb row is back under the full screen');
});

test('7 · the shared lock — shown on the page, asked by the save', () => {
  assert.match(PAGE, /canUse\('bundleMaker', shop\)/, 'the maker page no longer asks the shared lock');
  assert.match(PAGE, /<BundleMakerLocked /, 'a locked shop is not shown the shared explainer');
  assert.match(PAGE, /if \(!shop\) \{\s*throw new Error/, 'an unread lock is drawn open instead of refused');
  assert.match(read('_components/bundle-maker-locked.tsx'), /<LockExplainer lock="bundleMaker"/, 'the locked page draws its own lock, not the shared one');
  assert.match(ACTIONS, /if \(!canUse\('bundleMaker', shop\)\.ok\) return \{ status: 'locked' \}/, 'the save no longer refuses a locked shop');
});

test('8 · Enter sends — the typed fields save on Enter', () => {
  for (const id of ['id="pkg-name"', 'id="pkg-extra"']) {
    const at = EDITOR.indexOf(id);
    assert.ok(at > 0, `${id} is gone`);
    assert.match(EDITOR.slice(at, at + 700), /e\.key === 'Enter'[\s\S]{0,80}save\(\)/, `${id} no longer saves on Enter`);
  }
});

test('9 · a booked bundle keeps its price; going offline and deleting wait for its bookings', () => {
  assert.match(ACTIONS, /scope === 'metadata_only' && isBundle\) \{[\s\S]{0,600}total_price_centavos: stored\.total_price_centavos/, 'a booked bundle takes today’s re-computed price');
  const active = ACTIONS.slice(ACTIONS.indexOf('async function setPackageActive('));
  assert.match(active, /if \(!isActive\) \{\s*const open = await countActiveBookings/, 'going offline no longer waits for the open bookings');
  assert.match(active, /if \(open === null\) return \{ status: 'error'/, 'an unread booking count lets a bundle go offline');
  const del = ACTIONS.slice(ACTIONS.indexOf('async function deletePackage('));
  assert.match(del, /if \(countErr \|\| count === null\) return \{ status: 'error'/, 'an unread booking count reads as zero and deletes a booked bundle');
});
