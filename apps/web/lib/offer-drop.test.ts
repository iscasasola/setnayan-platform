/**
 * 🏷 THE OFFER CARD'S RULES (Quote + negotiation · PR-4, owner 2026-11-12). Run from apps/web:
 *   npx tsx --test lib/offer-drop.test.ts
 *
 * Fails if: Apply is offered on an EXPIRED DROP or an ENDED OFFER; "applied" stops being derived from a later
 * version's `line_items[].offer_id`; an offer comes off lines on cards it does not reach (owner 12 Nov (2)); the
 * amount stops being `offersForQuote`'s (% first, then ₱ off the rest — the 9 Nov rule); the new version changes an
 * old line or adds more than one; a PAID plan row moves (owner 12 Nov (3)); or offers stack.
 * The figures are fixtures, not prices.
 *
 * SABOTAGE (seen red, restored — see the PR body): drop the Good-until check in `applyRefusal`; anchor on every line
 * (the whole quote) instead of `reachedLines`; resolve the plan without freezing the paid rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankOffer, offAmount, type Offer } from './offers';
import { offersForQuote } from './quote-offer-door';
import { resolveSchedule } from './proposal-payment-schedule';
import { appliedVersion, applyRefusal, applyRefusalWords, dropState, offerVersion, reachedLines, resplitPlan, type DropLine } from './offer-drop';

const TODAY = '2026-11-12';
const NOW = new Date('2026-11-12T04:00:00Z');
const offer = (over: Partial<Offer>): Offer => ({ ...blankOffer(over.id ?? 'S89D-ONE'), name: 'Rainy-season weekday', ...over });
const line = (label: string, pesos: number | null, card: string | null): DropLine => ({ label, detail: null, amount_centavos: pesos == null ? null : pesos * 100, card_id: card });

const LINES: DropLine[] = [line('Garden buffet', 90000, 'card-buffet'), line('Cocktail hour', 20000, 'card-cocktail'), line('Grazing table', null, 'card-buffet')];
const TOTAL = 110000 * 100;
const PLAN = resolveSchedule({
  manual: [{ label: 'Reservation', kind: 'percent', amountPhp: null, percent: 30, due: 'on_lock', offsetDays: 0 }],
  autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 30 },
  baseCentavos: TOTAL,
  creditCentavos: 0,
});
const base = { lines: LINES, totalCentavos: TOTAL, quoteCardIds: ['card-buffet', 'card-cocktail'], paymentSchedule: PLAN, paidSeqs: new Set<number>(), today: TODAY, eventDate: '2027-03-14', now: NOW };

/* ── 1 · Apply refuses an expired drop and an ended offer ─────────────────── */

test('🔒 Apply refuses an EXPIRED DROP — the Good-until day has passed — and says so', () => {
  const o = offer({ pctOff: 10 });
  assert.equal(applyRefusal({ offer: o, goodUntil: TODAY, today: TODAY }), null, 'the last good day must still apply');
  const r = applyRefusal({ offer: o, goodUntil: '2026-11-11', today: TODAY });
  assert.ok(r && /good until/i.test(r), `an expired drop was not refused: ${r}`);
  assert.ok(applyRefusal({ offer: o, goodUntil: null, today: TODAY }), 'a drop with no day was not refused');
  assert.deepEqual(dropState({ markerPresent: true, offer: o, goodUntil: '2026-11-11', today: TODAY, appliedIn: null }), { k: 'expired', goodUntil: '2026-11-11' });
});

test('🔒 Apply refuses an ENDED OFFER — off, past its last day, all taken, or unreadable — and says so', () => {
  for (const o of [offer({ pctOff: 10, isOn: false }), offer({ pctOff: 10, untilDate: '2026-11-11' }), offer({ pctOff: 10, who: 'first_n', firstNCap: 2, firstNTaken: 2 }), null]) {
    const r = applyRefusal({ offer: o, goodUntil: '2026-11-20', today: TODAY });
    assert.ok(r && /ended/i.test(r), `an ended offer was not refused (${o?.isOn}, ${o?.untilDate})`);
    assert.equal(dropState({ markerPresent: true, offer: o, goodUntil: '2026-11-20', today: TODAY, appliedIn: null }).k, 'ended');
  }
  assert.equal(dropState({ markerPresent: false, offer: null, goodUntil: '2026-11-20', today: TODAY, appliedIn: null }).k, 'gone');
});

test('the database’s named refusals reach the card as words, never the raw error', () => {
  for (const code of ['OFFER_DROP_EXPIRED', 'OFFER_ENDED', 'NOT_THE_COUPLE', 'NO_LIVE_QUOTE', 'QUOTE_EXPIRED', 'DEAL_LOCKED', 'ALREADY_APPLIED', 'ANOTHER_OFFER', 'PAID_ROW_CHANGED']) {
    const w = applyRefusalWords(`apply_dropped_offer: ${code} — x`);
    assert.ok(!w.includes(code) && w !== applyRefusalWords('???'), `${code} has no words of its own`);
  }
});

/* ── 2 · Applied is derived ──────────────────────────────────────────────── */

test('applied = the first version at/after the drop whose lines name the offer; applied outranks expiry', () => {
  const versions = [
    { version: 1, at: '2026-11-01T00:00:00Z', lines: [{ offer_id: 'S89D-ONE' }] },
    { version: 2, at: '2026-11-10T00:00:00Z', lines: [{ offer_id: null }] },
    { version: 3, at: '2026-11-12T03:00:00Z', lines: [{ offer_id: 'S89D-ONE' }] },
  ];
  assert.equal(appliedVersion(versions, 'S89D-ONE', '2026-11-12T01:00:00Z'), 3, 'a version from BEFORE the drop counted');
  assert.equal(appliedVersion(versions, 'S89D-OTHER', '2026-11-12T01:00:00Z'), null);
  assert.deepEqual(dropState({ markerPresent: true, offer: offer({ isOn: false }), goodUntil: '2026-11-01', today: TODAY, appliedIn: 3 }), { k: 'applied', version: 3 });
});

/* ── 3 · Its own card only, priced by offersForQuote ─────────────────────── */

test('🔒 an offer on one card comes off THAT card’s lines only — priced by offersForQuote, % first then ₱', () => {
  const o = offer({ pctOff: 10, phpOff: 1000, reachesAll: false, cards: ['card-buffet'] });
  assert.deepEqual(reachedLines(LINES, o, base.quoteCardIds).map((l) => l.label), ['Garden buffet'], 'a gift (null) line or another card was reached');
  const r = offerVersion({ ...base, offer: o });
  assert.ok(r.ok, !r.ok ? r.reason : '');
  const expected = offersForQuote({ offers: [o], lines: [{ cardId: 'card-buffet', amountPhp: 90000 }], today: TODAY, eventDate: base.eventDate, now: NOW })[0]!;
  assert.equal(r.version.fit.offPhp, expected.offPhp);
  assert.equal(r.version.fit.offPhp, offAmount(o, 90000), 'not the Offer Maker’s own sum on the card');
  assert.equal(r.version.fit.offPhp, 10000, '10% of ₱90,000 then ₱1,000 — not the whole ₱110,000 quote');
});

test('the new version = the old lines UNCHANGED + ONE named offer line; the total drops by exactly that line', () => {
  const o = offer({ id: 'S89D-ONE', phpOff: 5000 });
  const r = offerVersion({ ...base, offer: o });
  assert.ok(r.ok);
  assert.deepEqual(r.version.lineItems.slice(0, LINES.length), LINES, 'an old line changed');
  const added = r.version.lineItems.slice(LINES.length);
  assert.equal(added.length, 1);
  assert.equal(added[0]!.offer_id, 'S89D-ONE');
  assert.equal(added[0]!.amount_centavos, -500000);
  assert.equal(r.version.totalCentavos, TOTAL - 500000);
});

test('offers never stack: the same offer twice, or a second offer on the quote, is refused', () => {
  const withOne = [...LINES, { label: 'Early bird', amount_centavos: -100000, offer_id: 'S89D-ONE' }];
  const same = offerVersion({ ...base, lines: withOne, offer: offer({ id: 'S89D-ONE', pctOff: 5 }) });
  assert.ok(!same.ok && /already/i.test(same.reason));
  const other = offerVersion({ ...base, lines: withOne, offer: offer({ id: 'S89D-TWO', pctOff: 5 }) });
  assert.ok(!other.ok && /stack/i.test(other.reason));
});

test('an offer that reaches no line on the quote does not apply', () => {
  const r = offerVersion({ ...base, offer: offer({ pctOff: 10, reachesAll: false, cards: ['card-elsewhere'] }) });
  assert.ok(!r.ok && /doesn.t reach/i.test(r.reason));
});

/* ── 4 · Paid rows fixed ─────────────────────────────────────────────────── */

test('🔒 a PAID plan row keeps its amount; the Final balance absorbs the offer; the plan pays the new total', () => {
  const paidReservation = PLAN.installments.find((r) => r.seq === 0)!.amount_centavos;
  const r = offerVersion({ ...base, offer: offer({ phpOff: 10000 }), paidSeqs: new Set([0]) });
  assert.ok(r.ok, !r.ok ? r.reason : '');
  const plan = r.version.paymentSchedule!;
  assert.equal(plan.installments.find((x) => x.seq === 0)!.amount_centavos, paidReservation, 'a paid row moved');
  assert.equal(plan.installments.reduce((s, x) => s + x.amount_centavos, 0), r.version.totalCentavos, 'the plan does not pay the new total');
  // Unpaid, the same percent row re-splits on the new total — the freeze is what held it above.
  const open = offerVersion({ ...base, offer: offer({ phpOff: 10000 }) });
  assert.ok(open.ok);
  assert.notEqual(open.version.paymentSchedule!.installments.find((x) => x.seq === 0)!.amount_centavos, paidReservation);
});

test('a paid row larger than the new total is refused — never a plan that pays more than the quote', () => {
  const r = resplitPlan(PLAN, 1000 * 100, new Set([0]));
  assert.ok(!r.ok && /paid/i.test(r.reason));
  assert.deepEqual(resplitPlan(null, 5000, new Set()), { ok: true, schedule: null });
});
