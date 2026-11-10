/**
 * 🃏 SHOP › SERVICES: THE CARD, THEN ONE MENU ROW UNDER IT — EDIT · SHARE · GO ONLINE (owner 10 Nov, DECISION_LOG,
 * verbatim: *"It is service card then a menu under to edit share go online"*; Build 5 Lane C).
 *
 * Fails if:
 *   • the card regrows a side switch or a side copy icon, or the old "Edit · every field" row comes back;
 *   • the row under the card is anything but THREE ActionButtons in one EqualRow (Edit · Share · Go online);
 *   • Go online stops being the shipped `toggleVendorServiceActive`;
 *   • a refused Go online names only the FIRST unmet requirement instead of every one;
 *   • Duplicate stops being reachable inside the Card Maker.
 *
 * Source-scanned (the row's StayForm reaches the server registry, which a node render cannot load) plus the pure
 * refusal sentence, which is run for real.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  PUBLISH_MISSING_WORDS,
  PUBLISH_REFUSAL_MESSAGE,
  PUBLISH_REQUIREMENTS,
  publishRefusalFor,
  unmetPublishRequirements,
} from '@/lib/service-publish-gate';

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, ...p), 'utf8'));
const MANAGER = read('_components', 'services-manager.tsx');
const ROW = read('_components', 'service-card-menu-row.tsx');
const MAKER = read('_components', 'canvas-maker.tsx');
const ACTIONS = read('actions.ts');

/** One service card's <li> in the list — from its `data-shop-card=""` to the card record below it. */
function cardItem(): string {
  const at = MANAGER.indexOf('data-shop-card=""');
  assert.ok(at > 0, 'the service card <li> was not found — re-anchor this guard');
  const end = MANAGER.indexOf('cardRecordByService.get(svc.vendor_service_id)', at);
  assert.ok(end > at, 'the card record under the card was not found — re-anchor this guard');
  return MANAGER.slice(at, end);
}

test('the card has no side switch, no side copy icon, and no "Edit · every field" row', () => {
  const li = cardItem();
  assert.doesNotMatch(li, /<SwitchTrack\b/, 'the side Online/Offline switch is back beside the card');
  assert.doesNotMatch(li, /role="switch"/, 'a switch is back beside the card');
  assert.doesNotMatch(li, /<Copy\b/, 'the side copy icon is back beside the card');
  assert.doesNotMatch(li, /\?from=\$\{svc\.vendor_service_id\}/, 'a "start a new card from this one" door is back on the list');
  assert.doesNotMatch(MANAGER, /Edit · every field/, 'the old "Edit · every field" row is back');
  assert.match(li, /<ServiceCardMenuRow\b/, 'the card lost its menu row');
});

test('the card face opens the Card Maker — the same door as Edit', () => {
  const li = cardItem();
  assert.match(li, /<ServiceCardView\b/, 'the list stopped drawing the couple’s own card');
  assert.match(li, /href=\{editHref\}[\s\S]{0,300}data-card-face-opens=""/, 'tapping the card face no longer opens the maker');
  assert.match(li, /editHref=\{editHref\}/, 'Edit and the card face point at different places');
  assert.match(MANAGER, /const editHref = `\/vendor-dashboard\/services\/\$\{svc\.vendor_service_id\}/, 'editHref is not the Card Maker');
});

test('the row is ONE EqualRow of exactly three ActionButtons: Edit · Share · Go online', () => {
  const open = ROW.indexOf('<EqualRow');
  const close = ROW.indexOf('</EqualRow>');
  assert.ok(open > 0 && close > open, 'the menu row is not an EqualRow');
  const inside = ROW.slice(open, close);
  // Nothing but ActionButtons in the row: no bare button, link, switch, tag or form.
  for (const bad of ['<button', '<Link', '<a ', '<SwitchTrack', '<StayForm', '<span', '<PlanHoldTag', '<InfoTip']) {
    assert.ok(!inside.includes(bad), `the menu row holds a ${bad} — every cell is an ActionButton`);
  }
  // Edit, Share, then ONE third cell: Go online/offline, or "On hold" for a card the plan holds.
  const buttons = inside.match(/<ActionButton\b/g) ?? [];
  assert.equal(buttons.length, 4, 'the row should be Edit · Share · (On hold | Go online) — two fixed cells and one ternary');
  assert.equal((inside.match(/\{held \? \(/g) ?? []).length, 1, 'the third cell is no longer one ternary — the row could draw four buttons');
  const edit = inside.indexOf('label="Edit"');
  const share = inside.indexOf('label="Share"');
  const online = inside.indexOf("label={isActive ? 'Go offline' : 'Go online'}");
  assert.ok(edit > 0 && share > edit && online > share, 'the row is not Edit · Share · Go online, in that order');
  assert.match(ROW, /import \{ ActionButton, EqualRow \} from '@\/components\/action-button';/);
});

test('Share uses the one share icon and the one share helper; Go online is the shipped toggle behind its door', () => {
  assert.match(ROW, /import \{[^}]*\bShare\b[^}]*\} from 'lucide-react';/, 'Share lost the lucide Share icon');
  assert.doesNotMatch(ROW, /\bShare2\b/, 'Share2 is not the share icon (T19)');
  assert.match(ROW, /shareShopLink\(/, 'Share stopped using lib/share-shop-link');
  assert.match(MANAGER, /sharePath=\{serviceCardAddress\(/, 'Share no longer shares the card’s own address');
  assert.match(MANAGER, /action=\{toggleVendorServiceActive\}/, 'Go online is no longer the shipped toggleVendorServiceActive');
  assert.match(ROW, /door="svServices\.toggleVendorServiceActive"/, 'Go online is not saved in place through its door');
});

test('Duplicate stays reachable inside the Card Maker', () => {
  assert.match(MAKER, /href=\{`\/vendor-dashboard\/services\/new\/\$\{category\}\?from=\$\{editing\.serviceId\}`\}/);
  assert.match(MAKER, /data-maker-copy=""/);
});

test('a refused Go online names EVERY unmet requirement at once', () => {
  // The bug the owner caught: a card missing its cover AND what's included was refused for the photo alone.
  const unmet = unmetPublishRequirements({ hasCover: false, hasPrice: true, hasInclusions: false });
  const two = publishRefusalFor(unmet)!;
  assert.ok(two.includes(PUBLISH_MISSING_WORDS.cover) && two.includes(PUBLISH_MISSING_WORDS.inclusions), two);
  assert.ok(!two.includes(PUBLISH_MISSING_WORDS.price), 'the refusal names a price the card already has');

  const all = publishRefusalFor([...PUBLISH_REQUIREMENTS])!;
  for (const r of PUBLISH_REQUIREMENTS) assert.ok(all.includes(PUBLISH_MISSING_WORDS[r]), `${r} is missing from: ${all}`);

  // One missing → that requirement's own sentence, byte for byte (it is also the database's sentence).
  for (const r of PUBLISH_REQUIREMENTS) assert.equal(publishRefusalFor([r]), PUBLISH_REFUSAL_MESSAGE[r]);
  assert.equal(publishRefusalFor([]), null);
});

test('toggleVendorServiceActive refuses with the whole list, never the first item', () => {
  const at = ACTIONS.indexOf('export async function toggleVendorServiceActive(');
  assert.ok(at > 0, 'toggleVendorServiceActive was not found');
  const body = ACTIONS.slice(at, ACTIONS.indexOf('\nexport ', at + 10));
  assert.match(body, /publishRefusalFor\(unmet\)/, 'the toggle no longer refuses with every unmet requirement');
  assert.doesNotMatch(body, /unmet\[0\]/, 'the toggle picks only the first unmet requirement again');
  assert.doesNotMatch(body, /PUBLISH_REFUSAL_MESSAGE\[/, 'the toggle hand-picks one sentence again');
});
