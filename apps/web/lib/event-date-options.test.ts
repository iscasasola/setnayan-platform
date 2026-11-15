/**
 * 📅 THE DATE EDIT'S RULES (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED — HOW MANY DAYS? FIRST ·
 * N-DAY OPTIONS · EXACT DATE CAN BE A RANGE · ONE CITY OR AREA"; prototype `event_dates_edit_2026-11-13`).
 *
 * The pure half: the stepper's cap, the N-day options, the shared-day offer (owner addition 1) and its words — never
 * "days that don't touch" (owner addition 2: side-by-side options are ALLOWED; the rule is "don't share a day").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asksHowManyDays,
  clampDays,
  dateOptionsFactWords,
  dateOptionsRefusal,
  droppedLine,
  keepOptionsForDays,
  optionHolding,
  optionOverlapping,
  optionWords,
  sharesDayLine,
  sharesDayOffer,
} from './event-date-options';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

test('the stepper is capped by the type’s max_days — 1 … max, and a 1-day type is never asked', () => {
  assert.equal(clampDays(9, 7), 7, 'a birthday (max 7) cannot reach 9');
  assert.equal(clampDays(14, 30), 14, 'travel (max 30) holds 14');
  assert.equal(clampDays(31, 30), 30);
  assert.equal(clampDays(0, 7), 1, 'the minimum is always 1');
  assert.equal(clampDays(5, 1), 1, 'a 1-day type stays 1');
  assert.equal(asksHowManyDays(1), false, 'a gala night shows no step');
  assert.equal(asksHowManyDays(7), true);
  assert.equal(asksHowManyDays(30), true);
});

test('the server refuses a day count past the type’s cap', () => {
  const base = { mode: 'specific' as const, candidates: ['2027-01-09'], windowStart: null, windowEnd: null };
  assert.equal(dateOptionsRefusal({ ...base, days: 7, maxDays: 7 }), null);
  assert.match(dateOptionsRefusal({ ...base, days: 8, maxDays: 7 }) ?? '', /up to 7 days/);
  assert.match(dateOptionsRefusal({ ...base, days: 2, maxDays: 1 }) ?? '', /one day/);
});

test('an N-day option is N consecutive days from its start; a tap inside one finds it', () => {
  assert.equal(optionHolding(['2026-12-19'], '2026-12-21', 3), '2026-12-19');
  assert.equal(optionHolding(['2026-12-19'], '2026-12-22', 3), null);
  assert.equal(optionWords('2026-12-19', 3), 'Sat Dec 19 – Mon Dec 21');
  assert.equal(optionWords('2026-12-19', 1), 'Dec 19');
});

test('owner addition 2 — options SIDE BY SIDE are allowed; only a SHARED day is refused', () => {
  // Sat Dec 19 – Mon Dec 21 and Tue Dec 22 – Thu Dec 24 touch, and that is fine.
  assert.equal(optionOverlapping(['2026-12-19'], '2026-12-22', 3), null, 'a touching option was treated as overlapping');
  assert.equal(
    dateOptionsRefusal({ mode: 'specific', candidates: ['2026-12-19', '2026-12-22'], windowStart: null, windowEnd: null, days: 3, maxDays: 7 }),
    null,
  );
  assert.equal(optionOverlapping(['2026-12-19'], '2026-12-21', 3), '2026-12-19');
  const refused = dateOptionsRefusal({ mode: 'specific', candidates: ['2026-12-19', '2026-12-21'], windowStart: null, windowEnd: null, days: 3, maxDays: 7 });
  assert.match(refused ?? '', /shares a day with/);
  // The words never say "touch" anywhere — in the rules module, or in the calendar that draws them.
  for (const line of [refused ?? '', sharesDayLine('2026-12-21', '2026-12-19', 3), droppedLine(1, 3) ?? '']) {
    assert.doesNotMatch(line, /touch/i, `"${line}" says touch — touching options are allowed`);
  }
  for (const f of [join(__dirname, 'event-date-options.ts'), join(__dirname, '..', 'app', 'onboarding', '_shared', 'date-calendar.tsx')]) {
    const code = stripComments(readFileSync(f, 'utf8'));
    assert.doesNotMatch(code, /don.t touch/i, `${f} still says "don't touch"`);
  }
});

test('owner addition 1 — a shared day is offered as a window from the earlier start to the later start', () => {
  const one = sharesDayOffer('2026-12-21', '2026-12-19', 3, 1);
  assert.equal(
    one.line,
    'Mon Dec 21 – Wed Dec 23 shares a day with Sat Dec 19 – Mon Dec 21. Make it a window: a 3-day event starting Dec 19 – Dec 21?',
  );
  assert.equal(one.windowStart, '2026-12-19');
  assert.equal(one.windowEnd, '2026-12-21');
  // An earlier tap: the window still runs earlier → later.
  const earlier = sharesDayOffer('2026-12-18', '2026-12-19', 3, 1);
  assert.equal(earlier.windowStart, '2026-12-18');
  assert.equal(earlier.windowEnd, '2026-12-19');
  // Other options set → it says they are replaced.
  assert.match(sharesDayOffer('2026-12-21', '2026-12-19', 3, 2).line, / This replaces your other option\.$/);
  assert.match(sharesDayOffer('2026-12-21', '2026-12-19', 3, 4).line, / This replaces your other 3 options\.$/);
});

test('a new N drops the options that would now share a day, and says how many', () => {
  const r = keepOptionsForDays(['2026-12-19', '2026-12-22', '2027-01-09'], 4);
  assert.deepEqual(r.kept, ['2026-12-19', '2027-01-09']);
  assert.equal(r.dropped, 1);
  assert.equal(droppedLine(1, 4), '1 option removed — at 4 days they shared a day.');
  assert.equal(droppedLine(0, 4), null);
});

test('a window ≤ 30 days; four options at most', () => {
  assert.equal(dateOptionsRefusal({ mode: 'window', candidates: [], windowStart: '2026-12-19', windowEnd: '2027-01-17', days: 3, maxDays: 7 }), null);
  assert.match(dateOptionsRefusal({ mode: 'window', candidates: [], windowStart: '2026-12-19', windowEnd: '2027-01-18', days: 3, maxDays: 7 }) ?? '', /30 days/);
  assert.match(
    dateOptionsRefusal({ mode: 'specific', candidates: ['2027-01-02', '2027-01-09', '2027-01-16', '2027-01-23', '2027-01-30'], windowStart: null, windowEnd: null, days: 1, maxDays: 7 }) ?? '',
    /up to 4/,
  );
});

test('the date · place line reads the options as the prototype does', () => {
  assert.equal(
    dateOptionsFactWords({ mode: 'specific', candidates: ['2027-01-09', '2026-12-19'], windowStart: null, windowEnd: null, days: 3 }),
    '3 days · 2 options · Dec 19 – Jan 11',
  );
  assert.equal(
    dateOptionsFactWords({ mode: 'specific', candidates: ['2026-12-19', '2026-12-26', '2027-01-02', '2027-01-09'], windowStart: null, windowEnd: null, days: 1 }),
    '4 dates · Dec 19 – Jan 9',
  );
  assert.equal(dateOptionsFactWords({ mode: 'window', candidates: [], windowStart: '2026-12-19', windowEnd: '2027-01-02', days: 1 }), 'Dec 19 – Jan 2');
  assert.equal(dateOptionsFactWords({ mode: 'specific', candidates: [], windowStart: null, windowEnd: null, days: 1 }), null);
});
