/**
 * canvas-form-snapshot — "the card moves while you type".
 *
 * THE DEFECT THIS SUITE EXISTS TO PREVENT (owner, 2026-07-28): in the design
 * prototype the price sheet's inputs had no bindings, so typing a price never
 * reached the card — and the owner read that as *"I cannot save the price."* On
 * a zero-step maker there is no step to advance to and no per-region save
 * button, so a value that only appears after submit makes the whole surface
 * feel broken.
 *
 * Every test below therefore does the same thing: put a value into a FormData
 * exactly as typing would, read the card, and assert the card says it — with NO
 * form submission anywhere in the file. That is the property, stated as a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_CANVAS_SNAPSHOT,
  canvasSnapshotKey,
  cardPriceLine,
  readCanvasFormSnapshot,
} from './canvas-form-snapshot';

/** A form mid-edit. Keys are the SHIPPED field names, nothing invented. */
function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) for (const one of v) fd.append(k, one);
    else fd.append(k, v);
  }
  return fd;
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · Live edit — the card reflects the keystroke, not a submit
// ════════════════════════════════════════════════════════════════════════════

test('typing a base price shows it on the card immediately — no submit involved', () => {
  // Before the vendor types: no price on the card.
  const blank = readCanvasFormSnapshot(form({ pricing_basis: 'fixed' }));
  assert.equal(blank.hasPrice, false);
  assert.equal(blank.priceLine, '');

  // The exact keystroke: "80000" into starting_price_php.
  const typed = readCanvasFormSnapshot(
    form({ pricing_basis: 'fixed', starting_price_php: '80000' }),
  );
  assert.equal(typed.hasPrice, true);
  assert.equal(typed.priceLine, '₱80,000 flat');
});

test('each per-hour field lands on the card as it is typed', () => {
  const base = form({ pricing_basis: 'per_hour', hour_base_php: '25000' });
  assert.equal(cardPriceLine(base).priceLine, '₱25,000');

  const withHours = form({
    pricing_basis: 'per_hour',
    hour_base_php: '25000',
    min_hours: '4',
  });
  assert.equal(cardPriceLine(withHours).priceLine, '₱25,000 · first 4 hrs');

  const withExtra = form({
    pricing_basis: 'per_hour',
    hour_base_php: '25000',
    min_hours: '4',
    extra_hour_php: '6000',
  });
  assert.equal(cardPriceLine(withExtra).priceLine, '₱25,000 · first 4 hrs, +₱6,000/hr');
});

test('each per-pax field lands on the card as it is typed', () => {
  const rateOnly = form({ pricing_basis: 'per_pax', per_pax_price_php: '1200' });
  assert.equal(cardPriceLine(rateOnly).priceLine, '₱1,200 per head');

  const withFloor = form({
    pricing_basis: 'per_pax',
    per_pax_price_php: '1200',
    min_pax: '50',
  });
  assert.equal(cardPriceLine(withFloor).priceLine, '₱1,200 per head · min 50 pax');
});

test('switching the basis re-speaks the card in the new basis', () => {
  const fields = {
    starting_price_php: '80000',
    hour_base_php: '25000',
    min_hours: '4',
    extra_hour_php: '6000',
    per_pax_price_php: '1200',
    min_pax: '50',
  };
  assert.equal(cardPriceLine(form({ ...fields, pricing_basis: 'fixed' })).priceLine, '₱80,000 flat');
  assert.equal(
    cardPriceLine(form({ ...fields, pricing_basis: 'per_hour' })).priceLine,
    '₱25,000 · first 4 hrs, +₱6,000/hr',
  );
  assert.equal(
    cardPriceLine(form({ ...fields, pricing_basis: 'per_pax' })).priceLine,
    '₱1,200 per head · min 50 pax',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · Basis semantics (owner-locked 2026-07-27, clarified 2026-07-28)
// ════════════════════════════════════════════════════════════════════════════

test('PER HOUR — the base covers a first block, then bills each extra hour', () => {
  const line = cardPriceLine(
    form({
      pricing_basis: 'per_hour',
      hour_base_php: '25000',
      min_hours: '4',
      extra_hour_php: '6000',
    }),
  ).priceLine;
  assert.equal(line, '₱25,000 · first 4 hrs, +₱6,000/hr');
  // The card states the RULE the estimate applies: a 6-hour booking is
  // 25,000 + max(0, 6 − 4) × 6,000 = 37,000.
  assert.equal(25000 + Math.max(0, 6 - 4) * 6000, 37000);
  // A booking inside the block costs the base — never less.
  assert.equal(25000 + Math.max(0, 3 - 4) * 6000, 25000);
});

test('PER HOUR — a one-hour block reads "hr", not "hrs"', () => {
  assert.equal(
    cardPriceLine(form({ pricing_basis: 'per_hour', hour_base_php: '9000', min_hours: '1' }))
      .priceLine,
    '₱9,000 · first 1 hr',
  );
});

test('PER PAX — min_pax is a billing FLOOR, so the anchor is rate × minimum', () => {
  const line = cardPriceLine(
    form({ pricing_basis: 'per_pax', per_pax_price_php: '1200', min_pax: '200' }),
  ).priceLine;
  assert.equal(line, '₱1,200 per head · min 200 pax');
  // 140 guests against a 200 floor still bills 200 heads.
  assert.equal(Math.max(140, 200) * 1200, 240000);
  // Above the floor, the real headcount bills.
  assert.equal(Math.max(260, 200) * 1200, 312000);
});

test('FIXED — flat regardless of hours and pax; brackets still win the anchor', () => {
  assert.equal(
    cardPriceLine(form({ pricing_basis: 'fixed', starting_price_php: '80000' })).priceLine,
    '₱80,000 flat',
  );
  // One open bracket = a single flat price.
  assert.equal(
    cardPriceLine(
      form({ pricing_basis: 'fixed', starting_price_php: '80000', bracket_price: ['65000'] }),
    ).priceLine,
    'from ₱65,000 flat',
  );
  // Several bands = priced by guest count, anchored at the cheapest.
  assert.equal(
    cardPriceLine(
      form({ pricing_basis: 'fixed', bracket_price: ['95000', '65000', '120000'] }),
    ).priceLine,
    'from ₱65,000 · by guest count',
  );
});

test('a crew-meals card speaks in meals, not guests', () => {
  assert.equal(
    cardPriceLine(
      form({
        category: 'crew_meals',
        pricing_basis: 'per_pax',
        per_pax_price_php: '150',
        min_pax: '15',
      }),
    ).priceLine,
    '₱150 per meal · min 15 meals',
  );
});

test('no price at all is legal and says so — the listing is a menu', () => {
  for (const basis of ['fixed', 'per_pax', 'per_hour']) {
    const s = cardPriceLine(form({ pricing_basis: basis }));
    assert.equal(s.hasPrice, false, `${basis} with no figure must not claim a price`);
    assert.equal(s.priceLine, '');
  }
});

test('junk in a price field never renders a broken card', () => {
  const s = cardPriceLine(form({ pricing_basis: 'fixed', starting_price_php: '   ' }));
  assert.equal(s.hasPrice, false);
  // Pasted currency formatting still reads as the number.
  assert.equal(
    cardPriceLine(form({ pricing_basis: 'fixed', starting_price_php: '₱80,000' })).priceLine,
    '₱80,000 flat',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · The rest of the card face
// ════════════════════════════════════════════════════════════════════════════

test('the media, inclusion, customization and bundle reads all come off the live form', () => {
  const s = readCanvasFormSnapshot(
    form({
      primary_photo_r2_key: 'vendors/v1/services/cover.webp',
      showcase_photo_r2_keys: ['a.webp', 'b.webp', '   ', 'c.webp'],
      showcase_video_r2_key: 'clip.mp4',
      inclusion_label: ['Same-day highlight reel', '  ', 'Free engagement shoot'],
      customization_draft: '{"v":1,"items":[]}',
      linked: ['photography', 'lights_and_sounds'],
    }),
  );
  assert.equal(s.hasCover, true);
  assert.equal(s.photoCount, 3, 'a blank ref is not a photo');
  assert.equal(s.hasClip, true);
  assert.deepEqual(s.inclusionLabels, ['Same-day highlight reel', 'Free engagement shoot']);
  assert.equal(s.customizationRaw, '{"v":1,"items":[]}');
  assert.equal(s.linkedCount, 2);
});

test('an empty form reads exactly as the empty snapshot', () => {
  assert.deepEqual(readCanvasFormSnapshot(new FormData()), EMPTY_CANVAS_SNAPSHOT);
});

test('discount conditions are read for the card-text gate — INDEX-PRESERVING', () => {
  const s = readCanvasFormSnapshot(
    form({
      discount_conditions_md: ['', 'Book ≥ 6 months ahead', '  '],
      discount_type: ['promo', 'early_booking', 'off_peak'],
    }),
  );
  // A blank row is KEPT, unlike inclusion labels: the save gate reports
  // `Discount N conditions` by index, and dropping blanks here would tell the
  // vendor to fix a row number that is not the one on screen.
  assert.deepEqual(s.discountConditions, ['', 'Book ≥ 6 months ahead', '  ']);
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · The no-op bail (why typing never re-renders the editor being typed into)
// ════════════════════════════════════════════════════════════════════════════

test('an unchanged poll produces an identical key — so it re-renders nothing', () => {
  const fields = { pricing_basis: 'fixed', starting_price_php: '80000' };
  assert.equal(
    canvasSnapshotKey(readCanvasFormSnapshot(form(fields))),
    canvasSnapshotKey(readCanvasFormSnapshot(form(fields))),
  );
});

test('the key separates list entries — a re-split of the same text is a real change', () => {
  const a = readCanvasFormSnapshot(form({ inclusion_label: ['ab', 'c'] }));
  const b = readCanvasFormSnapshot(form({ inclusion_label: ['a', 'bc'] }));
  assert.notEqual(
    canvasSnapshotKey(a),
    canvasSnapshotKey(b),
    'joining on the empty string would collide these',
  );
});

test('any change the card shows changes the key — the bail can never hide an edit', () => {
  const base = readCanvasFormSnapshot(form({ pricing_basis: 'fixed', starting_price_php: '80000' }));
  const baseKey = canvasSnapshotKey(base);
  const changes: Record<string, string | string[]>[] = [
    { pricing_basis: 'fixed', starting_price_php: '85000' },
    { pricing_basis: 'fixed', starting_price_php: '80000', primary_photo_r2_key: 'c.webp' },
    { pricing_basis: 'fixed', starting_price_php: '80000', showcase_photo_r2_keys: ['a.webp'] },
    { pricing_basis: 'fixed', starting_price_php: '80000', showcase_video_r2_key: 'c.mp4' },
    { pricing_basis: 'fixed', starting_price_php: '80000', inclusion_label: ['Free reel'] },
    // Card TEXT must move the key: card health text-checks these, so an edit
    // whose only effect is to introduce a violation has to wake the score up.
    {
      pricing_basis: 'fixed',
      starting_price_php: '80000',
      discount_conditions_md: ['Call 0917 555 1234'],
    },
    { pricing_basis: 'fixed', starting_price_php: '80000', customization_draft: '{"v":1}' },
    { pricing_basis: 'fixed', starting_price_php: '80000', linked: ['photography'] },
    { pricing_basis: 'per_hour', hour_base_php: '25000' },
  ];
  for (const c of changes) {
    assert.notEqual(
      canvasSnapshotKey(readCanvasFormSnapshot(form(c))),
      baseKey,
      `an edit went unnoticed: ${JSON.stringify(c)}`,
    );
  }
});
