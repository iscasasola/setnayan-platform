/**
 * the-quote-is-one-screen.test.ts — the supplier's custom quote is ONE screen (simpler supplier dashboard step 4,
 * owner-approved 2026-10-14: prototype `supplier_easy_dashboard_2026-10-14_fable.html` `SCREENS.quote`), replacing
 * the five-step walk of 2026-09-22 (`the-quote-walks-five-steps.test.ts`, retired with `lib/quote-stages.ts`).
 *
 * 🔑 THE SAME CONTROLS, ALL ON VIEW. What this pins is what a five-step → one-screen change could drop or hide:
 *   · the sections, once each, in the prototype's order — Start from · What's in it · (From your catalogue) · The money;
 *   · nothing folded behind a step — no `hidden={!isCur}`, no step strip, no Next band;
 *   · ONE Send, last, after "As they see it";
 *   · "Start from" offers card · a saved quote (only when there is one) · blank, and blank fills NO discount;
 *   · a line is DROPPED (struck, left out of the total, put back with a tap), never deleted under the supplier;
 *   · the booking-fee line still sits under the total (`BookingFeeNotice disclosure={feeCopy}`), read live;
 *   · the catalogue is read when the quote first OPENS, once — never on the thread's own load;
 *   · "As they see it" is the couple's card's own lines component, the one the conversation draws.
 *
 * 🛡 Sabotages watched red: a section unmounted; a second <SubmitButton>; `hidden={!isCur}` back; blank start with a
 * discount; `removeLine` back in place of the drop; the catalogue read moved to the page load.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../lib/strip-comments';

const maker = stripComments(readFileSync(join(__dirname, 'proposal-maker.tsx'), 'utf8'));
const stream = stripComments(readFileSync(join(__dirname, 'chat-message-stream.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(__dirname, '..', 'vendor-dashboard', 'messages', '[threadId]', 'page.tsx'), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the scan read the builder', () => {
  assert.ok(maker.length > 30_000, `proposal-maker.tsx read as ${maker.length} chars`);
});

test('the sections, once each, in the prototype order', () => {
  const ids = [...maker.matchAll(/<QuoteSection id="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['start', 'lines', 'catalogue', 'money']);
  assert.equal(count(maker, /<\/QuoteSection>/g), 4);
});

test('nothing is folded behind a step — no step strip, no hidden body, no Next', () => {
  assert.doesNotMatch(maker, /hidden=\{!isCur\}/);
  assert.doesNotMatch(maker, /quote-step-strip/);
  assert.doesNotMatch(maker, /<QuoteStage\b/);
  assert.doesNotMatch(maker, /data-stage-next/);
});

test('ONE Send, last — after "As they see it"', () => {
  assert.equal(count(maker, /<SubmitButton\b/g), 1, 'the quote has more than one submit');
  const asThey = maker.indexOf('data-quote-as-they-see');
  const send = maker.indexOf('<SubmitButton');
  assert.ok(asThey > 0 && send > asThey, 'Send is not after "As they see it"');
  assert.ok(send > maker.indexOf('<QuoteSection id="money"'), 'Send is not after the money');
});

test('Start from: card · a saved quote (only when there is one) · blank — and blank fills no discount', () => {
  assert.match(maker, /\.\.\.cards\.map\(\(c\) => \(\{ key: `card:\$\{c\.id\}`/);
  assert.match(maker, /\.\.\.saved\.map\(\(t\) => \(\{ key: `tpl:\$\{t\.id\}`/, 'saved quotes are not offered from the list');
  assert.match(maker, /\{ key: 'blank', label: 'Blank' \}/);
  const blank = maker.slice(maker.indexOf('setItems([newLine(false)]);'), maker.indexOf('setReasonFromCard(false);', maker.indexOf('setItems([newLine(false)]);')));
  assert.match(blank, /setDiscountPhp\(0\)/, 'a blank start carries a discount over');
  assert.match(blank, /setDiscountReason\(null\)/);
  // The saved list starts from the page's own read, hidden when empty (no option is written for an empty list).
  assert.match(page, /savedQuotes=\{proposalTemplates\.map\(/);
});

test('a line is dropped, never deleted — and a dropped line costs nothing', () => {
  assert.doesNotMatch(maker, /removeLine/);
  assert.match(maker, /const toggleDrop = \(key: string\) =>\s*setItems\(\(prev\) => prev\.map\(\(l\) => \(l\.key === key \? \{ \.\.\.l, dropped: !l\.dropped \} : l\)\)\);/, 'a tap no longer toggles the line in place');
  assert.doesNotMatch(maker, /setItems\(\(prev\) => prev\.filter\(/, 'a line is removed from the list — the drop must keep it, struck');
  assert.match(maker, /if \(l\.free \|\| l\.dropped\) return 0;/);
  assert.match(maker, /items\.filter\(\(l\) => !l\.dropped\)/);
});

test('the booking fee is still named under the total, from the live schedule', () => {
  assert.equal(count(maker, /<BookingFeeNotice disclosure=\{feeCopy\} framed=\{false\} \/>/g), 1);
  assert.match(maker, /bookingFeeForecast\(feeStanding, netPayable \/ 100\)/);
});

test('the catalogue is read once, when the quote first opens — never on the thread load', () => {
  assert.equal(count(maker, /loadCatalogueExtrasForQuote\(\)/g), 1);
  const run = maker.slice(maker.indexOf('const run = () => {'), maker.indexOf('const onToggle'));
  assert.match(run, /loadCatalogueExtrasForQuote\(\)/, 'the catalogue read left the first-open handler');
  assert.match(run, /if \(firstOpenDone\.current\) return;/);
  assert.doesNotMatch(page, /loadCatalogueExtrasForQuote|vendor_package_items/, 'the thread page reads the catalogue on load');
});

test('"As they see it" is the couple card\'s own lines, shared with the conversation', () => {
  assert.equal(count(maker, /<QuoteCardLines items=\{lineItems\} \/>/g), 1);
  assert.equal(count(stream, /<QuoteCardLines items=\{items\} \/>/g), 1, 'the conversation no longer draws the shared lines');
  assert.match(maker, /quoteCardState\(\{ status: 'sent', isLatest: true, viewer: 'couple' \}\)/);
});

test('the lab seed is the lab\'s alone — the thread page never hands the builder one', () => {
  assert.doesNotMatch(page, /labSeed=/, 'the thread page passes a lab seed — a real quote would open on fixture lines');
});
