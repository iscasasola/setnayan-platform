/**
 * quote-from-service-card.test.ts — a service card (or several) becomes the
 * quote being written, and every part of the card lands where the owner said.
 *
 * ⚖ OWNER, 2026-09-22: *"The quotation maker in the vendor chatbox … can load 1
 * or multiple service cards combined"* · *"apply the discount"*.
 *
 * ── Measured before writing (prod, 2026-09-22) ─────────────────────────────
 *   select count(*) from vendor_packages;            → 0
 *   select count(*) from vendor_proposal_templates;  → 0
 *   select count(*) from vendor_services;            → 2 (live_band ₱35,000 · host_mc ₱40,000)
 * So the builder's only seed never rendered for a real shop, and the fixture
 * below is the two live cards' real flags (crew meal required & not included,
 * travel not included) with the sibling rows prod does not yet hold.
 *
 * ── What this file holds ───────────────────────────────────────────────────
 *   1. ONE CARD → its priced line, its freebies, its crew/travel state.
 *   2. TWO CARDS COMBINE → two priced lines, one schedule, one discount.
 *   3. THE DISCOUNT IS APPLIED WITH ITS REASON — and only when the event date
 *      qualifies the couple for the rung; no date ⇒ nothing is applied.
 *   4. BRACKETS, ADDED GUESTS, ADD-ONS, LAST-MINUTE — each read off the card.
 *   5. THE SCHEDULE AND THE TERMS come from the card's rows.
 *   6. NOTHING IS INVENTED: the crew meal's per-head price is null, not a number.
 *
 * 🛡 Mutation-checked: each rule was broken on purpose and watched go RED
 * before being trusted (the sabotages are listed beside each test).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  quoteFromServiceCards,
  scheduleFromCard,
  termsLine,
  bracketFor,
  monthsUntil,
  type CardForQuoteInput,
  type ServiceCardForQuote,
} from './quote-from-service-card';
import { resolvePackageLine } from './package-line-pricing';

/* ── Fixtures — the two live cards' real flags, plus rows prod does not hold yet ── */

const NOW = new Date('2026-09-22T00:00:00+08:00');
const EVENT = '2027-03-13'; // Ana & Miguel, the accepted thread's event

function card(over: Partial<ServiceCardForQuote> = {}): ServiceCardForQuote {
  return {
    vendor_service_id: 'svc_live_band',
    pricing_basis: 'fixed',
    starting_price_php: 35000,
    per_pax_price_php: null,
    min_pax: null,
    hour_base_php: null,
    min_hours: null,
    extra_hour_php: null,
    base_pax: null,
    added_pax_price_php: null,
    added_pax_block: 1,
    crew_size: null,
    crew_meal_required: true,
    crew_meal_included: false,
    transport_included: false,
    transport_flat_fee_php: null,
    recommended_lead_time_months: null,
    last_minute_end_months: null,
    last_minute_surcharge_pct: null,
    ...over,
  };
}

function input(c: Partial<CardForQuoteInput> = {}): CardForQuoteInput {
  return {
    card: card(),
    label: 'Live band',
    inclusions: [],
    brackets: [],
    discounts: [],
    addons: [],
    chosenAddonIds: [],
    schedule: [],
    ...c,
  };
}

const run = (cards: CardForQuoteInput[], over: Partial<{ pax: number; hours: number; eventDate: string | null }> = {}) =>
  quoteFromServiceCards({ cards, pax: 200, hours: 8, eventDate: EVENT, now: NOW, ...over });

/** Price a seeded line exactly the way the builder does (through the shared resolver). */
const linePhp = (l: { basis: string; free: boolean; flatPhp: number; ratePhp: number; minPax: number; basePhp: number; inclHours: number; extraPhp: number }, pax = 200, hours = 8) =>
  l.free
    ? 0
    : resolvePackageLine(
        {
          pricing_basis: l.basis === 'flat' ? 'fixed' : (l.basis as 'per_pax' | 'per_hour'),
          replacement_value_centavos: Math.round(l.flatPhp * 100),
          per_pax_price_centavos: Math.round(l.ratePhp * 100),
          min_pax: l.minPax || null,
          hour_base_centavos: Math.round(l.basePhp * 100),
          min_hours: l.inclHours || null,
          extra_hour_centavos: Math.round(l.extraPhp * 100),
        },
        { pax, hours },
      ) / 100;

/* ── 1 · one card ────────────────────────────────────────────────────────── */

test('1a · one fixed card → one priced line at its price, labelled by the resolved kind, never "Untitled"', () => {
  const seed = run([input()]);
  assert.equal(seed.lines.length, 1);
  assert.equal(seed.lines[0]!.label, 'Live band');
  assert.equal(seed.lines[0]!.free, false);
  assert.equal(linePhp(seed.lines[0]!), 35000);
  assert.equal(seed.title, 'Live band');
  // sabotage: label the line `card.title ?? 'Untitled service'` → RED (title is not an input at all)
});

test('1b · the card\'s inclusions become ₱0 Complimentary lines, in the card\'s order', () => {
  const seed = run([
    input({
      inclusions: [
        { vendor_service_id: 'svc_live_band', label: 'Sound check · 1 hr', worth_php: null, sort_order: 2 },
        { vendor_service_id: 'svc_live_band', label: 'Wireless mics', worth_php: 1500, sort_order: 1 },
      ],
    }),
  ]);
  assert.deepEqual(
    seed.lines.map((l) => [l.label, l.free, l.flatPhp]),
    [['Live band', false, 35000], ['Wireless mics', true, 0], ['Sound check · 1 hr', true, 0]],
  );
  // sabotage: drop `free: true` on inclusions → RED
});

test('1c · crew and travel open in the state the card\'s flags say (prod: required & not included, travel not included)', () => {
  const seed = run([input()]);
  assert.deepEqual(seed.crew, { mode: 'charge', size: null, perHeadPhp: null });
  assert.deepEqual(seed.transport, { mode: 'distance', flatPhp: 0 });

  const incl = run([input({ card: card({ crew_meal_included: true, crew_size: 6, transport_included: true }) })]);
  assert.deepEqual(incl.crew, { mode: 'included', size: 6, perHeadPhp: null });
  assert.deepEqual(incl.transport, { mode: 'included', flatPhp: 0 });

  const flat = run([input({ card: card({ transport_flat_fee_php: 2500 }) })]);
  assert.deepEqual(flat.transport, { mode: 'flat', flatPhp: 2500 });

  const none = run([input({ card: card({ crew_meal_required: false }) })]);
  assert.equal(none.crew, null, 'a card that needs no crew meal says nothing about it');
  // sabotage: `crew_meal_required` → mode 'included' → RED on the first assertion
});

test('1d · NOTHING IS INVENTED — the per-head crew price is not on the card, so it is null, never a number', () => {
  const seed = run([input()]);
  assert.equal(seed.crew?.perHeadPhp, null);
  // sabotage: return perHeadPhp: 350 → RED
});

/* ── 2 · several cards combine ───────────────────────────────────────────── */

test('2 · two cards → two priced lines (₱35,000 + ₱40,000), one title joining both, ONE schedule and ONE discount', () => {
  const hostMc = input({
    card: card({ vendor_service_id: 'svc_host_mc', starting_price_php: 40000 }),
    label: 'Host / MC',
    schedule: [
      { seq: 0, label: 'Reservation', amount_kind: 'percent', percent_bps: 5000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false },
    ],
  });
  const liveBand = input({
    schedule: [
      { seq: 0, label: 'Booking fee', amount_kind: 'percent', percent_bps: 3000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: null, downpayment_non_refundable: true, refund_window_days: 14, no_show_forfeit: true },
    ],
    discounts: [{ vendor_service_id: 'svc_live_band', discount_type: 'promo', rate: 10, unit: 'pct', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }],
  });
  const seed = run([liveBand, hostMc]);
  assert.deepEqual(seed.lines.map((l) => [l.label, linePhp(l)]), [['Live band', 35000], ['Host / MC', 40000]]);
  assert.equal(seed.title, 'Live band + Host / MC');
  assert.equal(seed.schedule?.manual.length, 1, 'one quote, one schedule — the first card that states one');
  assert.equal(seed.schedule?.manual[0]!.percent, 30);
  assert.equal(seed.discount?.php, 3500, 'the first card\'s promo, on its own anchor');
  // sabotage: drop the second card's line (`if (i === 0)`) → RED on the first assertion
});

/* ── 3 · the discount is APPLIED, with its reason, only when the date qualifies ── */

const earlyBooking = [
  { vendor_service_id: 'svc_live_band', discount_type: 'early_booking' as const, rate: 10, unit: 'pct' as const, min_lead_months: 3, expires_at: null, conditions_md: null, sort_order: 0 },
];

test('3a · an early-booking rung the event date qualifies for is applied — ₱3,500 off ₱35,000, with the reason', () => {
  const seed = run([input({ discounts: earlyBooking })]); // 2027-03-13 is ~5.7 months out ≥ 3
  assert.equal(seed.discount?.php, 3500);
  assert.equal(seed.discount?.type, 'early_booking');
  assert.match(seed.discount?.reason ?? '', /3\+? months|Booked/i);
  // sabotage: ignore `eventDate` (pass null to pickBestDiscount) → RED (3c goes wrong too)
});

test('3b · a rung the date does NOT reach is not applied', () => {
  const seed = run([input({ discounts: [{ ...earlyBooking[0]!, min_lead_months: 9 }] })]);
  assert.equal(seed.discount, null);
  // sabotage: `min_lead_months` unread → RED
});

test('3c · no event date ⇒ an early-booking ladder is NOT applied (it would promise a rung nobody qualified for)', () => {
  const seed = run([input({ discounts: earlyBooking })], { eventDate: null });
  assert.equal(seed.discount, null);
  // sabotage: drop the `leadTier !== 'up-to'` gate → RED
});

test('3d · a plain promo needs no date and is applied on the card\'s anchor', () => {
  const seed = run([input({ discounts: [{ vendor_service_id: 'svc_live_band', discount_type: 'promo', rate: 2000, unit: 'php', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }] })], { eventDate: null });
  assert.deepEqual([seed.discount?.php, seed.discount?.type], [2000, 'promo']);
});

/* ── 4 · brackets, added guests, add-ons, last-minute — each off the card ── */

test('4a · a fixed card with brackets prices the line at the bracket holding the guest count', () => {
  const brackets = [
    { vendor_service_id: 'svc_live_band', min_pax: 0, max_pax: 150, price_php: 30000, sort_order: 0 },
    { vendor_service_id: 'svc_live_band', min_pax: 151, max_pax: null, price_php: 42000, sort_order: 1 },
  ];
  assert.equal(bracketFor(brackets, 150)?.price_php, 30000);
  assert.equal(bracketFor(brackets, 151)?.price_php, 42000);
  assert.equal(linePhp(run([input({ brackets })], { pax: 200 }).lines[0]!), 42000);
  assert.equal(linePhp(run([input({ brackets })], { pax: 120 }).lines[0]!, 120), 30000);
  // sabotage: always take brackets[0] → RED
});

test('4b · guests above the card\'s base_pax add an "Added guests" line by the card\'s own block rule', () => {
  const seed = run([input({ card: card({ base_pax: 150, added_pax_price_php: 100, added_pax_block: 10 }) })], { pax: 175 });
  const added = seed.lines.find((l) => l.label.startsWith('Added guests'));
  assert.ok(added, 'the line exists');
  assert.equal(added!.label, 'Added guests · 25 over 150');
  assert.equal(linePhp(added!, 175), 300, 'ceil(25/10)=3 blocks × ₱100');
  assert.equal(run([input({ card: card({ base_pax: 150, added_pax_price_php: 100 }) })], { pax: 150 }).lines.length, 1, 'at the base: no line');
  // sabotage: `Math.floor` instead of ceil → RED (₱200)
});

test('4c · only the add-ons the supplier ticked become lines', () => {
  const addons = [
    { id: 1, label: 'Extra hour', from_price_php: 5000 },
    { id: 2, label: 'Acoustic ceremony set', from_price_php: 8000 },
  ];
  const none = run([input({ addons })]);
  assert.equal(none.lines.length, 1);
  const one = run([input({ addons, chosenAddonIds: [2] })]);
  assert.deepEqual(one.lines.map((l) => [l.label, linePhp(l)]), [['Live band', 35000], ['Acoustic ceremony set', 8000]]);
  // sabotage: push every add-on → RED on `none`
});

test('4d · inside the card\'s last-minute window a named surcharge line is added; outside it, nothing', () => {
  const rush = run([input({ card: card({ last_minute_end_months: 12, last_minute_surcharge_pct: 10 }) })]);
  const line = rush.lines.find((l) => l.label.startsWith('Last-minute'));
  assert.equal(line?.label, 'Last-minute surcharge · 10%');
  assert.equal(linePhp(line!), 3500);
  assert.deepEqual(rush.warnings, [{ kind: 'last_minute', pct: 10, endMonths: 12 }]);

  const calm = run([input({ card: card({ last_minute_end_months: 1, last_minute_surcharge_pct: 10 }) })]);
  assert.equal(calm.lines.length, 1);
  assert.deepEqual(calm.warnings, []);
  // sabotage: compare with `>=` the wrong way → RED on `calm`
});

test('4e · an event nearer than the recommended lead time is a WARNING, never a block or a line', () => {
  const seed = run([input({ card: card({ recommended_lead_time_months: 9 }) })]);
  assert.equal(seed.lines.length, 1);
  assert.equal(seed.warnings[0]?.kind, 'lead_time');
  assert.equal((seed.warnings[0] as { recommendedMonths: number }).recommendedMonths, 9);
  assert.ok(monthsUntil(EVENT, NOW)! > 5 && monthsUntil(EVENT, NOW)! < 6, 'the fixture really is ~5.7 months out');
});

/* ── 5 · the schedule and the terms come from the card ───────────────────── */

test('5a · the card\'s rows become manual installments; percent and fixed each keep their figure', () => {
  const s = scheduleFromCard([
    { seq: 1, label: 'Balance', amount_kind: 'fixed', percent_bps: null, amount_centavos: 2_500_000, due_anchor: 'before_event', due_offset_days: 7, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false },
    { seq: 0, label: 'Reservation', amount_kind: 'percent', percent_bps: 3000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: 'Move once for free', downpayment_non_refundable: true, refund_window_days: 14, no_show_forfeit: true },
  ]);
  assert.deepEqual(
    s?.manual,
    [
      { label: 'Reservation', kind: 'percent', amountPhp: null, percent: 30, due: 'on_lock', offsetDays: 0 },
      { label: 'Balance', kind: 'fixed', amountPhp: 25000, percent: null, due: 'before_event', offsetDays: 7 },
    ],
    'sorted by seq, pesos kept exact',
  );
  assert.equal(s?.autoBalance, null, 'the auto Final balance stays the builder\'s');
  // sabotage: `percent_bps / 10` → RED
});

test('5b · the terms line is the seq-0 policy in one sentence, and null when nothing is stated', () => {
  assert.equal(
    termsLine([{ seq: 0, label: 'Reservation', amount_kind: 'percent', percent_bps: 3000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: 'Move once for free', downpayment_non_refundable: true, refund_window_days: 14, no_show_forfeit: true }]),
    'Move once for free · Reservation non-refundable · refund window 14 days · no-show forfeits the downpayment',
  );
  assert.equal(termsLine([{ seq: 0, label: 'Reservation', amount_kind: 'percent', percent_bps: 3000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false }]), null);
  assert.equal(scheduleFromCard([]), null, 'no rows → the builder keeps its default schedule');
});

/* ── 6 · per-pax and per-hour cards keep their basis ─────────────────────── */

test('6 · a per-pax card seeds a per-guest line and a per-hour card a per-hour line — priced by the shared resolver', () => {
  const perPax = run([input({ card: card({ pricing_basis: 'per_pax', per_pax_price_php: 1200, min_pax: 100, starting_price_php: null }) })], { pax: 80 });
  assert.equal(perPax.lines[0]!.basis, 'per_pax');
  assert.equal(linePhp(perPax.lines[0]!, 80), 120000, '₱1,200 × max(80, 100)');
  const perHour = run([input({ card: card({ pricing_basis: 'per_hour', hour_base_php: 20000, min_hours: 6, extra_hour_php: 2500, starting_price_php: null }) })], { hours: 8 });
  assert.equal(perHour.lines[0]!.basis, 'per_hour');
  assert.equal(linePhp(perHour.lines[0]!, 200, 8), 25000, '₱20,000 + 2 h × ₱2,500');
  // sabotage: map every basis to 'flat' → RED
});

/* ── 7 · slice B: what a seed changes in the builder's draft, and what it leaves ── */

import { applyCardSeedToDraft } from './quote-from-service-card';

const DRAFT = {
  crew: { mode: 'charge' as const, size: 5, perHeadPhp: 350 },
  transport: { mode: 'included' as const, flatPhp: 2000 },
  discountPhp: 1234,
  coupleProvidesCrewMeal: false,
};

test('7a · the seed REPLACES the lines, sets the crew MODE, keeps the draft\'s per-head price and size when the card states none', () => {
  const seed = run([input({ card: card({ crew_meal_required: true, crew_meal_included: false, crew_size: null }) })]);
  const after = applyCardSeedToDraft(seed, DRAFT);
  assert.equal(after.lines.length, 1);
  assert.deepEqual(after.crew, { mode: 'charge', size: 5, perHeadPhp: 350 });
  const sized = applyCardSeedToDraft(run([input({ card: card({ crew_size: 8 }) })]), DRAFT);
  assert.equal(sized.crew.size, 8, 'a stated crew size wins');
  assert.equal(sized.crew.perHeadPhp, 350, 'the per-head price is never the card\'s');
  // sabotage: `perHeadPhp: seed.crew.perHeadPhp ?? 0` → RED
});

test('7b · a couple who booked a crew-meal service keeps OFFSET whatever the card says', () => {
  const after = applyCardSeedToDraft(run([input()]), { ...DRAFT, crew: { ...DRAFT.crew, mode: 'offset' }, coupleProvidesCrewMeal: true });
  assert.equal(after.crew.mode, 'offset');
  // sabotage: drop the coupleProvidesCrewMeal branch → RED
});

test('7c · the card\'s discount REPLACES the field with its reason; no applicable discount leaves a hand-typed figure alone', () => {
  const applied = applyCardSeedToDraft(run([input({ discounts: earlyBooking })]), DRAFT);
  assert.equal(applied.discountPhp, 3500);
  assert.ok(applied.discountReason && applied.discountReason.length > 0);
  const kept = applyCardSeedToDraft(run([input()]), DRAFT);
  assert.equal(kept.discountPhp, 1234, 'the supplier\'s own figure survives a card with no discount');
  assert.equal(kept.discountReason, null);
  // sabotage: `discountPhp: seed.discount?.php ?? 0` → RED on `kept`
});

test('7d · transport: the card\'s flat fee lands; an "included" card keeps the draft\'s remembered fee for later', () => {
  const flat = applyCardSeedToDraft(run([input({ card: card({ transport_flat_fee_php: 2500 }) })]), DRAFT);
  assert.deepEqual(flat.transport, { mode: 'flat', flatPhp: 2500 });
  const incl = applyCardSeedToDraft(run([input({ card: card({ transport_included: true }) })]), DRAFT);
  assert.deepEqual(incl.transport, { mode: 'included', flatPhp: 2000 });
});

test('7e · the schedule and terms come only from a card that has them; otherwise the draft keeps its own (null = untouched)', () => {
  const none = applyCardSeedToDraft(run([input()]), DRAFT);
  assert.equal(none.schedule, null);
  assert.equal(none.terms, null);
  const withRows = applyCardSeedToDraft(
    run([input({ schedule: [{ seq: 0, label: 'Reservation', amount_kind: 'percent', percent_bps: 3000, amount_centavos: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: null, downpayment_non_refundable: true, refund_window_days: null, no_show_forfeit: false }] })]),
    DRAFT,
  );
  assert.equal(withRows.schedule?.length, 1);
  assert.equal(withRows.terms, 'Reservation non-refundable');
  assert.equal(withRows.title, 'Live band');
  // sabotage: return `schedule: seed.schedule?.manual ?? []` → RED on `none`
});
