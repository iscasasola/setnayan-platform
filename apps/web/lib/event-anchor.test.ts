/**
 * Unit suite for the date-anchor derivation engine. Load-bearing invariants:
 * the PH milestone ladder (1/7/18F-21M/60) resolves correctly per sex, annual
 * recurrence and Nth-anniversary math hold across year/leap-day boundaries, and
 * the authored lead-time ladder (§ 4c) — including the December override —
 * produces the right heads-up / begin-planning dates. Pure in, pure out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  anchorForType,
  ANCHOR_BY_TYPE,
  ANCHOR_ORIGINS,
  ANCHOR_ORIGIN_LABELS,
  isAnchorOrigin,
  FALLBACK_ANCHOR,
  milestoneAges,
  parseISO,
  toISO,
  addYears,
  addMonths,
  yearsBetween,
  nextOccurrence,
  nextAnniversary,
  nextMilestone,
  nextBirthday,
  leadTimeFor,
  nudgePlan,
} from './event-anchor';

// ── per-type anchor defaults ────────────────────────────────────────────────

test('anchorForType: wedding is the anchor producer (none/output)', () => {
  assert.deepEqual(anchorForType('wedding'), { kind: 'none', dateModel: 'output' });
});

test('anchorForType: birthday & debut derive from a person birthdate', () => {
  assert.equal(anchorForType('birthday').kind, 'person_birthdate');
  assert.equal(anchorForType('debut').kind, 'person_birthdate');
  assert.equal(anchorForType('debut').dateModel, 'input');
});

test('anchorForType: christening is birthdate-anchored but date is an output', () => {
  assert.deepEqual(anchorForType('christening'), { kind: 'person_birthdate', dateModel: 'output' });
});

test('anchorForType: anniversary consumes a union date; travel is a range', () => {
  assert.equal(anchorForType('anniversary').kind, 'union_date');
  assert.equal(anchorForType('travel').kind, 'date_range');
});

test('anchorForType: unknown/admin type falls back to a chosen fixed date', () => {
  assert.deepEqual(anchorForType('pet_adoption'), FALLBACK_ANCHOR);
  assert.deepEqual(anchorForType(null), FALLBACK_ANCHOR);
  assert.deepEqual(anchorForType(undefined), FALLBACK_ANCHOR);
});

test('ANCHOR_BY_TYPE covers all 14 known types', () => {
  const expected = [
    'wedding', 'anniversary', 'debut', 'birthday', 'christening', 'gender_reveal',
    'travel', 'graduation', 'reunion', 'corporate', 'tournament', 'gala_night',
    'celebration', 'simple_event',
  ];
  assert.deepEqual(Object.keys(ANCHOR_BY_TYPE).sort(), [...expected].sort());
});

// ── anniversary typed origins (positive only) ───────────────────────────────

test('isAnchorOrigin: accepts the four positive origins, rejects everything else', () => {
  for (const o of ANCHOR_ORIGINS) assert.equal(isAnchorOrigin(o), true);
  assert.equal(isAnchorOrigin('memorial'), false);
  assert.equal(isAnchorOrigin('death'), false);
  assert.equal(isAnchorOrigin('babang_luksa'), false);
  assert.equal(isAnchorOrigin(''), false);
  assert.equal(isAnchorOrigin(null), false);
  assert.equal(isAnchorOrigin(undefined), false);
});

test('ANCHOR_ORIGINS: no memorial/death option exists (babang-luksa guardrail)', () => {
  assert.equal(ANCHOR_ORIGINS.length, 4);
  assert.ok(!ANCHOR_ORIGINS.some((o) => /memorial|death|luksa|passing/i.test(o)));
  for (const o of ANCHOR_ORIGINS) assert.ok(ANCHOR_ORIGIN_LABELS[o]);
});

// ── the milestone ladder ────────────────────────────────────────────────────

test('milestoneAges: female = 18 debut, male = 21 debut, unknown = both', () => {
  assert.deepEqual(milestoneAges('female'), [1, 7, 18, 60]);
  assert.deepEqual(milestoneAges('male'), [1, 7, 21, 60]);
  assert.deepEqual(milestoneAges(null), [1, 7, 18, 21, 60]);
});

test('nextMilestone: a 6-year-old girl next hits the lucky 7th', () => {
  const m = nextMilestone('2019-09-21', 'female', '2026-07-12');
  assert.deepEqual(m, { age: 7, dateISO: '2026-09-21', tier: 'milestone' });
});

test('nextMilestone: after the 7th, a girl next hits the 18th debut (grand)', () => {
  const m = nextMilestone('2019-09-21', 'female', '2026-09-22');
  assert.deepEqual(m, { age: 18, dateISO: '2037-09-21', tier: 'grand' });
});

test('nextMilestone: a boy debuts at 21, not 18', () => {
  const m = nextMilestone('2008-11-02', 'male', '2027-01-01');
  assert.deepEqual(m, { age: 21, dateISO: '2029-11-02', tier: 'grand' });
});

test('nextMilestone: sex unknown offers both 18 and 21', () => {
  const at18 = nextMilestone('2008-11-02', null, '2026-01-01');
  assert.equal(at18?.age, 18);
  const at21 = nextMilestone('2008-11-02', null, '2026-11-03');
  assert.equal(at21?.age, 21);
});

test('nextMilestone: an elder past 60 has no ladder milestone left', () => {
  assert.equal(nextMilestone('1950-03-03', 'male', '2026-07-12'), null);
});

test('nextMilestone: the 60th is grand', () => {
  const m = nextMilestone('1967-03-03', null, '2026-07-12');
  assert.deepEqual(m, { age: 60, dateISO: '2027-03-03', tier: 'grand' });
});

// ── recurrence + anniversary math ───────────────────────────────────────────

test('nextOccurrence: rolls to next year when the date has passed', () => {
  assert.equal(nextOccurrence('1996-08-30', '2026-09-01'), '2027-08-30');
  assert.equal(nextOccurrence('1996-08-30', '2026-08-01'), '2026-08-30');
});

test('nextOccurrence: same-day returns today (on or after)', () => {
  assert.equal(nextOccurrence('1996-08-30', '2026-08-30'), '2026-08-30');
});

test('nextOccurrence: Feb 29 anchor lands Feb 28 in a non-leap year', () => {
  assert.equal(nextOccurrence('2000-02-29', '2026-01-01'), '2026-02-28');
  assert.equal(nextOccurrence('2000-02-29', '2028-01-01'), '2028-02-29');
});

test('nextAnniversary: Nth is years since the union date', () => {
  assert.deepEqual(nextAnniversary('2026-01-17', '2026-06-01'), { n: 1, dateISO: '2027-01-17' });
  assert.deepEqual(nextAnniversary('2026-01-17', '2050-06-01'), { n: 25, dateISO: '2051-01-17' });
});

test('nextBirthday: reports the age the person turns', () => {
  assert.deepEqual(nextBirthday('2019-09-21', '2026-07-12'), { age: 7, dateISO: '2026-09-21' });
});

// ── the authored lead-time ladder (§ 4c) ────────────────────────────────────

test('leadTimeFor: debut is grand, 12mo heads-up / 9mo begin', () => {
  assert.deepEqual(leadTimeFor('debut'), { tier: 'grand', headsUpMonths: 12, beginMonths: 9 });
});

test('leadTimeFor: the 60th pulls earlier than a lucky-7 (balikbayan flights)', () => {
  assert.deepEqual(leadTimeFor('birthday', 60), { tier: 'grand', headsUpMonths: 9, beginMonths: 6 });
  assert.deepEqual(leadTimeFor('birthday', 7), { tier: 'milestone', headsUpMonths: 5, beginMonths: 3 });
});

test('leadTimeFor: an ordinary birthday is light', () => {
  assert.equal(leadTimeFor('birthday').tier, 'light');
  assert.equal(leadTimeFor('birthday', 30).tier, 'light');
});

test('leadTimeFor: silver/golden anniversaries are grand; the 1st is standard', () => {
  assert.equal(leadTimeFor('anniversary', 25).tier, 'grand');
  assert.equal(leadTimeFor('anniversary', 50).tier, 'grand');
  assert.equal(leadTimeFor('anniversary', 1).tier, 'standard');
  assert.equal(leadTimeFor('anniversary', 12).tier, 'light');
});

test('leadTimeFor: wedding has no anchor nudge (venue-first)', () => {
  assert.deepEqual(leadTimeFor('wedding'), { tier: 'none', headsUpMonths: 0, beginMonths: 0 });
});

test('nudgePlan: heads-up and begin land the right offsets before the event', () => {
  const plan = nudgePlan('2027-09-21', leadTimeFor('birthday', 7)); // 5mo heads-up / 3mo begin
  assert.equal(plan?.headsUpISO, '2027-04-21');
  assert.equal(plan?.beginISO, '2027-06-21');
  assert.equal(plan?.tier, 'milestone');
});

test('nudgePlan: DECEMBER OVERRIDE pulls both nudges ~6 weeks earlier', () => {
  // a standard Dec 20 event: 2mo heads-up would be Oct 20, minus 42 days
  const plan = nudgePlan('2027-12-20', leadTimeFor('corporate'));
  assert.equal(plan?.headsUpISO, '2027-09-08'); // Oct 20 − 42d
  // and a non-December event is NOT shifted
  const june = nudgePlan('2027-06-20', leadTimeFor('corporate'));
  assert.equal(june?.headsUpISO, '2027-04-20');
});

// ── date helpers ────────────────────────────────────────────────────────────

test('parseISO: rejects malformed and rolled-over dates', () => {
  assert.equal(parseISO('2026-02-31'), null);
  assert.equal(parseISO('not-a-date'), null);
  assert.equal(parseISO('2026-13-01'), null);
  assert.equal(parseISO(null), null);
  assert.equal(toISO(parseISO('2026-07-12')!), '2026-07-12');
});

test('addYears: clamps Feb 29 to Feb 28 in a non-leap target', () => {
  assert.equal(toISO(addYears(parseISO('2024-02-29')!, 1)), '2025-02-28');
  assert.equal(toISO(addYears(parseISO('2024-02-29')!, 4)), '2028-02-29');
});

test('addMonths: clamps day overflow to the month end', () => {
  assert.equal(toISO(addMonths(parseISO('2026-01-31')!, 1)), '2026-02-28');
});

test('yearsBetween: birthday-accurate age', () => {
  assert.equal(yearsBetween(parseISO('2000-07-12')!, parseISO('2026-07-12')!), 26);
  assert.equal(yearsBetween(parseISO('2000-07-13')!, parseISO('2026-07-12')!), 25);
});
