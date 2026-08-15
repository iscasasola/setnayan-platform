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
  canToggleRecur,
  RECUR_CADENCES,
  nextByCadence,
  effectiveCadence,
  resolveCadence,
  cadenceIsForced,
  canRepeat,
  cadencesForType,
  CADENCES_BY_TYPE,
  FALLBACK_ANCHOR,
  milestoneAges,
  parseISO,
  toISO,
  addYears,
  addMonths,
  yearsBetween,
  nextOccurrence,
  nextAnniversary,
  nextMonthsary,
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

test('ANCHOR_BY_TYPE covers all 16 known types', () => {
  const expected = [
    'wedding', 'anniversary', 'debut', 'birthday', 'christening', 'gender_reveal',
    'travel', 'graduation', 'reunion', 'corporate', 'tournament', 'gala_night',
    'celebration', 'simple_event', 'date', 'hangout',
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
  // 🪤 THIS GUARD PASSED FOR A YEAR WHILE THE HOLE WAS OPEN. It searched the
  // origin KEYS for /memorial|death|luksa|passing/ — and the origin that
  // actually reopened the retired territory was called `'matters'` ("A date
  // that matters to us"), which matches none of those words. The 2026-07-12
  // council named that exact value as the leak; the regex could never have
  // caught it. **A deny-list of words is not a guard against a catch-all** —
  // the shape to assert is the ALLOW-LIST, so anything new has to be added here
  // on purpose.
  assert.deepEqual([...ANCHOR_ORIGINS], ['wedding', 'relationship', 'milestone']);
  assert.ok(!ANCHOR_ORIGINS.some((o) => /memorial|death|luksa|passing|matters/i.test(o)));
  for (const o of ANCHOR_ORIGINS) assert.ok(ANCHOR_ORIGIN_LABELS[o]);
  // Every label must be a POSITIVE, specific thing — no open-ended catch-all
  // that a person could answer with a bereavement.
  for (const label of Object.values(ANCHOR_ORIGIN_LABELS)) {
    assert.ok(!/matters|anything|other/i.test(label), `open-ended origin label: "${label}"`);
  }
});

// ── recur toggle eligibility ────────────────────────────────────────────────

test('canToggleRecur: travel/corporate/gala/etc show the yearly toggle', () => {
  // The literal RECUR_TOGGLE_TYPES list is gone — the answer is now DERIVED
  // from CADENCES_BY_TYPE (can repeat, and not forced), so the six that used to
  // be hand-listed are asserted by name and the derivation is asserted below.
  for (const t of ['travel', 'celebration', 'corporate', 'gala_night', 'reunion', 'tournament']) {
    assert.equal(canToggleRecur(t), true, `${t} should still be asked`);
  }
  // Forced types are never asked; one-time types are never asked.
  assert.equal(canToggleRecur('anniversary'), false);
  assert.equal(canToggleRecur('birthday'), false);
  assert.equal(canToggleRecur('wedding'), false);
});

test('canToggleRecur: anniversary/birthday (auto-recur) + one-time types do NOT toggle', () => {
  assert.equal(canToggleRecur('anniversary'), false); // recurs by nature
  assert.equal(canToggleRecur('birthday'), false); // recurs by nature
  assert.equal(canToggleRecur('wedding'), false);
  assert.equal(canToggleRecur('debut'), false);
  assert.equal(canToggleRecur('christening'), false);
  assert.equal(canToggleRecur(null), false);
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

test('nextMonthsary: counts whole months and finds the next occurrence', () => {
  // Anchor Feb 14 2024. On Jul 13 2026 the last monthsary was Jun 14 (28th); the
  // next is Jul 14 2026 (29th).
  assert.deepEqual(nextMonthsary('2024-02-14', '2026-07-13'), { n: 29, dateISO: '2026-07-14' });
  // On the monthsary day itself, that day IS the next one (on-or-after).
  assert.deepEqual(nextMonthsary('2024-02-14', '2026-07-14'), { n: 29, dateISO: '2026-07-14' });
  // The day after rolls to next month.
  assert.deepEqual(nextMonthsary('2024-02-14', '2026-07-15'), { n: 30, dateISO: '2026-08-14' });
});

test('nextMonthsary: clamps day-of-month overflow (31st anchor → short months)', () => {
  // Jan 31 anchor: the Feb monthsary clamps to Feb 28/29.
  assert.equal(nextMonthsary('2024-01-31', '2024-02-01')!.dateISO, '2024-02-29');
  assert.equal(nextMonthsary('2024-01-31', '2024-03-15')!.dateISO, '2024-03-31');
});

// ── the repeat cadence (owner 2026-08-15) ───────────────────────────────────

test('CADENCES_BY_TYPE: the five one-time types can never repeat', () => {
  // A wedding PRODUCES an anniversary; offering it a repeat offers a second
  // wedding. The other four are one per person or one per pregnancy.
  for (const t of ['wedding', 'debut', 'christening', 'gender_reveal', 'graduation']) {
    assert.deepEqual([...cadencesForType(t)], [], `${t} must not repeat`);
    assert.equal(canRepeat(t), false);
    assert.equal(resolveCadence(t, 'annual'), null, `${t} must refuse a posted cadence`);
  }
});

test('birthday and anniversary are annual ONLY, and forced', () => {
  for (const t of ['birthday', 'anniversary']) {
    assert.deepEqual([...cadencesForType(t)], ['annual']);
    assert.equal(cadenceIsForced(t), true);
    // Forced means the posted value is irrelevant — including a hostile one.
    assert.equal(resolveCadence(t, 'weekly'), 'annual');
    assert.equal(resolveCadence(t, null), 'annual');
    assert.equal(resolveCadence(t, 'nonsense'), 'annual');
  }
});

test('a one-cadence type that is NOT forced still has to be chosen', () => {
  // 🪤 The bug I wrote and caught: deriving "forced" from `cadences.length === 1`
  // reads travel and gala_night — ['annual'], meaning *if* it repeats it is
  // yearly — as ALWAYS repeating, turning every one-off trip into an annual one.
  for (const t of ['travel', 'gala_night']) {
    assert.deepEqual([...cadencesForType(t)], ['annual']);
    assert.equal(cadenceIsForced(t), false, `${t} must not be forced`);
    assert.equal(resolveCadence(t, null), null, `${t} defaults to NOT repeating`);
    assert.equal(resolveCadence(t, 'annual'), 'annual');
  }
});

test('an illegal cadence for a type is refused, not clamped', () => {
  assert.equal(resolveCadence('reunion', 'weekly'), null); // reunion is semestral+
  assert.equal(resolveCadence('date', 'annual'), null); // a yearly date is an anniversary
  assert.equal(resolveCadence('gala_night', 'monthly'), null);
  assert.equal(resolveCadence('corporate', 'weekly'), 'weekly'); // the one honest full ladder
});

test('weekly is offered on exactly four types', () => {
  const weekly = Object.keys(CADENCES_BY_TYPE).filter((t) =>
    (CADENCES_BY_TYPE[t] ?? []).includes('weekly'),
  );
  // Weekly + a reminder email is how this becomes spam; the corpus carries an
  // anti-nagging ruling. Pinned so widening it is a decision, not a drift.
  assert.deepEqual(weekly.sort(), ['corporate', 'date', 'hangout', 'simple_event']);
});

test('the legacy checkbox means ANNUAL, never "the first legal cadence"', () => {
  // 🪤 A REAL DEFECT I ALMOST SHIPPED. The create form posts `recurs=on` under
  // the words "Make it a yearly thing", and canToggleRecur('corporate') is true.
  // Mapping that to `allowed[0]` turned every ticked corporate event into a
  // WEEKLY one, because corporate's ladder starts at weekly. Annual is what the
  // person was told they were choosing.
  assert.equal(resolveCadence('travel', 'on'), 'annual');
  assert.equal(resolveCadence('corporate', 'on'), 'annual');
  assert.equal(resolveCadence('simple_event', 'on'), 'annual');
  assert.equal(resolveCadence('reunion', 'on'), 'annual');
  // ⚠ AND A TYPE WITH NO ANNUAL RUNG GETS NOTHING, not a guess. Falling back to
  // the coarsest legal cadence stored MONTHLY for a `date`/`hangout` under a box
  // that says "yearly" — answering "yes, yearly" and getting a monthly repeat is
  // worse than getting none. Those two types are no longer ASKED the yes/no
  // question at all (canToggleRecur requires an annual rung); this is the other
  // half of that rule.
  assert.equal(resolveCadence('date', 'on'), null);
  assert.equal(resolveCadence('hangout', 'on'), null);
  assert.equal(canToggleRecur('date'), false);
  assert.equal(canToggleRecur('hangout'), false);
  assert.equal(resolveCadence('wedding', 'on'), null);
});

test('effectiveCadence: a row written before the cadence existed reads as annual', () => {
  // No backfill was run, deliberately — this is what makes that safe.
  assert.equal(effectiveCadence(true, null), 'annual');
  assert.equal(effectiveCadence(true, undefined), 'annual');
  assert.equal(effectiveCadence(true, 'monthly'), 'monthly');
  assert.equal(effectiveCadence(true, 'garbage'), 'annual');
  // recurs=false means it does not repeat, whatever is stored beside it.
  assert.equal(effectiveCadence(false, 'weekly'), null);
  assert.equal(effectiveCadence(null, 'weekly'), null);
});

test('nextByCadence: every cadence steps off the ANCHOR, not off today', () => {
  const anchor = '2026-01-15';
  // Stepping from today would silently re-phase the series on every read.
  assert.equal(nextByCadence(anchor, 'annual', '2026-08-15'), '2027-01-15');
  // 2026-08-15 IS itself a monthly occurrence of a Jan-15 anchor (same day of
  // month), and "on or after" means today counts — my first expectation here
  // was wrong and the function was right.
  assert.equal(nextByCadence(anchor, 'monthly', '2026-08-15'), '2026-08-15');
  assert.equal(nextByCadence(anchor, 'monthly', '2026-08-16'), '2026-09-15');
  assert.equal(nextByCadence(anchor, 'quarterly', '2026-08-15'), '2026-10-15');
  assert.equal(nextByCadence(anchor, 'semestral', '2026-08-15'), '2027-01-15');
  // Weekly lands on the anchor's weekday, always.
  const w = nextByCadence(anchor, 'weekly', '2026-08-15');
  assert.ok(w && w > '2026-08-15');
  assert.equal(
    new Date(`${w}T00:00:00Z`).getUTCDay(),
    new Date(`${anchor}T00:00:00Z`).getUTCDay(),
    'a weekly repeat must keep its weekday',
  );
});

test('nextByCadence: on the day itself returns today, not the next step', () => {
  assert.equal(nextByCadence('2026-01-15', 'monthly', '2026-09-15'), '2026-09-15');
  assert.equal(nextByCadence('2026-01-15', 'weekly', '2026-01-15'), '2026-01-15');
  assert.equal(nextByCadence('2026-01-15', 'annual', '2026-01-15'), '2026-01-15');
});

test('nextByCadence: month-end anchors clamp instead of skidding into next month', () => {
  // Jan 31 monthly must not become Mar 3. addMonths already clamps; this pins
  // that the cadence path actually uses it.
  assert.equal(nextByCadence('2026-01-31', 'monthly', '2026-02-01'), '2026-02-28');
  assert.equal(nextByCadence('2024-01-31', 'monthly', '2024-02-01'), '2024-02-29'); // leap
  assert.equal(nextByCadence('2026-08-31', 'monthly', '2026-09-01'), '2026-09-30');
});

test('nextByCadence: a far-past anchor still resolves and does not spin', () => {
  const r = nextByCadence('1990-03-07', 'quarterly', '2026-08-15');
  assert.ok(r && r >= '2026-08-15', `expected a future date, got ${r}`);
  assert.equal(nextByCadence('bad-date', 'monthly', '2026-08-15'), null);
});

test('🚨 an occurrence can never precede the thing that recurs', () => {
  // A gala booked for 2027-11-05 was appearing on the Year view on 2026-11-05,
  // labelled "Every year · in 82 days" — a countdown to a date the event is not
  // on, twelve months early. `nextOccurrence` builds its candidate in FROM's
  // year and only bumps when that is strictly earlier than `from`, so an anchor
  // more than a year out returns this year's month/day.
  //
  // Annual was the ONLY cadence that could go backwards: the other four step
  // forward from the anchor. Measured by brute-forcing millions of anchor/from
  // pairs against a naive step-from-anchor reference.
  assert.equal(nextByCadence('2027-11-05', 'annual', '2026-08-15'), '2027-11-05');
  assert.equal(nextByCadence('2028-02-29', 'annual', '2026-08-15'), '2028-02-29');
  // The clamp must not disturb a PAST anchor, which is the ordinary case.
  assert.equal(nextByCadence('2000-12-25', 'annual', '2026-08-15'), '2026-12-25');
  assert.equal(nextByCadence('2024-03-01', 'annual', '2026-08-15'), '2027-03-01');
  // And no cadence may ever return a date before its anchor.
  for (const c of RECUR_CADENCES) {
    const r = nextByCadence('2027-11-05', c, '2026-08-15');
    if (r) assert.ok(r >= '2027-11-05', `${c} returned ${r}, before its anchor`);
  }
});
