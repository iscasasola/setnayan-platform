/**
 * 🚪🚪🚪 THE QUOTE MAKER'S THREE DOORS (owner 11 Nov 2026, asked "Should the quote get the Offer Maker line and 'Make a
 * new card'?" — *"YES. they can load a bundle also and edit from it."*; approved prototype
 * `controller-2026-11-11/client-supplier-page.html` frame 6).
 *
 * A source-reading guard on the wiring, anchored PER DOOR (the money rules themselves are executed in
 * lib/quote-offer-door.test.ts · lib/quote-from-bundle.test.ts · lib/quote-card-return.test.ts). Fails if:
 *   1 · APPLY AN OFFER stops being the Offer Maker's own pricing (`offersForQuote` / `appliedOfferNow`), stops coming
 *       off the total, stops being its own named line, is applied without a tap, or is HIDDEN when locked;
 *   2 · MAKE A NEW CARD stops opening the SHIPPED Card Maker route (a second card form is forbidden —
 *       services/one-card-maker.test.ts), the card save stops returning a new card to the quote, or the quote stops
 *       reading it back;
 *   3 · START FROM A BUNDLE stops being priced by the Bundle Maker's sums on the server behind its lock, or is HIDDEN
 *       when locked;
 *   and the thread page stops handing the doors in.
 * SABOTAGE (each seen red, restored): drop `offerC` from the gross · drop the `backToQuote` redirect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PM = read('app/_components/proposal-maker.tsx');
const ACTIONS = read('app/vendor-dashboard/messages/[threadId]/proposal-actions.ts');
const SERVICES = read('app/vendor-dashboard/services/actions.ts');
const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const NEW_PAGE = read('app/vendor-dashboard/services/new/page.tsx');
const THREAD = read('app/vendor-dashboard/messages/[threadId]/page.tsx');

test('1 · Apply an offer: the Offer Maker’s own pricing, off the total, its own line, one tap, lock shown', () => {
  assert.match(PM, /const fits = offerInput \? offersForQuote\(offerInput\) : \[\];/, 'the offers that fit are no longer the Offer Maker’s own answer');
  assert.match(PM, /appliedOfferNow\(appliedOfferId, offerInput\)/, 'the applied offer is no longer re-priced as the lines move');
  // 🎯 12 Nov (owner): an offer comes off ITS OWN cards' lines only — each line is handed over with its card.
  assert.match(PM, /lines: resolved\.map\(\(\{ l, c \}\) => \(\{ cardId: l\.cardId \?\? null, amountPhp: c \/ 100 \}\)\)/, 'the offer no longer comes off the lines of its own cards');
  // 💸 12 Nov (owner): offer first, then the typed discount — the one money order (lib/quote-money.ts).
  assert.match(PM, /offerCentavos: offerC,/, 'the applied offer no longer comes off the total');
  assert.match(PM, /const offerLine = applied && money\.offer > 0 \? offerLineItem\(/, 'the applied offer is no longer its own named line on their quote');
  assert.match(PM, /if \(offerLine\) li\.push\(offerLine\);/);
  assert.match(PM, /onPick=\{\(id\) => applyOffer\(id\)\}/, 'an offer is no longer applied by the supplier’s pick');
  assert.doesNotMatch(PM, /setAppliedOfferId\(\s*(fits|offerFits)\[/, 'an offer is applied automatically — the prototype says never');
  const door = PM.slice(PM.indexOf('data-quote-offer-door="locked"') - 200, PM.indexOf('data-quote-offer-door="locked"') + 400);
  assert.match(door, /<LockedFeature\s+lock="offerMaker"/, 'a locked Offer Maker is no longer SHOWN with the shared lock');
  assert.match(PM, /alreadyInDiscount: cardOfferId/, 'the offer already in the card discount could be applied a second time');
});

test('2 · Make a new card: the shipped Card Maker, and back into the quote', () => {
  assert.match(PM, /key: NEW_CARD_KEY, label: '＋ Make a new card'/, '“＋ Make a new card” is no longer in the cards picker');
  assert.match(PM, /window\.location\.assign\(cardMakerFromQuote\(/, 'the door no longer opens the shipped Card Maker route');
  assert.doesNotMatch(PM, /commitVendorService/, 'the quote grew its own card form — fix the shipped maker instead');
  assert.match(PM, /window\.sessionStorage\.setItem\(\s*quoteDraftKey\(threadId\)/, 'the quote so far is no longer kept while the supplier is in the Card Maker');
  assert.match(PM, /get\(QUOTE_CARD_PARAM\);\s*if \(newCard\) \{\s*returnWithNewCard\(newCard\);/, 'the quote no longer reads the new card back on its first open');
  assert.match(PM, /loadServiceCardLinesForQuote\(\{ threadId, vendorServiceIds: \[cardId\]/, 'the new card is no longer added through the shipped card seed');
  assert.match(MAKER, /name="quote_return" value=\{quoteReturn\}/, 'the Card Maker no longer carries the way back');
  assert.match(read('lib/quote-card-return.ts'), /QUOTE_RETURN_FIELD = 'quote_return'/, 'the maker’s field and the save’s field drifted apart');
  assert.match(NEW_PAGE, /const quoteReturn = quoteReturnPath\(quote\);/, 'the new-card page no longer checks the way back');
  assert.match(SERVICES, /const quoteReturn = quoteReturnPath\(formData\.get\(QUOTE_RETURN_FIELD\)\);/, 'the card save no longer checks the way back');
  assert.match(SERVICES, /if \(backToQuote\) redirect\(backToQuote\);/, 'a new card made from a quote no longer returns into it');
});

test('3 · Start from a bundle: the Bundle Maker’s sums on the server, behind its lock; lock shown', () => {
  // 🗂 12 Nov: Start from is built by `startFromOptions`, under a BUNDLES heading (lib/quote-money.ts).
  assert.match(PM, /startFromOptions\(\{[^}]*bundles: bundleOptions/, 'bundles are no longer in Start from');
  assert.match(read('lib/quote-money.ts'), /key: `bundle:\$\{b\.id\}`/, 'bundles are no longer in Start from');
  assert.match(PM, /loadPackageLinesForQuote\(id\)/, 'a bundle is no longer loaded through the shipped package loader');
  const loader = ACTIONS.slice(ACTIONS.indexOf('export async function loadPackageLinesForQuote'), ACTIONS.indexOf('export type QuoteCatalogueExtra'));
  assert.match(loader, /canUse\('bundleMaker', shop\)\.ok/, 'a bundle loads into a quote without the Bundle Maker’s lock');
  assert.match(loader, /readBundleCards\(supabase, profile\.vendor_profile_id\)/, 'the bundle is no longer priced from the cards read honestly');
  assert.match(loader, /quoteSeedFromBundle\(/, 'the bundle is no longer priced by the Bundle Maker’s sums');
  const door = PM.slice(PM.indexOf('data-quote-bundle-door="locked"') - 200, PM.indexOf('data-quote-bundle-door="locked"') + 400);
  assert.match(door, /<LockedFeature\s+lock="bundleMaker"/, 'a locked Bundle Maker is no longer SHOWN with the shared lock');
});

test('the thread page hands the doors in, read with the thread', () => {
  assert.match(THREAD, /readQuoteDoors\(supabase, profile\.vendor_profile_id\)/, 'the thread no longer reads the quote’s doors');
  assert.match(THREAD, /doors=\{quoteDoors\}/, 'the quote maker is no longer handed its doors');
});
