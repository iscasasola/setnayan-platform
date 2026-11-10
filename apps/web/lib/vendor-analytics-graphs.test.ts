/**
 * 🔒 THE FIVE NEW ANALYTICS GRAPHS (Build 6 Lane I) — each counts what its rows say, names its data, and an unread
 * graph says "Couldn’t load" (never a zero). The reads' two-client shape is pinned at the bottom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GRAPH_SOURCE,
  cardSellLine,
  cardSells,
  lostDates,
  lostLine,
  monthsAhead,
  quoteStates,
  quotesLine,
  replyVsBooked,
  replyVsLine,
  slowLine,
  slowMonth,
  weekdayIndex,
} from './vendor-analytics-graphs';
import { buildGrowthRecs } from './vendor-growth-recs';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

test('weekdays are Monday-first and time-zone free', () => {
  assert.equal(weekdayIndex('2026-11-09'), 0); // Monday
  assert.equal(weekdayIndex('2026-11-14'), 5); // Saturday
  assert.equal(weekdayIndex('2026-11-15'), 6); // Sunday
});

test('a · an ask lands on closed when the calendar closed that date, else full', () => {
  const l = lostDates(
    [{ date: '2026-11-14' }, { date: '2026-11-14' }, { date: '2026-11-21' }, { date: '2026-11-13' }],
    new Set(['2026-11-14']),
  );
  assert.equal(l.closed, 2);
  assert.equal(l.full, 2);
  assert.deepEqual(l.byWeekday[5], { closed: 2, full: 1 }); // Saturdays
  assert.deepEqual(l.byWeekday[4], { closed: 0, full: 1 }); // Friday
  assert.equal(l.topClosedDay, 'Saturday');
  assert.match(lostLine(l), /^4 asks you couldn’t take \(2 closed, 2 full\) · most on 3 Sat, 1 Fri/);
  assert.equal(lostLine(lostDates([], new Set())), 'No couple has asked for a date you couldn’t take.');
  assert.equal(lostLine(null), 'Couldn’t load.');
});

test('b · asked counts every card a row names; booked only a booked row on its card', () => {
  const c = cardSells(
    [
      { serviceId: 'a', name: 'Full day' },
      { serviceId: 'b', name: 'Half day' },
    ],
    [
      { serviceId: null, requested: ['a', 'b'], booked: false },
      { serviceId: 'a', requested: ['a'], booked: true },
      { serviceId: 'b', requested: [], booked: false },
      { serviceId: 'zz', requested: ['zz'], booked: true }, // a card that is not this shop's — ignored
    ],
  );
  assert.deepEqual(c, [
    { serviceId: 'a', name: 'Full day', asked: 2, booked: 1 },
    { serviceId: 'b', name: 'Half day', asked: 2, booked: 0 },
  ]);
  assert.equal(cardSellLine(c), 'Full day is asked about most: 2 asked, 1 booked.');
  assert.equal(cardSellLine([]), 'No couple has asked about a card yet.');
  assert.equal(cardSellLine(null), 'Couldn’t load.');
});

test('c · answered inquiries split at the hour; unanswered ones have no reply time and are left out', () => {
  const r = replyVsBooked(
    [
      { eventId: 'e1', createdAt: '2026-11-01T00:00:00Z', firstReplyAt: '2026-11-01T00:30:00Z' },
      { eventId: 'e2', createdAt: '2026-11-01T00:00:00Z', firstReplyAt: '2026-11-01T01:00:00Z' },
      { eventId: 'e3', createdAt: '2026-11-01T00:00:00Z', firstReplyAt: '2026-11-01T03:00:00Z' },
      { eventId: 'e4', createdAt: '2026-11-01T00:00:00Z', firstReplyAt: null },
    ],
    new Set(['e1', 'e4']),
  );
  assert.deepEqual(r, { fast: { n: 2, booked: 1 }, slow: { n: 1, booked: 0 } });
  assert.equal(replyVsLine(r), 'Couples you answered within the hour booked 1 of 2; the ones you answered later, 0 of 1.');
  assert.equal(replyVsLine(null), 'Couldn’t load.');
});

test('d · the slow month is a gap between booked months — never "slow" against an empty calendar', () => {
  const months = monthsAhead(['2026-12-05', '2026-12-12', '2027-01-09', '2027-03-06', '2027-03-13'], '2026-11-10');
  assert.equal(months.length, 12);
  assert.equal(months[0]!.key, '2026-11-01');
  const s = slowMonth(months);
  assert.ok(s);
  assert.equal(s.name, 'February');
  assert.equal(s.lastDay, '2027-02-28');
  assert.equal(slowLine(months), 'February has nothing booked while the months beside it have 2.');
  const empty = monthsAhead([], '2026-11-10');
  assert.equal(slowMonth(empty), null);
  assert.equal(slowLine(empty), 'Nothing booked in the next 12 months yet.');
  assert.equal(slowLine(null), 'Couldn’t load.');
});

test('e · a sent quotation past Valid until is expired before any writer flips it; a legacy one never lapses', () => {
  const q = quoteStates(
    [
      { status: 'accepted', validUntil: '2026-01-01', legacy: false },
      { status: 'sent', validUntil: '2026-11-01', legacy: false },
      { status: 'viewed', validUntil: '2026-12-01', legacy: false },
      { status: 'sent', validUntil: null, legacy: true },
      { status: 'expired', validUntil: '2026-10-01', legacy: false },
      { status: 'declined', validUntil: null, legacy: false },
      { status: 'draft', validUntil: null, legacy: false },
      { status: 'superseded', validUntil: null, legacy: false },
    ],
    '2026-11-10',
  );
  assert.deepEqual(q, { accepted: 1, waiting: 2, expired: 2, declined: 1, sent: 6 });
  assert.equal(quotesLine(q), '2 waiting on an answer · 2 expired · 1 of 6 accepted.');
  assert.equal(quotesLine({ accepted: 0, waiting: 0, expired: 0, declined: 0, sent: 0 }), 'No quotation sent yet.');
  assert.equal(quotesLine(null), 'Couldn’t load.');
});

test('every new graph names its data before it is drawn', () => {
  for (const [k, v] of Object.entries(GRAPH_SOURCE)) assert.ok(v.startsWith('Counts'), `${k} must say what it counts`);
});

test('the five new rules fire only on a number their graph shows — absent or unread fires nothing', () => {
  const none = buildGrowthRecs(null, { askedInWindow: 0 }).map((r) => r.key);
  for (const k of ['open_lost_dates', 'add_team', 'offer_on_card', 'offer_for_month', 'requote_expired']) assert.ok(!none.includes(k as never), k);

  const unread = buildGrowthRecs(null, { askedInWindow: 0, lostDates: null, slowMonth: null, expiredQuotes: null, quietCard: null }).map((r) => r.key);
  assert.deepEqual(unread, none);

  const fired = buildGrowthRecs(null, {
    askedInWindow: 0,
    lostDates: { closed: 3, full: 4 },
    slowMonth: { name: 'February', lastDay: '2027-02-28', serviceId: 'svc1' },
    expiredQuotes: 2,
  });
  const keys = fired.map((r) => r.key);
  for (const k of ['open_lost_dates', 'add_team', 'offer_for_month', 'requote_expired']) assert.ok(keys.includes(k as never), k);
  assert.ok(!keys.includes('offer_on_card'), 'no opens per card are recorded → the card offer never fires');

  const month = fired.find((r) => r.key === 'offer_for_month')!;
  assert.equal(month.title, 'Run an offer for February');
  // The shipped off-season door, pre-filled — never a door to a page that does not exist.
  assert.equal(month.ctaHref, '/vendor-dashboard/services/svc1?offpeak=1&exp=2027-02-28&cond=Off-season%20rate%20for%20February%20bookings.');

  // closed only → Open that day, no Add a team; full only → the reverse.
  const closedOnly = buildGrowthRecs(null, { askedInWindow: 0, lostDates: { closed: 1, full: 0 } }).map((r) => r.key);
  assert.ok(closedOnly.includes('open_lost_dates') && !closedOnly.includes('add_team'));
  const fullOnly = buildGrowthRecs(null, { askedInWindow: 0, lostDates: { closed: 0, full: 1 } }).map((r) => r.key);
  assert.ok(fullOnly.includes('add_team') && !fullOnly.includes('open_lost_dates'));

  // a slow month with no active card has no door → no rule.
  const noCard = buildGrowthRecs(null, { askedInWindow: 0, slowMonth: { name: 'February', lastDay: '2027-02-28', serviceId: null } }).map((r) => r.key);
  assert.ok(!noCard.includes('offer_for_month'));
});

test('the reads: event_vendors only on the admin client, every other table on the session, every refusal is null', () => {
  const src = stripComments(readFileSync(join(HERE, 'vendor-analytics-graphs.server.ts'), 'utf8'));
  const evReads = [...src.matchAll(/\.from\(\s*'event_vendors'\s*\)/g)];
  assert.equal(evReads.length, 2, 'cardsell + replyvs read event_vendors');
  for (const m of evReads) assert.match(src.slice(Math.max(0, m.index! - 80), m.index!), /admin/, 'event_vendors must be read on the admin client');
  for (const t of ['vendor_date_waitlist', 'vendor_calendar_blocks', 'vendor_calendar_day_states', 'chat_threads', 'vendor_schedule_pool_bookings', 'vendor_proposals']) {
    const m = src.match(new RegExp(`session\\s*\\.from\\('${t}'\\)`));
    assert.ok(m, `${t} must be read on the shop's own session`);
  }
  assert.match(src, /if \(error \|\| !data\) \{[\s\S]{0,200}return null;/, 'a refused page is null, never a partial count');
});
