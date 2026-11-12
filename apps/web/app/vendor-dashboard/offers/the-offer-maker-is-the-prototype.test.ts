/**
 * 🔒 THE OFFER MAKER IS THE APPROVED PROTOTYPE, AND THE ONLY WAY TO MAKE AN OFFER (Build 6 · Lane D).
 *
 * Prototype: Setnayan-specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/discount-maker.html` (artifact
 * 1fdSN1HRkYWm1nfbpYRteh). Rulings: DECISION_LOG 2026-11-09 → 11 (the Offer Maker · mix them all · own gifts ·
 * stocked gifts · a card carries many offers, the best shows · "all yes" · the off-season offer IS the Offer Maker).
 * The money rules themselves are held by lib/offers.test.ts; this file holds the SCREEN and the doors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const LIST = read('app/vendor-dashboard/offers/_components/offer-maker.tsx');
const EDITOR = read('app/vendor-dashboard/offers/_components/offer-editor.tsx');
const MAKERS = read('app/vendor-dashboard/shop/_components/shop-makers.tsx');
const ACTIONS = read('app/vendor-dashboard/offers/actions.ts');

test('it rises full screen through the shared RiseScreen (the bars step away) and is its own chunk', () => {
  assert.match(LIST, /<RiseScreen\b[\s\S]*?title="Offers"/, 'Shop › Offers is not the shared full screen');
  assert.match(MAKERS, /lazy\(\(\) => import\('\.\.\/\.\.\/offers\/_components\/offer-maker'\)/, 'the Offer Maker rides the Shop tab’s first load');
  assert.match(MAKERS, /k: 'offers' as const, title: 'Offer Maker'/, 'no Offer Maker tile in Makers');
});

test('🔒 the shared lock: an unverified shop sees the tile with its lock, and a tap shows Problem → Solution', () => {
  assert.match(MAKERS, /<LockExplainer lock="offerMaker" need=\{\{ kind: 'verify'/, 'the Offer Maker lock is not the shared one');
  assert.match(MAKERS, /t\.k === 'offers' && offers && !offers\.verified \? setLockOpen\(true\)/, 'an unverified shop opens the maker');
  assert.match(ACTIONS, /canUse\('offerMaker'/, 'the server does not ask the lock');
});

test('the editor asks the five questions, in the prototype’s order', () => {
  const order = ['label="Name"', 'label="Which cards?"', 'label="What do they get?"', 'label="Who gets it?"', 'label="How long does it run?"'];
  let at = 0;
  for (const q of order) {
    const i = EDITOR.indexOf(`<Q n={${order.indexOf(q) + 1}} ${q}`);
    assert.ok(i > at, `${q} is missing or out of order`);
    at = i;
  }
  for (const part of ["k=\"pct\"", "k=\"php\"", "k=\"down\"", "k=\"gift\""]) assert.match(EDITOR, new RegExp(`<Part ${part}`), `${part} is not a part of 3`);
});

test('every set of choices is a dropdown; two-way choices are a segmented control; no <select>', () => {
  assert.doesNotMatch(LIST + EDITOR, /<select\b/, 'a native select in place of the one dropdown');
  for (const d of ['data-offer-cards', 'data-offer-who', 'data-offer-gift-mode', 'data-offer-gift-add', 'data-offer-new', 'data-offers-filter']) {
    assert.match(LIST + EDITOR, new RegExp(`dataAttr="${d}"`), `${d} is not a PickMenu`);
  }
});

test('Enter is Done in the editor’s text boxes; the pinned preview slims while typing', () => {
  assert.match(EDITOR, /if \(e\.key === 'Enter' && !e\.shiftKey\) \{\s*e\.preventDefault\(\);\s*void done\(\);/, 'Enter does not finish the offer');
  assert.match(EDITOR, /onKeyDown=\{enterIsDone\}/);
  assert.match(EDITOR, /data-offer-preview=\{open \? 'open' : slim \? 'slim' : 'closed'\}/, 'the compact preview lost its three states');
});

test('dates come from the shared date sheet — How long, and the season (the off-season offer)', () => {
  assert.match(EDITOR, /<LazyDateSheet\b/, 'a date is typed instead of picked from the one date sheet');
  assert.doesNotMatch(EDITOR, /type="date"/, 'a native date input in place of the shared sheet');
  assert.match(EDITOR, /seasonFrom: who === 'season' \? \(d\.seasonFrom \?\? data\.season\?\.from \?\? null\)/, 'the season does not start from the slow months');
});

test('⛔ the off-season nudge and its ?offpeak=1 seed are gone — the Offer Maker is the only way (DECISION_LOG 2026-11-11)', () => {
  const sm = read('app/vendor-dashboard/services/_components/services-manager.tsx');
  assert.doesNotMatch(sm, /Set up off-season offer|launch an off-season offer|search\.offpeak|offPeakPrefillId/, 'the off-season nudge is back on Shop › Services');
  assert.doesNotMatch(read('app/vendor-dashboard/services/[serviceId]/page.tsx'), /offpeak/, 'the card editor still seeds an off_peak row');
  assert.doesNotMatch(read('app/vendor-dashboard/services/_components/service-list-editors.tsx'), /seedOffPeak/, 'the per-card off-peak seed is back');
  for (const p of ['lib/vendor-growth-recs.ts', 'app/vendor-dashboard/services/_components/canvas-maker.tsx']) {
    assert.doesNotMatch(read(p), /\?offpeak=1|discountSeed/, `${p} still opens the retired off-season seed`);
  }
  assert.match(read('lib/vendor-growth-recs.ts'), /\/vendor-dashboard\/shop\?maker=offers&new=season/, '"Run an offer for [month]" does not open the Offer Maker');
});

test('couples see the single best of the cards’ rows AND the shop’s offers, decided in ONE function', () => {
  assert.match(read('lib/offers.server.ts'), /fetchDiscountsByServicePublic\(client, serviceIds\), fetchOfferCandidatesByService\(client, serviceIds\)/);
  for (const p of ['app/v/[slug]/page.tsx', 'app/(shell)/explore/_lib/marketplace-view.tsx']) assert.match(read(p), /fetchDiscountsWithOffers\(admin,/, `${p} reads discounts without the offers`);
  assert.match(read('app/vendor-dashboard/messages/[threadId]/proposal-actions.ts'), /withOfferCandidates\(rows, offers\)/, 'the quote seed ignores the offers');
  assert.match(LIST, /return pickBestDiscount\(\[\.\.\.\(card\.discounts \?\? \[\]\), \.\.\.offerCandidatesFor\(offers, card\.id, today\)\]/, 'the maker decides "wins here" with a second opinion');
});

test('a refused read says so — never "No offers yet"', () => {
  assert.match(LIST, /offers === null \? \(\s*<p role="alert"/, 'an unread list falls through to the empty state');
  assert.match(read('lib/offers.server.ts'), /if \(error\) \{\s*console\.error\('\[supabase-error\] lib\/offers\.server\.ts · from:vendor_offers\.select', error\);\s*return null;/);
});

test('⏳ the two open owner calls are written down, not built', () => {
  assert.match(read('lib/offers.ts'), /TODO\(owner\): spreading expected bookings/);
  assert.match(EDITOR, /TODO\(owner\): spreading expected bookings/);
  assert.match(LIST, /TODO\(owner, Bundle Maker\): "Send to this couple" truncates at 320/);
  assert.ok(existsSync(join(WEB, 'lib/offers.test.ts')), 'the settled money rules lost their guard');
});
