/**
 * The step-2 meter and the posted list (owner 2026-11-06, prototype v8 `planFits` / `coverLine`): a "category" is the
 * tier-2 Category, each plan holds categories × services per category, every number read from TIER_CAPS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import {
  FIRST_BOOKING_FREE_LABEL,
  carriesFirstBookingLabel,
  coverageLine,
  eventsForAddedService,
  firstPlanThatHolds,
  parseExtraServicesField,
  whatEachPlanHolds,
  type MeterService,
} from '@/lib/open-shop-more-services';

const rec = (n: number): MeterService[] => Array.from({ length: n }, () => ({ categoryId: 'reception', categoryLabel: 'Reception' }));
const acc: MeterService = { categoryId: 'accommodation', categoryLabel: 'Accommodation' };

test('the owner’s own example: four Reception venues + a hotel is NOT "Free and Verified" — Solo, split per category', () => {
  // v7 read "1 category · 4 services — Free and Verified cover this" for four venues; the owner: "the rule is wrong".
  const four = rec(4);
  assert.notEqual(firstPlanThatHolds(four), 'free');
  const line = coverageLine([...rec(3), acc]);
  assert.equal(line.tally, '2 categories · 4 services');
  assert.equal(line.verdict, 'Solo covers this — free until your first booking on Setnayan is done');
  assert.equal(line.split, 'Reception 3 · Accommodation 1');
});

test('one service: Free and Verified cover this, no split line, no label', () => {
  const line = coverageLine(rec(1));
  assert.equal(line.tally, '1 category · 1 service');
  assert.equal(line.verdict, 'Free and Verified cover this');
  assert.equal(line.split, null);
  assert.equal(carriesFirstBookingLabel(rec(1)), false);
  // Verified holds what Free holds — the line names both because the caps are the same.
  assert.equal(TIER_CAPS.free.parentCategories, TIER_CAPS.verified.parentCategories);
  assert.equal(TIER_CAPS.free.servicesPerLeaf, TIER_CAPS.verified.servicesPerLeaf);
});

test('every service after the first carries the label — Free and Verified hold one service', () => {
  assert.equal(carriesFirstBookingLabel(rec(2)), true);
  assert.equal(FIRST_BOOKING_FREE_LABEL, 'Free until your first booking on Setnayan is done');
});

test('the plan is the FIRST where categories AND services per category both fit — read from TIER_CAPS', () => {
  const solo = TIER_CAPS.solo;
  // Solo's categories but one category over Solo's per-category count → the next plan.
  assert.equal(firstPlanThatHolds(rec(solo.servicesPerLeaf)), 'solo');
  assert.equal(firstPlanThatHolds(rec(solo.servicesPerLeaf + 1)), 'pro');
  // One category more than Solo holds, one service each → the next plan.
  const many = Array.from({ length: solo.parentCategories + 1 }, (_, i) => ({ categoryId: `c${i}`, categoryLabel: `C${i}` }));
  assert.equal(firstPlanThatHolds(many), 'pro');
  // Past the top plan → Custom, said in the person's plan word ("Ultra", never "Enterprise").
  const past = rec(TIER_CAPS.enterprise.servicesPerLeaf + 1);
  assert.equal(firstPlanThatHolds(past), null);
  assert.match(coverageLine(past).verdict, /^more than Ultra holds — Custom plan \(Talk to us\)$/);
  assert.match(coverageLine(rec(TIER_CAPS.pro.servicesPerLeaf + 1)).verdict, /^Ultra covers this/);
});

test('the ⓘ composes "What each plan holds" from TIER_CAPS', () => {
  const t = whatEachPlanHolds();
  assert.equal(t.title, 'What each plan holds');
  assert.equal(
    t.plans,
    `Free and Verified: 1 service · Solo: ${TIER_CAPS.solo.parentCategories} categories, ${TIER_CAPS.solo.servicesPerLeaf} services each · ` +
      `Pro: ${TIER_CAPS.pro.parentCategories} categories, ${TIER_CAPS.pro.servicesPerLeaf} each · ` +
      `Ultra: ${TIER_CAPS.enterprise.parentCategories} categories, ${TIER_CAPS.enterprise.servicesPerLeaf} each.`,
  );
  assert.equal(t.firstBooking, 'Your first booking from Setnayan is on us.');
});

test('the posted list: shape only, malformed adds nothing', () => {
  assert.deepEqual(parseExtraServicesField(''), []);
  assert.deepEqual(parseExtraServicesField('not json'), []);
  assert.deepEqual(parseExtraServicesField('{"service":"x"}'), []);
  assert.deepEqual(parseExtraServicesField(null), []);
  assert.deepEqual(
    parseExtraServicesField(JSON.stringify([{ service: ' hotel ', events: null }, { service: 'resort', events: ['wedding', 3] }, { nope: 1 }])),
    [
      { service: 'hotel', events: null },
      { service: 'resort', events: ['wedding'] },
    ],
  );
});

test('an added service’s events: roster ∩ its allowed set; ticked NOTHING the roster knows → null (refused)', () => {
  const roster = new Set(['wedding', 'debut', 'birthday']);
  assert.deepEqual(eventsForAddedService(['wedding', 'debut', 'ghost'], roster, null), ['wedding', 'debut']);
  assert.deepEqual(eventsForAddedService(['wedding', 'debut'], roster, ['debut']), ['debut']);
  assert.equal(eventsForAddedService([], roster, null), null);
  assert.equal(eventsForAddedService(['ghost'], roster, null), null);
  // The allowed set removes everything ticked → its first allowed event, as the coverage editor does.
  assert.deepEqual(eventsForAddedService(['wedding'], roster, ['birthday']), ['birthday']);
});
