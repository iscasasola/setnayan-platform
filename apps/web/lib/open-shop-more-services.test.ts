/**
 * The step-2 meter, the plan ladder and the posted lists (owner 2026-11-06, prototype v8 → v16 `planFits` /
 * `coverLine` / `LADDER` / `zXEv`): a "category" is the tier-2 Category, each plan holds categories × services per
 * category, every number read from TIER_CAPS.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

import { TIER_CAPS, TIER_LABEL } from '@/lib/vendor-tier-caps';
import {
  FIRST_BOOKING_FREE_LABEL,
  carriesFirstBookingLabel,
  coverageLine,
  eventsForAddedService,
  eventsForService,
  firstPlanThatHolds,
  holdsMoreThanFree,
  offeredAt,
  parseEventListField,
  parseExtraServicesField,
  parseSpecialtiesField,
  planLadder,
  planSplit,
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
  assert.equal(line.verdict, 'Solo covers this');
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

test('past what Free holds, the explainer is due — and its line is the v16 one', () => {
  assert.equal(carriesFirstBookingLabel(rec(2)), true);
  assert.equal(holdsMoreThanFree(rec(1)), false);
  assert.equal(holdsMoreThanFree(rec(2)), true);
  assert.equal(holdsMoreThanFree([...rec(1), acc]), true);
  assert.equal(holdsMoreThanFree([]), false);
  assert.equal(FIRST_BOOKING_FREE_LABEL, 'Your first booking is free once you’re verified');
});

test('the plan is the FIRST where categories AND services per category both fit — read from TIER_CAPS', () => {
  const solo = TIER_CAPS.solo;
  // Solo's categories but one category over Solo's per-category count → the next plan.
  assert.equal(firstPlanThatHolds(rec(solo.servicesPerLeaf)), 'solo');
  assert.equal(firstPlanThatHolds(rec(solo.servicesPerLeaf + 1)), 'pro');
  // One category more than Solo holds, one service each → the next plan.
  const many = Array.from({ length: solo.parentCategories + 1 }, (_, i) => ({ categoryId: `c${i}`, categoryLabel: `C${i}` }));
  assert.equal(firstPlanThatHolds(many), 'pro');
  // Past the top plan: no Custom plan (retired from the app) — the line says what stays after the first booking, in
  // the person's plan word ("Ultra", never "Enterprise"), the number read from TIER_CAPS.
  const past = rec(TIER_CAPS.enterprise.servicesPerLeaf + 1);
  assert.equal(firstPlanThatHolds(past), null);
  assert.equal(
    coverageLine(past).verdict,
    `more than Ultra holds — all on until your first booking, then Ultra keeps ${TIER_CAPS.enterprise.parentCategories} categories you choose`,
  );
  assert.doesNotMatch(coverageLine(past).verdict, /Custom|Talk to us/);
  assert.match(coverageLine(rec(TIER_CAPS.pro.servicesPerLeaf + 1)).verdict, /^Ultra covers this/);
});

test('the ladder (Free · Verified → Solo → Pro → Ultra adds) is composed from TIER_CAPS — no number typed, no peso', () => {
  const l = planLadder();
  assert.deepEqual(
    l.map((r) => r.name),
    ['Free · Verified', 'Solo adds', 'Pro adds', 'Ultra adds'],
  );
  // The prototype's own words, rebuilt from the caps (Free reaches what Verified does once verified).
  assert.equal(
    l[0]!.caps,
    `1 category · 1 service · reach ${TIER_CAPS.verified.serviceRadiusKm} km · basic search listing`,
  );
  assert.equal(
    l[1]!.caps,
    `${TIER_CAPS.solo.parentCategories} categories · ${TIER_CAPS.solo.servicesPerLeaf} per category · reach ${TIER_CAPS.solo.serviceRadiusKm} km · enhanced search`,
  );
  assert.equal(
    l[2]!.caps,
    `${TIER_CAPS.pro.parentCategories} categories · ${TIER_CAPS.pro.servicesPerLeaf} per category · reach ${TIER_CAPS.pro.serviceRadiusKm} km · AI answers can quote your offers`,
  );
  assert.match(l[3]!.caps, /· nationwide · top search priority$/);
  assert.doesNotMatch(JSON.stringify(l), /₱|PHP|\bpeso/i);
  const t = whatEachPlanHolds();
  assert.equal(t.title, 'What each plan adds');
  assert.deepEqual(t.ladder, l);
  assert.equal(t.firstBooking, 'Your first booking is free once you’re verified.');
});

test('④ a service is on for the ticked events it is offered at, minus the ones unticked under that event', () => {
  assert.equal(offeredAt(null, 'wake'), true);
  assert.equal(offeredAt([], 'wake'), true, 'an empty allowed set is no restriction (coverage-allowed-events)');
  assert.equal(offeredAt(['wedding'], 'wake'), false);
  const ticked = ['wedding', 'debut', 'wake'];
  assert.deepEqual(eventsForService('cake', null, ticked, {}), ticked);
  assert.deepEqual(eventsForService('cake', ['wedding', 'debut'], ticked, {}), ['wedding', 'debut']);
  assert.deepEqual(eventsForService('cake', null, ticked, { debut: ['cake'], wake: ['hearse'] }), ['wedding', 'wake']);
  // Offered nowhere it is ticked → on for no event (Continue refuses it).
  assert.deepEqual(eventsForService('tea', ['wedding'], ['debut'], {}), []);
});

test('the posted per-service lists: shape only, malformed reads as nothing', () => {
  assert.equal(parseEventListField(''), null);
  assert.equal(parseEventListField('nope'), null);
  assert.deepEqual(parseEventListField(JSON.stringify(['wedding', 3, ' debut '])), ['wedding', 'debut']);
  assert.deepEqual(parseSpecialtiesField(''), {});
  assert.deepEqual(parseSpecialtiesField('[1]'), {});
  assert.deepEqual(
    parseSpecialtiesField(JSON.stringify({ photography: { shoot: ['Pre-nup', 7], look: [] }, x: 'y' })),
    { photography: { shoot: ['Pre-nup'] } },
  );
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

/* ── v19 · the plan explainer's two columns (owner 7 Nov: "what is deemed free, and the others will be part of pro") */

test('v19 planSplit · Free keeps the main; the holder is the FIRST plan that holds the picks — names and caps from TIER_CAPS', () => {
  const pick = [acc, ...rec(3)]; // two categories, three services in one
  const s = planSplit(pick);
  assert.equal(s.free.name, TIER_LABEL.free);
  const f = TIER_CAPS.free;
  assert.ok(s.free.caps.startsWith(`${f.parentCategories} ${f.parentCategories === 1 ? 'category' : 'categories'}`));
  const holder = (['solo', 'pro', 'enterprise'] as const).find((t) => {
    const c = TIER_CAPS[t];
    return c.parentCategories >= 2 && c.servicesPerLeaf >= 3;
  })!;
  assert.equal(s.held.name, TIER_LABEL[holder]);
  assert.equal(s.held.caps, `${TIER_CAPS[holder].parentCategories} categories · ${TIER_CAPS[holder].servicesPerLeaf} per category`);
  assert.equal(s.held.choose, false);
});

test('v19 planSplit · past the top plan → the top plan, and "you choose which"', () => {
  const top = TIER_CAPS.enterprise;
  const many: MeterService[] = Array.from({ length: top.parentCategories + 1 }, (_, i) => ({ categoryId: `c${i}`, categoryLabel: `C${i}` }));
  const s = planSplit(many);
  assert.equal(s.held.name, TIER_LABEL.enterprise);
  assert.equal(s.held.choose, true);
});

// ── Owner ruling, 13 Nov 2026 (#7549): Free and Verified shops may pick ONE group of services at sign-up, and they may
// also pick SEVERAL. No one-group cap at the pick: every pick stays on until the first booking, then
// `TIER_CAPS.parentCategories` applies. The picker is a METER, never a gate — on both doors that draw it.
test('13 Nov ruling · a Free / Verified shop may pick a second group: the meter names a plan, nothing refuses the pick', () => {
  // Two groups (Food › Catering and Venues › Reception) — more than Free holds when Free holds one category.
  const twoGroups: MeterService[] = [
    { categoryId: 'catering', categoryLabel: 'Catering' },
    { categoryId: 'reception', categoryLabel: 'Reception' },
  ];
  const line = coverageLine(twoGroups);
  assert.equal(line.categories, 2);
  assert.ok(line.verdict.length > 0, 'the meter always says which plan holds the picks');
  // The cap that applies AFTER the first booking is TIER_CAPS', not a typed number.
  assert.equal(TIER_CAPS.verified.parentCategories, TIER_CAPS.free.parentCategories);
  assert.equal(planSplit(twoGroups).free.name, TIER_LABEL.free);

  // No door gates a pick on the plan: the shared picker, the sign-up cards and the dashboard's Add a service never
  // read a plan to refuse — the only plan words they draw come from the meter.
  const WEB = join(__dirname, '..');
  const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
  const PICKER = read('app/_components/service-picker.tsx');
  const ADD = read('app/vendor-dashboard/services/new/_components/add-service-picker.tsx');
  for (const [name, src] of [['service-picker.tsx', PICKER], ['add-service-picker.tsx', ADD]] as const) {
    assert.doesNotMatch(src, /vendor-tier-caps|TIER_CAPS|planHolds|firstPlanThatHolds|parentCategories/, `${name} must not gate a pick on the plan`);
  }
});
