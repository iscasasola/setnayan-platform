/**
 * THE NUMBER A SUPPLIER AGREES TO IS THE NUMBER THEY ARE BILLED.
 *
 * ── WHAT THIS EXISTS TO PREVENT ─────────────────────────────────────────────
 * The composer now shows the gift WHILE the supplier is still choosing a price
 * (owner 2026-09-15: "show both" — the photographs the couple gets AND the
 * peso charge the supplier pays). That preview runs in the BROWSER, because
 * re-asking the server on every keystroke would make the number lag the field
 * describing it.
 *
 * 🔑 SO THERE ARE NOW TWO PLACES THAT COMPUTE ONE FACT, AND THAT IS THE WHOLE
 * RISK. If the composer ever grows its own estimate — a rounded rate, a cached
 * ladder, "close enough for a preview" — a supplier agrees to one figure and is
 * invoiced another. Nothing on screen would reveal it: both numbers look
 * perfectly reasonable on their own. This repo has already paid for that shape
 * twice in two days (the Ninong seating tier, the Papic share weight), and in
 * BOTH cases the two mechanisms agreed with each other while both were wrong.
 *
 * ⚠ SO THIS TEST DOES NOT COMPARE THE COMPOSER TO ITSELF. It walks the money
 * and asserts the preview equals what `bookingFeePhp` → `setnayanGiftForFee`
 * produce — the pair the server's `quoteSetnayanGift` runs and the pair the SQL
 * mirror prices the real bill from.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { bookingFeePhp, BOOKING_FEE } from './booking-fee';
import {
  previewGiftForTotal,
  setnayanGiftForFee,
  giftQuoteCopy,
  type GiftQuoteBasis,
  type GiftRung,
} from './setnayan-gift';

/** A ladder shaped like the live one: rising credits at rising prices. */
const LADDER: GiftRung[] = [
  { credits: 100, priceCentavos: 7_000 },
  { credits: 500, priceCentavos: 30_000 },
  { credits: 2_000, priceCentavos: 100_000 },
  { credits: 10_000, priceCentavos: 400_000 },
  { credits: 50_000, priceCentavos: 1_500_000 },
];

const BASIS: GiftQuoteBasis = { schedule: BOOKING_FEE, ladder: LADDER };

/** Totals in centavos, spanning the fee floor, the tier-1 band and the taper. */
const TOTALS = [
  350_000, // ₱3,500 — the documented smallest gift-bearing booking
  1_000_000, // ₱10,000
  2_000_000, // ₱20,000
  5_000_000, // ₱50,000
  10_000_000, // ₱100,000 — exactly the tier-1 limit
  25_000_000, // ₱250,000 — into the taper
  100_000_000, // ₱1,000,000 — well past the cap
];

test('🚨 the composer preview equals the bill, across the whole fee curve', () => {
  for (const total of TOTALS) {
    const preview = previewGiftForTotal(total, BASIS);

    // The independent path: the fee, then the gift — the same two functions the
    // server and the SQL use, called here directly rather than through the
    // preview under test.
    const feeCentavos = Math.round(bookingFeePhp(total / 100, BOOKING_FEE) * 100);
    const expected = setnayanGiftForFee(feeCentavos, LADDER);

    if (expected.credits <= 0) {
      assert.equal(preview, null, `₱${total / 100}: no gift ⇒ the composer must say NOTHING`);
      continue;
    }
    assert.ok(preview, `₱${total / 100}: the bill carries a gift but the composer showed none`);
    assert.equal(
      preview.credits,
      expected.credits,
      `₱${total / 100}: composer promised ${preview.credits} photos, the bill grants ${expected.credits}`,
    );
    assert.equal(
      preview.chargeCentavos,
      expected.chargeCentavos,
      `₱${total / 100}: composer quoted ${preview.chargeCentavos} centavos, the bill charges ${expected.chargeCentavos}`,
    );
  }
});

test('the cap binds identically in both — a capped gift cannot carry an uncapped bill', () => {
  // Owner 2026-09-09: "max up to the 50000 papic credits. only." Above the cap
  // the supplier pays the cap rung's price, not 40% of an ever-growing fee.
  const huge = previewGiftForTotal(500_000_000, BASIS); // ₱5,000,000
  assert.ok(huge);
  assert.equal(huge.credits, 50_000, 'the preview must stop at the 50,000-credit rung');
  assert.equal(
    huge.chargeCentavos,
    1_500_000,
    'and the charge must stop at that rung’s price — an uncapped bill on a capped gift',
  );
});

test('no basis, no amount, no gift ⇒ silence, never a zero', () => {
  // ⛔ Every doubt answers NOTHING. "0 free photos" advertises an absence, and a
  // count promised on a booking that will never be billed for it is the silent
  // broken promise the owner warned about (DECISION_LOG 2026-09-09).
  assert.equal(previewGiftForTotal(5_000_000, null), null, 'not eligible ⇒ say nothing');
  assert.equal(previewGiftForTotal(0, BASIS), null, 'no price typed yet ⇒ say nothing');
  assert.equal(previewGiftForTotal(-1, BASIS), null);
  assert.equal(previewGiftForTotal(Number.NaN, BASIS), null);
  assert.equal(previewGiftForTotal(5_000_000, { schedule: BOOKING_FEE, ladder: [] }), null);
});

test('the composer renders the SUPPLIER voice — both halves of "show both"', () => {
  const gift = previewGiftForTotal(5_000_000, BASIS); // ₱50,000 booking
  assert.ok(gift);
  const copy = giftQuoteCopy(gift, 'supplier');
  assert.ok(copy);
  // What the couple gets…
  assert.match(copy.headline, /your couple gets [\d,]+ free Papic photos/);
  // …and what it costs them. Before 2026-09-15 only the first half existed at
  // compose time, which sold a supplier the upside and hid the bill.
  assert.match(copy.detail, /Added to your booking fee bill: ₱[\d,]/);
});
