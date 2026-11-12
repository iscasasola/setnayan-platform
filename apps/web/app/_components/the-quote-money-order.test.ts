/**
 * 💸 THE QUOTE MAKER RUNS THE 12 NOV MONEY RULES — the wiring half (the rules themselves are executed in
 * lib/quote-money.test.ts and lib/quote-offer-door.test.ts; this file proves `proposal-maker.tsx` calls them and draws
 * them, not a second copy).
 *
 * Fails if: an offer is priced against every line instead of the lines of its own cards (no per-line `cardId` reaches
 * the door); the typed discount stops coming after the offer (in the total OR on the couple's lines); a guests stepper
 * comes back (pax follows their list, one "Bill at least"); Send is live without Valid until; Start from loses its
 * headings; the lines stop folding (one open + one expand-all icon on the pinned heading); the help captions come
 * back out from behind the ⓘ.
 *
 * SABOTAGE (each seen red, restored): `lines: [{ cardId: null, amountPhp: linesSum / 100 }]` · push the discount line
 * before the offer line · bring back `aria-label="Ten more guests"` · render `<SubmitButton` without the gate · drop
 * `startFromOptions(` for the old inline list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const maker = stripComments(readFileSync(path.join(__dirname, 'proposal-maker.tsx'), 'utf8'));
const section = (id: string) => {
  const at = maker.indexOf(`<QuoteSection\n        id="${id}"`) >= 0 ? maker.indexOf(`<QuoteSection\n        id="${id}"`) : maker.indexOf(`<QuoteSection id="${id}"`);
  assert.ok(at > 0, `section "${id}" is gone`);
  return maker.slice(at, maker.indexOf('</QuoteSection>', at));
};

test('🎯 the offer door is handed EVERY line with its own card — the anchor is the offer’s cards, never the whole quote', () => {
  assert.match(maker, /lines: resolved\.map\(\(\{ l, c \}\) => \(\{ cardId: l\.cardId \?\? null, amountPhp: c \/ 100 \}\)\)/);
  assert.doesNotMatch(maker, /anchorPhp: linesSum/, 'the offer is priced off what every line comes to again');
  assert.match(maker, /reachWords\(applied, cardName\)/, 'the offer’s line no longer says "on <card> only"');
});

test('💸 offer FIRST, then the typed discount — in the total and on the couple’s lines', () => {
  assert.match(maker, /const money = quoteMoney\(\{/, 'the total is no longer the one money order in lib/quote-money.ts');
  const offerAt = maker.indexOf('if (offerLine) li.push(offerLine);');
  const discountAt = maker.indexOf("{ label: 'Discount', detail: discountReason, amount_centavos: -money.discount }");
  assert.ok(offerAt > 0 && discountAt > 0, 'the offer line or the discount line is gone');
  assert.ok(offerAt < discountAt, 'the discount line comes before the offer line on their quote');
  const ids = [...maker.matchAll(/<QuoteSection(?:\s+)id="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(ids.indexOf('offer') >= 0 && ids.indexOf('offer') < ids.indexOf('discount') && ids.indexOf('discount') < ids.indexOf('sum'), `Your offer → Discount → What it comes to, saw ${ids.join(' · ')}`);
  const sum = section('sum');
  assert.ok(sum.indexOf('data-quote-sum-offer') < sum.indexOf('data-quote-sum-discount'), 'What it comes to lists the discount before the offer');
});

test('👥 pax follows their guest list: no guests stepper, ONE "Bill at least", billed = max of the two', () => {
  assert.match(maker, /const pax = billedPax\(seedPax, minPax\);/);
  assert.doesNotMatch(maker, /setPax\b/, 'the supplier can type the guest count again');
  assert.doesNotMatch(maker, /Ten (more|fewer) guests/, 'the guests stepper is back');
  assert.doesNotMatch(maker, /aria-label="Minimum pax"/, 'a per-line minimum is back');
  const guests = section('guests');
  assert.match(guests, /Bill at least/);
  assert.match(guests, /data-quote-billed-pax=""/);
  assert.match(maker, /pax: \{ live: seedPax, min: minPax, billed: pax \}/, 'the send no longer says what it billed');
});

test('📅 Send is the ONE submit and exists only once Valid until is set; early, it nudges the row', () => {
  assert.equal((maker.match(/<SubmitButton\b/g) ?? []).length, 1);
  assert.match(maker, /\{sendGate\(validUntil\)\.ready \? \(\s*<SubmitButton/, 'Send is live without Valid until');
  assert.match(maker, /onClick=\{nudgeValidUntil\}/);
  assert.match(maker, /data-quote-valid-required=/);
});

test('🗂 Start from is grouped by the one helper', () => {
  assert.match(maker, /const startOptions = startFromOptions\(\{/);
  assert.doesNotMatch(maker, /label: `(Bundle|Saved) · \$\{/, 'the old prefixes are back');
});

test('🪗 lines fold — one open, the first open, one expand-all icon on the pinned "Pick service cards" heading', () => {
  const cards = section('cards');
  assert.match(cards, /\bpin\b/, 'the heading no longer pins');
  assert.match(cards, /ChevronsDownUp[\s\S]*ChevronsUpDown/, 'the expand / fold icon left the heading');
  assert.match(cards, /onClick=\{\(\) => setFold\(toggleAll\)\}/);
  assert.match(maker, /const isOpen = lineIsOpen\(fold, l\.key, firstLineKey\);/);
  assert.match(maker, /setFold\(\(f\) => tapLine\(f, l\.key, firstLineKey\)\)/);
  assert.match(maker, /useOneOpen\(linesOpen,/, 'the lines left the ONE one-open set');
  assert.doesNotMatch(maker, /Open all lines|Fold all/, 'the two pills are back');
});

test('ⓘ the help captions sit behind the section’s info dot', () => {
  assert.match(maker, /<InfoTip label=\{title\}/);
  assert.doesNotMatch(maker, /swipe left to drop · ⠿ drag to reorder<\/span>/, 'the lines’ caption is back on the screen');
  assert.doesNotMatch(maker, /The first payment is what the couple pays to lock the date\. The final balance always\s*\n\s*settles/, 'the plan’s caption is back on the screen');
});
