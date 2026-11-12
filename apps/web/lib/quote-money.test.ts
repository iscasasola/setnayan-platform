/**
 * 💸 THE QUOTE MAKER'S MONEY ORDER (owner 12 Nov 2026, DECISION_LOG "Three quote rulings" + the pax rows + "START
 * FROM GROUPS ITS CHOICES UNDER HEADINGS" + "ONE OPEN AT A TIME + ONE EXPAND-ALL ICON").
 *
 * Fails if: the typed discount stops coming off AFTER the offer; billed pax stops being max(their list, the minimum);
 * Send stops waiting for Valid until; Start from loses its headings (or grows the old prefixes back); the lines stop
 * opening one at a time from the first.
 *
 * The figures are fixtures, not prices.
 * SABOTAGE (each seen red, restored): `discount` off the subtotal instead of `afterOffer` · `billedPax` returns the
 * live count alone · `sendGate` ready on '' · `startFromOptions` drops `group` · `tapLine` leaves the old line open.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_OPEN,
  START_GROUPS,
  billedPax,
  lineIsOpen,
  presetClash,
  quoteMoney,
  seedMinPax,
  sendGate,
  startFromOptions,
  tapLine,
  toggleAll,
} from './quote-money';

test('💸 offer FIRST, then the typed discount — Subtotal − offer − Discount = Total (owner: "offer first then typed discount")', () => {
  const m = quoteMoney({ linesCentavos: 10_000_00, chargesCentavos: 0, offerCentavos: 1_000_00, discountCentavos: 9_500_00, creditCentavos: 0 });
  assert.equal(m.subtotal, 10_000_00);
  assert.equal(m.offer, 1_000_00);
  assert.equal(m.afterOffer, 9_000_00);
  assert.equal(m.discount, 9_000_00, 'the discount comes off what is LEFT after the offer — never the subtotal');
  assert.equal(m.total, 0);
  const n = quoteMoney({ linesCentavos: 50_000_00, chargesCentavos: 2_000_00, offerCentavos: 2_500_00, discountCentavos: 1_000_00, creditCentavos: 700_00 });
  assert.deepEqual(n, { subtotal: 52_000_00, offer: 2_500_00, afterOffer: 49_500_00, discount: 1_000_00, total: 48_500_00, net: 47_800_00 });
});

test('the offer never takes more than the subtotal; nothing goes below ₱0', () => {
  const m = quoteMoney({ linesCentavos: 5_000_00, chargesCentavos: 0, offerCentavos: 9_000_00, discountCentavos: 1_00, creditCentavos: 99_00 });
  assert.deepEqual([m.offer, m.discount, m.total, m.net], [5_000_00, 0, 0, 0]);
});

test('👥 billed = max(their guest list, your ONE minimum) — it only goes up as their guests go up', () => {
  assert.equal(billedPax(150, 100), 150, 'their list above the minimum bills the list');
  assert.equal(billedPax(80, 100), 100, 'their list under the minimum bills the minimum');
  assert.equal(billedPax(120, 0), 120);
  assert.equal(billedPax(Number.NaN, 100), 100);
  for (let live = 0; live < 300; live += 37) assert.ok(billedPax(live + 10, 100) >= billedPax(live, 100), 'more guests never bill fewer');
});

test('a seed brings ONE minimum: the highest per-guest minimum among its per-pax lines', () => {
  assert.equal(seedMinPax([{ basis: 'per_pax', minPax: 100 }, { basis: 'per_pax', minPax: 150 }, { basis: 'flat', minPax: 900 }]), 150);
  assert.equal(seedMinPax([{ basis: 'flat', minPax: 100 }]), null);
});

test('📅 Send stays dim without Valid until — and says it is required', () => {
  assert.deepEqual(sendGate(''), { ready: false, caption: 'Required to send' });
  assert.equal(sendGate('  ').ready, false);
  assert.equal(sendGate('soon').ready, false);
  assert.equal(sendGate('2026-12-01').ready, true);
});

test('🗂 Start from: Updating first · SERVICE CARDS · BUNDLES · SAVED QUOTES · Blank last, no prefixes', () => {
  const opts = startFromOptions({
    revisionTitle: 'Garden wedding',
    cards: [
      { id: 'a', label: 'Garden buffet' },
      { id: 'b', label: 'Cocktail hour' },
    ],
    bundles: [{ id: 'p', name: 'Garden reception pair' }],
    saved: [{ id: 't', name: 'Garden wedding 150' }],
  });
  assert.deepEqual(
    opts.map((o) => [o.key, o.label, o.group ?? null]),
    [
      ['revision', 'Updating “Garden wedding”', null],
      ['card:a', 'Garden buffet', START_GROUPS.cards],
      ['card:b', 'Cocktail hour', START_GROUPS.cards],
      ['bundle:p', 'Garden reception pair', START_GROUPS.bundles],
      ['tpl:t', 'Garden wedding 150', START_GROUPS.saved],
      ['blank', 'Blank', null],
    ],
  );
  assert.ok(!opts.some((o) => /^(Bundle|Saved) · /.test(o.label)), 'the old prefixes are back');
  assert.deepEqual(startFromOptions({ revisionTitle: null, cards: [], bundles: [], saved: [] }), [{ key: 'blank', label: 'Blank' }]);
});

test('🪗 lines: the first opens; a tap opens one and folds the other; the icon opens all and folds all', () => {
  let f = FIRST_OPEN;
  assert.equal(lineIsOpen(f, 'a', 'a'), true);
  assert.equal(lineIsOpen(f, 'b', 'a'), false);
  f = tapLine(f, 'b', 'a');
  assert.deepEqual([lineIsOpen(f, 'a', 'a'), lineIsOpen(f, 'b', 'a')], [false, true], 'one open at a time');
  f = tapLine(f, 'b', 'a');
  assert.deepEqual([lineIsOpen(f, 'a', 'a'), lineIsOpen(f, 'b', 'a')], [false, false], 'a tap on the open line folds it');
  f = toggleAll(f);
  assert.deepEqual([lineIsOpen(f, 'a', 'a'), lineIsOpen(f, 'b', 'a')], [true, true]);
  f = toggleAll(f);
  assert.deepEqual([lineIsOpen(f, 'a', 'a'), lineIsOpen(f, 'b', 'a')], [false, false]);
  assert.deepEqual(tapLine({ mode: 'all' }, 'a', 'a'), { mode: 'one', key: 'a' }, 'from all-open, a tap leaves only that line open');
});

test('a plan preset clashes with an offer’s own first payment, with the offer’s words as the reason', () => {
  assert.equal(presetClash(null), null);
  assert.equal(presetClash({ words: '₱5,000 to reserve' }), 'Your offer sets ₱5,000 to reserve');
  assert.equal(presetClash({ words: 'First payment 10%' }), 'Your offer sets 10%');
});
