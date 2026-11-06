/**
 * 📅 CHECK A DATE — TWO STATES, FROM THE SHOP'S OWN MONTH (owner 2026-10-28 ✅ "index.html approve"; `lib/check-a-date.ts`).
 *
 * Fixture = the approved prototype's: Tita Nena's Catering, today 28 Oct 2026, every Saturday closed (a repeating
 * all-day "Not available"), Christmas Eve/Day closed, one Sunday held — and 15 Nov carries "3 open inquiries" in the
 * prototype's data. There is no input for those here at all, which is the point: 15 Nov reads Available.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDateAnswer, checkDateStateOf, checkDateWindow, checkDateWords, checkADateUrl, checkDateResumeHref, type CheckDateInput } from './check-a-date';

const TODAY = '2026-10-28';
const W = checkDateWindow(TODAY);
const base = (over: Partial<CheckDateInput> = {}): CheckDateInput => ({
  pools: [{ poolId: 'cater', capacity: 1 }],
  bookings: [],
  blocks: [],
  dayStates: [],
  services: [{ serviceId: 'full', poolIds: ['cater'] }],
  months: W.months,
  today: TODAY,
  ...over,
});
const at = (a: { notBookable: string[] }) => ({ notBookable: new Set(a.notBookable), today: TODAY, to: W.to });

test('the window runs from the 1st of this month for 24 months', () => {
  assert.equal(W.from, '2026-10-01');
  assert.equal(W.to, '2028-09-30');
  assert.equal(W.months.length, 24);
});

test('an all-day closure is Not bookable; a morning block leaves the day Available', () => {
  const a = checkDateAnswer(
    base({
      blocks: [
        { poolId: null, source: 'manual', startDate: '2026-11-07', endDate: '2026-11-07', repeat: 'weekly', repeatUntil: null, dayPart: 'all_day' },
        { poolId: null, source: 'manual', startDate: '2026-12-24', endDate: '2026-12-25', repeat: 'once', repeatUntil: null, dayPart: 'all_day' },
        { poolId: null, source: 'manual', startDate: '2026-11-22', endDate: '2026-11-22', repeat: 'once', repeatUntil: null, dayPart: 'morning' },
      ],
    }),
  );
  for (const d of ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-24', '2026-12-25', '2027-02-13']) {
    assert.equal(checkDateStateOf(d, at(a)), 'not_bookable', d);
  }
  assert.equal(checkDateStateOf('2026-11-22', at(a)), 'available', 'a morning Mass leaves the day open');
  assert.equal(checkDateStateOf('2026-11-15', at(a)), 'available', 'a day with open inquiries in the prototype still reads Available');
});

test('full when the "how many a day" is reached — Setnayan bookings and bookings from outside both count', () => {
  const one = checkDateAnswer(base({ bookings: [{ poolId: 'cater', bookedDate: '2026-11-08' }] }));
  assert.equal(checkDateStateOf('2026-11-08', at(one)), 'not_bookable');
  const two = checkDateAnswer(base({ pools: [{ poolId: 'cater', capacity: 2 }], bookings: [{ poolId: 'cater', bookedDate: '2026-11-08' }] }));
  assert.equal(checkDateStateOf('2026-11-08', at(two)), 'available', 'one of two seats taken — still bookable');
  const outside = checkDateAnswer(
    base({
      pools: [{ poolId: 'cater', capacity: 2 }],
      bookings: [{ poolId: 'cater', bookedDate: '2026-11-08' }],
      blocks: [{ poolId: 'cater', source: 'external_client', startDate: '2026-11-08', endDate: '2026-11-08', repeat: 'once', repeatUntil: null, dayPart: 'all_day' }],
    }),
  );
  assert.equal(checkDateStateOf('2026-11-08', at(outside)), 'not_bookable');
});

test("the shop's own hold is Not bookable; approve-first stays Available", () => {
  const a = checkDateAnswer(
    base({
      dayStates: [
        { poolId: null, stateDate: '2026-11-29', dayState: 'locked' },
        { poolId: null, stateDate: '2026-11-30', dayState: 'whitelist' },
      ],
    }),
  );
  assert.equal(checkDateStateOf('2026-11-29', at(a)), 'not_bookable');
  assert.equal(checkDateStateOf('2026-11-30', at(a)), 'available');
});

test('past days and days beyond the window are not answered', () => {
  const a = checkDateAnswer(base());
  assert.equal(checkDateStateOf('2026-10-27', at(a)), null);
  assert.equal(checkDateStateOf('2028-10-01', at(a)), null);
  assert.equal(checkDateStateOf(TODAY, at(a)), 'available');
  assert.ok(a.notBookable.every((d) => d >= TODAY), 'no past day is ever listed');
});

test('separate schedules answer per service; the day closes only when every service is closed', () => {
  const input = base({
    pools: [
      { poolId: 'food', capacity: 1 },
      { poolId: 'sweets', capacity: 1 },
    ],
    services: [
      { serviceId: 'full', poolIds: ['food'] },
      { serviceId: 'dessert', poolIds: ['sweets'] },
    ],
    bookings: [{ poolId: 'food', bookedDate: '2026-11-08' }],
    blocks: [{ poolId: null, source: 'manual', startDate: '2026-11-09', endDate: '2026-11-09', repeat: 'once', repeatUntil: null, dayPart: 'all_day' }],
  });
  const a = checkDateAnswer(input);
  assert.ok(a.perService);
  assert.ok(a.perService?.full?.includes('2026-11-08'));
  assert.ok(!a.perService?.dessert?.includes('2026-11-08'));
  assert.equal(checkDateStateOf('2026-11-08', at(a)), 'available', 'dessert is still free that day');
  assert.equal(checkDateStateOf('2026-11-09', at(a)), 'not_bookable', 'a shop-wide closure closes every service');
  const one = checkDateAnswer(base());
  assert.equal(one.perService, null, 'one schedule answers once');
});

test('a shop with no schedule still honours its typed closures', () => {
  const a = checkDateAnswer(
    base({
      pools: [],
      services: [{ serviceId: 'full', poolIds: [] }],
      blocks: [{ poolId: null, source: 'manual', startDate: '2026-11-11', endDate: '2026-11-11', repeat: 'once', repeatUntil: null, dayPart: 'all_day' }],
    }),
  );
  assert.deepEqual(a.notBookable, ['2026-11-11']);
});

test('words and addresses', () => {
  assert.equal(checkDateWords('2026-11-22'), 'Sun, 22 Nov 2026');
  assert.equal(checkADateUrl('https://setnayan.com/', 'tita-nenas-catering'), 'https://setnayan.com/v/tita-nenas-catering/dates');
  assert.equal(checkDateResumeHref('tita', '2026-11-22', ['a', 'b']), '/v/tita/dates?d=2026-11-22&step=event&s=a%2Cb');
});
