/**
 * 👥💸 The pure mirror of `quote_follow_guest_count` (Piece 1 · PR-2). The SQL side and the agreement between them are
 * held by tests/db/a-quote-follows-the-guest-list.db.test.ts; this holds the rules a reader can check without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followGuestCount, quoteFallWords, quoteFollowsGuestList, quoteRiseWords, type FollowQuote } from './quote-pax-follow';
import { quoteFallFromLine, quoteRiseFromLine, streamLineKind } from './chat-card-lines';
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

// ── 📉 THE FALL-BACK (migration 20271340566104; DECISION_LOG 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK —
// UNLESS THE SUPPLIER LOCKED IT") ─────────────────────────────────────────────────────────────────────────────────

/** The fixture quote after the list rose to `to` — as the repricer leaves it (sent pax remembered). */
function risen(to: number, over: Partial<FollowQuote> = {}): FollowQuote {
  const q = quote(over);
  const r = followGuestCount(q, to);
  assert.ok(r.rose);
  return { ...q, lines: r.lines, totalCentavos: r.totalCentavos, schedule: r.schedule, billedPax: r.billedPax, sentBilledPax: q.billedPax };
}

test('📉 unlocked: fewer guests → the per-head lines fall back, the drop comes off the Final balance', () => {
  const q = risen(130);
  const r = followGuestCount(q, 110, [0]);
  assert.ok(r.fell);
  assert.equal(r.deltaCentavos, -20 * 65_000);
  assert.equal(r.billedPax, 110);
  assert.equal(r.lines[0]!.amount_centavos, 110 * 65_000);
  assert.equal(r.lines[0]!.detail, '110 pax × ₱650');
  assert.equal(r.lines[1]!.amount_centavos, 1_620_000, 'a flat line never moves');
  const inst = r.schedule!.installments!;
  assert.deepEqual(inst[0], q.schedule!.installments![0], 'the paid first payment is untouched');
  assert.equal(inst[1]!.amount_centavos, q.schedule!.installments![1]!.amount_centavos - 20 * 65_000);
  assert.equal(inst.reduce((s, i) => s + i.amount_centavos, 0), r.totalCentavos, 'the plan still pays the whole quote');
  assert.equal(r.line, 'Quote fell to 110 pax · −₱13,000');
});

test('📉 unlocked: it falls to the pax it was SENT at and no further — back to the sent quote exactly', () => {
  const q = risen(130);
  const r = followGuestCount(q, 60);
  assert.ok(r.fell);
  assert.equal(r.billedPax, 100, 'the sent pax is the floor');
  assert.equal(r.totalCentavos, quote().totalCentavos, 'back to the sent total, not below');
  assert.equal(r.lines[0]!.amount_centavos, quote().lines[0]!.amount_centavos);
  assert.equal(r.schedule!.installments![1]!.amount_centavos, quote().schedule!.installments![1]!.amount_centavos);
  // Already at the floor: nothing moves.
  const again = followGuestCount({ ...q, lines: r.lines, totalCentavos: r.totalCentavos, schedule: r.schedule, billedPax: r.billedPax }, 40);
  assert.equal(again.rose || again.fell, false);
});

test('📉 the supplier’s minimum holds: a Bill-at-least above the sent pax stops the fall there', () => {
  const q = { ...risen(130), minPax: 120 };
  const r = followGuestCount(q, 90);
  assert.ok(r.fell);
  assert.equal(r.billedPax, 120);
  assert.equal(r.deltaCentavos, -10 * 65_000);
});

test('📉 a line quoted ABOVE rate × pax never falls under what was sent', () => {
  const q: FollowQuote = { lines: [{ label: 'Buffet', amount_centavos: 10_000_000, detail: 'Plated', basis: 'per_pax', rate_centavos: 65_000 }], totalCentavos: 10_000_000, schedule: null, minPax: 0, billedPax: 100, booked: false };
  const up = followGuestCount(q, 170);
  assert.ok(up.rose);
  assert.equal(up.totalCentavos, 170 * 65_000);
  const down = followGuestCount({ ...q, lines: up.lines, totalCentavos: up.totalCentavos, billedPax: 170, sentBilledPax: 100 }, 120);
  assert.ok(down.fell);
  assert.equal(down.totalCentavos, 10_000_000, 'back to its sent amount, not 120 × ₱650');
  assert.equal(down.lines[0]!.detail, 'Plated', 'and its sent words');
});

test('🔒 locked: still rises, never falls — the locked price is the floor', () => {
  const q = { ...risen(130), locked: true };
  for (const n of [0, 60, 100, 129, 130]) {
    const r = followGuestCount(q, n);
    assert.equal(r.fell, false, `${n} guests`);
    assert.equal(r.rose, false, `${n} guests`);
  }
  const up = followGuestCount(q, 140);
  assert.ok(up.rose, 'a locked quote still rises');
  assert.equal(up.deltaCentavos, 10 * 65_000);
});

test('💳 paid never changes: a PAID Final balance leaves nothing unsettled — the price stays', () => {
  const q = risen(130);
  const r = followGuestCount(q, 100, [0, 1]);
  assert.equal(r.fell, false);
  assert.equal(r.rose, false);
});

test('💳 a drop bigger than what is unsettled stops there — whole guests, never a credit', () => {
  // Paid first payment, a small unpaid auto row of 2 guests' worth on top (a rise after the Final balance was paid).
  const q = risen(130);
  const inst = q.schedule!.installments!;
  const small: FollowQuote = {
    ...q,
    schedule: { ...q.schedule!, installments: [inst[0]!, { ...inst[1]!, amount_centavos: inst[1]!.amount_centavos - 2 * 65_000, raw_centavos: inst[1]!.raw_centavos! - 2 * 65_000 }, { seq: 2, amount_centavos: 2 * 65_000, raw_centavos: 2 * 65_000, is_auto_balance: true }] },
  };
  const r = followGuestCount(small, 100, [0, 1]);
  assert.ok(r.fell);
  assert.equal(r.billedPax, 128, 'falls only as far as the unsettled ₱1,300 allows');
  assert.equal(r.deltaCentavos, -2 * 65_000);
  const after = r.schedule!.installments!;
  assert.deepEqual(after, small.schedule!.installments!.slice(0, 2), 'the paid rows are untouched; the emptied auto row leaves');
  assert.equal(after.reduce((s, i) => s + i.amount_centavos, 0), r.totalCentavos);

  // No plan: never below what has been paid on the booking.
  const bare: FollowQuote = { ...q, schedule: null };
  const paid = q.totalCentavos - 5 * 65_000 - 1;
  const capped = followGuestCount(bare, 100, [], paid);
  assert.ok(capped.fell);
  assert.equal(capped.billedPax, 125, '5 guests fit under the ₱3,250.01 still unsettled');
  assert.ok(capped.totalCentavos >= paid, 'never under what is paid');
  assert.equal(followGuestCount(bare, 100, [], q.totalCentavos).fell, false, 'paid in full → nothing falls');
});

test('📉 a booked deal does not fall either (Piece 2)', () => {
  assert.equal(followGuestCount({ ...risen(130), booked: true }, 100).fell, false);
});

test('📉 the fall line reads back exactly, and draws its card', () => {
  const words = quoteFallWords(1_250, 1_234_567);
  assert.equal(words, 'Quote fell to 1,250 pax · −₱12,345.67');
  assert.deepEqual(quoteFallFromLine(words), { pax: 1250, deltaWords: '₱12,345.67' });
  assert.equal(streamLineKind(words), 'fall');
  assert.equal(quoteFallFromLine('Quote fell to 160 pax · -₱800'), null, 'a hyphen is not the database’s minus');
  assert.equal(quoteRiseFromLine(words), null);
});
