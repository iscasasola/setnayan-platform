/**
 * THE BUNDLE MAKER KEEPS ITS GIFT ROW AND ITS SWIPE (owner 7 Nov 2026 — "where are the gifts?"; DECISION_LOG "THE FOUR
 * MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES"; prototype
 * `makers_match_2026-11-07` § 4).
 *
 * A source-reading guard, anchored PER PART (never a file-level match — "a file-level match cannot say which component
 * still holds a flag"), each failing with the sentence of what was lost:
 *   1. every bundle line — card AND extra — is wrapped in THE ONE SWIPE, whose delete is `removeLine`, which pushes
 *      the shipped Undo; and no line carries a remove BUTTON any more;
 *   2. the Gift row is ONE PickMenu fed by `packageGiftMenu` (No gift · Setnayan gift · the shop's packs);
 *   3. the save writes the gift — in BOTH the update and the insert — and the card link on each line;
 *   4. the spendable budget lives inside the "More settings" fold, not the main body;
 *   5. the thumb row is the shipped one: Cancel neutral, Save bundle brand + main;
 *   6. the couple's bundle card draws the gift the way a card does (`SetnayanGiftLine`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { packageGiftMenu, packageGiftColumns, packageGiftOf } from '@/lib/package-gift';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const EDITOR = read('_components/package-editor.tsx');
const ACTIONS = read('actions.ts');
const CARD = read('../../_components/vendor-packages/package-card.tsx');

/** The JSX from `marker` to the end of the SwipeToDelete that encloses it (the nearest opener before it). */
function swipeAround(marker: string): string {
  const at = EDITOR.indexOf(marker);
  assert.ok(at > 0, `the bundle maker no longer draws ${marker}`);
  const open = EDITOR.lastIndexOf('<SwipeToDelete', at);
  const close = EDITOR.indexOf('</SwipeToDelete>', at);
  assert.ok(open > 0 && close > at, `${marker} is not inside a <SwipeToDelete> — the line lost its swipe`);
  // The opener nearest the marker must not have been closed before the marker.
  assert.ok(EDITOR.indexOf('</SwipeToDelete>', open) > at, `${marker} sits after its swipe closed — it is not swiped`);
  return EDITOR.slice(open, close);
}

test('a CARD line is removed by its swipe, through removeLine', () => {
  const block = swipeAround('data-bundle-line="card"');
  assert.match(block, /onDelete=\{\(\) => removeLine\(item\)\}/, 'the card line’s swipe no longer removes it');
});

test('an EXTRA line is removed by its swipe, through removeLine', () => {
  const block = swipeAround('data-bundle-line="extra"');
  assert.match(block, /onDelete=\{\(\) => removeLine\(item\)\}/, 'the extra line’s swipe no longer removes it');
});

test('removeLine keeps an Undo — the shipped toast puts the line back', () => {
  const at = EDITOR.indexOf('const removeLine = ');
  assert.ok(at > 0, 'removeLine is gone');
  const body = EDITOR.slice(at, EDITOR.indexOf('const save = ', at));
  assert.match(body, /pushUndo\(\{/, 'removing a line no longer offers Undo');
  assert.match(body, /undo: async \(\) =>[\s\S]*?items\.splice\(/, 'Undo no longer puts the line back');
  assert.match(EDITOR, /<UndoToastHost \/>/, 'the page no longer mounts the Undo toast — the Undo would be invisible');
});

test('no bundle line carries a remove BUTTON (the swipe is the only way)', () => {
  assert.doesNotMatch(EDITOR, /aria-label="Remove this inclusion"/, 'the trash button on a line is back');
  assert.doesNotMatch(EDITOR, /patch\(\{ items: draft\.items\.filter\(\(i\) => i\.ref !== item\.ref\) \}\)/, 'a line deletes without Undo again');
});

test('the Gift row is one PickMenu of packageGiftMenu', () => {
  const at = EDITOR.indexOf('data-bundle-gift=""');
  assert.ok(at > 0, 'the bundle maker has no Gift row');
  const block = EDITOR.slice(at, EDITOR.indexOf('data-bundle-gift-hint', at));
  assert.match(block, /<PickMenu[\s\S]*?options=\{giftMenu\}/, 'the Gift row is no longer the one dropdown');
  assert.match(EDITOR, /const giftMenu = packageGiftMenu\(/, 'the Gift dropdown is not fed by packageGiftMenu');
  assert.match(block, /onPick=\{\(k\) => patch\(\{ gift: k \}\)\}/, 'picking a gift no longer sets the draft’s gift');
});

test('the Gift menu offers No gift · Setnayan gift · the shop’s packs, and says when stock is short', () => {
  const packs = [
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic' as const, credits: 150, srpCentavos: 14900, giftPriceCentavos: null },
    { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus' as const, credits: 1, srpCentavos: 99900, giftPriceCentavos: null },
  ];
  const menu = packageGiftMenu(packs, { papic: 300, event_plus: 0, event_pro: 0 });
  assert.deepEqual(menu.map((o) => o.key), ['', 'setnayan', 'PAPIC_GUEST_150', 'EVENT_PLUS']);
  assert.equal(menu[0]!.label, 'No gift');
  assert.equal(menu[1]!.label, 'Setnayan gift');
  assert.equal(menu[2]!.disabledNote, undefined, 'a pack the stock covers must be pickable');
  assert.equal(menu[3]!.disabledNote, 'Not enough in your stock · buy first');
  // Unread stock is never "none": every pack says it could not be read.
  assert.match(packageGiftMenu(packs, null)[2]!.disabledNote ?? '', /Couldn’t read your gift stock/);
});

test('a gift round-trips through its two columns, and a non-gift code is refused', () => {
  for (const g of ['', 'setnayan', 'PAPIC_GUEST_150', 'EVENT_PLUS', 'COUPLE_WEBSITE_PRO']) {
    const cols = packageGiftColumns(g);
    assert.ok(cols, `${g || '(none)'} has no columns`);
    assert.equal(packageGiftOf(cols), g);
  }
  assert.equal(packageGiftColumns('LIVE_STUDIO'), null, 'a product that cannot be gifted must be refused');
});

test('the save writes the gift in BOTH the update and the insert, and each line’s card', () => {
  const update = ACTIONS.slice(ACTIONS.indexOf(".from('vendor_packages')\n      .update({"));
  assert.match(update.slice(0, 600), /\.\.\.giftCols,/, 'saving an existing bundle no longer writes its gift');
  const insert = ACTIONS.slice(ACTIONS.indexOf(".from('vendor_packages')\n    .insert({"));
  assert.match(insert.slice(0, 600), /\.\.\.giftCols,/, 'a new bundle is created without its gift');
  assert.match(ACTIONS, /vendor_service_id: i\.vendorServiceId/, 'a card line is saved without its card');
  assert.match(ACTIONS, /giftStockRefusal\(/, 'a shop pack can go on a bundle without the stock to give it');
});

test('the spendable budget lives under More settings, not in the main body', () => {
  const fold = EDITOR.indexOf('data="bundle-more"');
  assert.ok(fold > 0, 'the More settings fold is gone');
  const budget = EDITOR.indexOf('id="pkg-budget"');
  assert.ok(budget > fold && budget < EDITOR.indexOf('</Fold>', fold), 'the spendable budget is outside More settings');
});

test('the thumb row is the shipped one: Cancel grey, Save bundle terracotta and main', () => {
  const at = EDITOR.indexOf('<SupplierThumbRow name="bundle"');
  assert.ok(at > 0, 'the bundle maker lost the shipped thumb row');
  const row = EDITOR.slice(at, EDITOR.indexOf('</SupplierThumbRow>', at));
  assert.match(row, /<ActionButton tone="neutral" icon=\{X\} label="Cancel"/, 'Cancel is no longer the grey ActionButton');
  assert.match(row, /tone="brand"\s+main[\s\S]*?label=\{pending \? 'Saving…' : 'Save bundle'\}/, 'Save bundle is no longer the terracotta main');
});

test('the couple’s bundle card draws the gift the way a card does', () => {
  assert.match(CARD, /<SetnayanGiftLine /, 'a bundle’s Setnayan gift is not drawn with the card’s own line');
  assert.match(CARD, /gift\.line/, 'a bundle’s shop-pack gift line is not drawn');
});
