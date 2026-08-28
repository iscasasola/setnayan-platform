import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reachTally, serviceReach } from '@/lib/service-reach';
import { paxAdjustedStartsAtPhp, priceFitScore, PRICE_FIT_NEUTRAL } from '@/lib/smart-sort';
import { priceIsSet } from '@/lib/service-publish-gate';

test('a priced card has full reach and reports its own floor', () => {
  const r = serviceReach({ pricing_basis: 'fixed', starting_price_php: 85_000 });
  assert.equal(r.level, 'full');
  assert.equal(r.startsAtPhp, 85_000);
  assert.match(r.label, /Full reach/);
});

test('a card with no price has limited reach and says to add one', () => {
  const r = serviceReach({ pricing_basis: 'fixed', starting_price_php: null });
  assert.equal(r.level, 'limited');
  assert.equal(r.startsAtPhp, null);
  assert.match(r.label, /add a price/i);
});

test('ZERO is not a price', () => {
  // The save has accepted a typed 0 before, and a card reporting itself priced
  // while every gate refuses it is the screen and the rule disagreeing by one
  // value.
  assert.equal(serviceReach({ pricing_basis: 'fixed', starting_price_php: 0 }).level, 'limited');
});

test('a per-pax card priced per head has full reach with no flat figure', () => {
  const r = serviceReach({
    pricing_basis: 'per_pax',
    starting_price_php: null,
    per_pax_price_php: 1_200,
    min_pax: 100,
  });
  assert.equal(r.level, 'full');
  assert.equal(r.startsAtPhp, 120_000);
});

test('a per-hour card priced by the hour has full reach', () => {
  const r = serviceReach({ pricing_basis: 'per_hour', starting_price_php: null, hour_base_php: 8_000 });
  assert.equal(r.level, 'full');
  assert.equal(r.startsAtPhp, 8_000);
});

test('a missing card is limited, never a crash', () => {
  assert.equal(serviceReach(null).level, 'limited');
  assert.equal(serviceReach(undefined).level, 'limited');
});

// ── The claim must be the SEARCH's own answer, not a second copy of it ─────

test('reach agrees with the function the couple search prices cards with', () => {
  const cards = [
    { pricing_basis: 'fixed', starting_price_php: 85_000 },
    { pricing_basis: 'fixed', starting_price_php: null },
    { pricing_basis: 'fixed', starting_price_php: 0 },
    { pricing_basis: 'per_pax', per_pax_price_php: 900, min_pax: 80 },
    { pricing_basis: 'per_pax', per_pax_price_php: null, starting_price_php: null },
    { pricing_basis: 'per_hour', hour_base_php: 5_000 },
    { pricing_basis: 'per_hour', hour_base_php: null, starting_price_php: null },
  ];
  for (const c of cards) {
    const searchSees = paxAdjustedStartsAtPhp(c, null).startsAtPhp;
    const shopIsTold = serviceReach(c);
    assert.equal(
      shopIsTold.level === 'full',
      searchSees != null,
      `reach must track what the search can price: ${JSON.stringify(c)}`,
    );
    assert.equal(shopIsTold.startsAtPhp, searchSees);
  }
});

// ── "Limited" is not "nobody" ──────────────────────────────────────────────

test('limited reach really is limited, not zero — the card is never removed', () => {
  // What a priceless card loses is the ability to WIN on budget. It still
  // scores, at the neutral fit, which is what "it still appears" means.
  assert.equal(priceFitScore(null, 90_000), PRICE_FIT_NEUTRAL);
  assert.ok(PRICE_FIT_NEUTRAL > 0);
  assert.match(serviceReach(null).note, /still appears/i);
});

test('the limited note never claims nobody sees the card', () => {
  const note = serviceReach(null).note.toLowerCase();
  assert.ok(!note.includes('nobody'), 'a threat we do not carry out is a lie to the shop');
  assert.ok(!note.includes('never appears'));
});

// ── Reach is never the SIZE of the price ──────────────────────────────────

test('a dearer card earns exactly the same reach as a cheaper one', () => {
  const cheap = serviceReach({ pricing_basis: 'fixed', starting_price_php: 5_000 });
  const dear = serviceReach({ pricing_basis: 'fixed', starting_price_php: 5_000_000 });
  assert.equal(cheap.level, dear.level);
  assert.equal(cheap.label, dear.label);
  assert.equal(cheap.note, dear.note);
});

// ── Reach and the publish gate must agree about "priced" ──────────────────

test('on the anchor column, reach and the publish gate give the same answer', () => {
  // S3's gate asks `priceIsSet(starting_price_php)`; reach asks what the SEARCH
  // can price. They are different questions and must not disagree about the
  // same card: `parsePricingFields` syncs the anchor for per-pax and per-hour
  // cards, so the anchor is the shared truth for every card the app can make.
  for (const value of [null, undefined, 0, -1, 1, 85_000, Number.NaN]) {
    const card = { pricing_basis: 'fixed', starting_price_php: value as number | null };
    assert.equal(
      serviceReach(card).level === 'full',
      priceIsSet(value as number | null),
      `disagreement on starting_price_php = ${String(value)}`,
    );
  }
});

// ── reachTally ─────────────────────────────────────────────────────────────

test('the tally counts priced cards, and says nothing when there are none', () => {
  assert.equal(reachTally([]), null);
  assert.deepEqual(
    reachTally([
      { pricing_basis: 'fixed', starting_price_php: 85_000 },
      { pricing_basis: 'fixed', starting_price_php: null },
    ]),
    { full: 1, total: 2 },
  );
  assert.deepEqual(
    reachTally([{ pricing_basis: 'fixed', starting_price_php: 85_000 }]),
    { full: 1, total: 1 },
  );
});
