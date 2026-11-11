/**
 * 👥💸 The pure mirror of `quote_follow_guest_count` (Piece 1 · PR-2). The SQL side and the agreement between them are
 * held by tests/db/a-quote-follows-the-guest-list.db.test.ts; this holds the rules a reader can check without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followGuestCount, quoteFollowsGuestList, quoteRiseWords, type FollowQuote } from './quote-pax-follow';
import { quoteRiseFromLine, streamLineKind } from './chat-card-lines';
import { kidsCountSuggestions, kidsSuggestionWords } from './guest-not-counted';

const quote = (over: Partial<FollowQuote> = {}): FollowQuote => ({
  lines: [
    { label: 'Buffet', amount_centavos: 65_000 * 100, basis: 'per_pax', rate_centavos: 65_000 },
    { label: 'Cocktail', amount_centavos: 1_620_000, basis: 'flat' },
  ],
  totalCentavos: 65_000 * 100 + 1_620_000,
  schedule: {
    base_centavos: 8_120_000,
    total_centavos: 8_120_000,
    installments: [
      { seq: 0, amount_centavos: 1_624_000, raw_centavos: 1_624_000, is_auto_balance: false },
      { seq: 1, amount_centavos: 6_496_000, raw_centavos: 6_496_000, is_auto_balance: true },
    ],
  },
  minPax: 100,
  billedPax: 100,
  booked: false,
  ...over,
});

test('rises with the count: per-head lines only, the Final balance takes it, the plan still pays in full', () => {
  const r = followGuestCount(quote(), 120);
  assert.ok(r.rose);
  assert.equal(r.deltaCentavos, 20 * 65_000);
  assert.equal(r.totalCentavos, 8_120_000 + 1_300_000);
  assert.equal(r.lines[1]!.amount_centavos, 1_620_000);
  const inst = r.schedule!.installments!;
  assert.equal(inst[0]!.amount_centavos, 1_624_000);
  assert.equal(inst[1]!.amount_centavos, 6_496_000 + 1_300_000);
  assert.equal(inst.reduce((s, i) => s + i.amount_centavos, 0), r.totalCentavos);
  assert.equal(r.line, 'Quote rose to 120 pax · +₱13,000');
});

test('never down — fewer guests, the minimum, or the billed pax already sent hold the price', () => {
  assert.equal(followGuestCount(quote(), 80).rose, false);
  const at150 = quote({
    lines: [{ label: 'Buffet', amount_centavos: 65_000 * 150, basis: 'per_pax', rate_centavos: 65_000 }],
    totalCentavos: 65_000 * 150,
    schedule: null,
    minPax: 150,
    billedPax: 150,
  });
  assert.equal(followGuestCount(at150, 140).rose, false, 'under the Bill-at-least minimum');
  const at130 = quote({
    lines: [{ label: 'Buffet', amount_centavos: 65_000 * 130, basis: 'per_pax', rate_centavos: 65_000 }],
    totalCentavos: 65_000 * 130,
    schedule: null,
    billedPax: 130,
  });
  assert.equal(followGuestCount(at130, 125).rose, false, 'under what it already bills');
  // A line quoted ABOVE rate × billed is never cut to it.
  const high = quote({ lines: [{ label: 'Buffet', amount_centavos: 10_000_000, basis: 'per_pax', rate_centavos: 65_000 }], totalCentavos: 10_000_000, schedule: null });
  assert.equal(followGuestCount(high, 110).rose, false);
  for (const n of [0, 50, 99, 100, 101, 150, 1000]) {
    const r = followGuestCount(quote(), n);
    if (r.rose) assert.ok(r.totalCentavos > quote().totalCentavos);
  }
});

test('a booked deal is untouched here (Piece 2); a quote without its own rate is never repriced', () => {
  assert.equal(followGuestCount(quote({ booked: true }), 200).rose, false);
  const bare = quote({ lines: [{ label: 'Buffet', amount_centavos: 6_500_000 }] });
  assert.equal(quoteFollowsGuestList(bare.lines), false);
  assert.equal(followGuestCount(bare, 200).rose, false);
});

test('paid rows never change: a paid auto row → a new auto row takes the rise', () => {
  const r = followGuestCount(quote(), 110, [1]);
  assert.ok(r.rose);
  const inst = r.schedule!.installments!;
  assert.deepEqual(inst.slice(0, 2), quote().schedule!.installments);
  assert.equal(inst[2]!.seq, 2);
  assert.equal(inst[2]!.amount_centavos, 10 * 65_000);
  assert.equal(inst[2]!.is_auto_balance, true);
});

test('the chat line reads back exactly, and draws its card', () => {
  const words = quoteRiseWords(1_250, 1_234_567);
  assert.equal(words, 'Quote rose to 1,250 pax · +₱12,345.67');
  assert.deepEqual(quoteRiseFromLine(words), { pax: 1250, deltaWords: '₱12,345.67' });
  assert.equal(streamLineKind(words), 'rise');
  assert.equal(quoteRiseFromLine('Quote rose to many pax · +₱1'), null);
});

test('🍽 a kids meal SUGGESTS leaving a guest out of each booked per-head service — and only suggests', () => {
  const services = [
    { id: 'cat', label: 'Catering', booked: true },
    { id: 'booth', label: 'Photo Booth', booked: false },
    { id: 'cake', label: 'Cake', booked: true },
  ];
  assert.deepEqual(kidsCountSuggestions('chicken', services, []), []);
  assert.deepEqual(kidsCountSuggestions('kids', services, []).map((s) => s.id), ['cat', 'cake'], 'booked only');
  assert.deepEqual(kidsCountSuggestions('kids', services, ['cat']).map((s) => s.id), ['cake'], 'not one already ticked');
  assert.deepEqual(kidsCountSuggestions('kids', services, [], ['cake']).map((s) => s.id), ['cat'], 'Not now hides it');
  assert.equal(kidsSuggestionWords('Catering'), 'Leave out of Catering’s count?');
  // Pure: the inputs are never changed — nothing is ticked by the suggestion itself.
  const picked: string[] = [];
  kidsCountSuggestions('kids', services, picked);
  assert.deepEqual(picked, []);
});

test('🍽 the guest card ticks only from the couple’s tap — never on render or in an effect', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'guests', '_components', 'not-counted-result.tsx'), 'utf8');
  const calls = [...src.matchAll(/leaveOut\(/g)].length;
  const taps = [...src.matchAll(/onClick=\{\(\) => leaveOut\(/g)].length;
  assert.ok(src.includes('const leaveOut = (id: string) =>'), 'the one tap is gone');
  assert.equal(calls, taps, 'leaveOut may be called ONLY from a button’s onClick');
  assert.equal(taps, 1);
});
