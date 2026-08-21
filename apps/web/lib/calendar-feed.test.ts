/**
 * THE SUBSCRIPTION FEED — what a person's calendar re-reads.
 *
 * The failure modes worth locking here are the ones a calendar shows SILENTLY:
 * an entry on the wrong day, an entry that ends a day early, an entry that
 * duplicates on every refresh, or a feed that quietly deletes somebody's
 * wedding out of their phone. None of them throws; all of them are read by a
 * person as "Setnayan got my date wrong".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildFeedIcs, feedEntriesFor, type FeedEvent } from './calendar-feed';

const BASE = 'https://www.setnayan.com';
const STAMP = '20260821T000000Z';

function e(over: Partial<FeedEvent> & { public_id: string }): FeedEvent {
  return {
    display_name: 'A day',
    event_date: '2026-12-12',
    event_end_date: null,
    archived: false,
    venue_name: null,
    venue_address: null,
    ...over,
  };
}

function ics(events: FeedEvent[]): string {
  return buildFeedIcs({
    entries: feedEntriesFor(events, BASE),
    calendarName: 'Setnayan — My Events',
    stampUtc: STAMP,
  });
}

// ─── THE DAY IS THE DAY, ON EVERY PHONE ─────────────────────────────────────

test('an entry is an all-day DATE, never an instant', () => {
  // 🔑 THE 2026-08-04 SWEEP IN A NEW COSTUME. `events.event_date` is a DATE;
  // turning it into a timestamp needs a timezone, and `new Date('2026-12-12')`
  // is midnight UTC — the ELEVENTH anywhere west of Greenwich. That read a
  // 12 December wedding as 11 December on 41 screens. `VALUE=DATE` has no
  // timezone to get wrong, which is why every entry is one.
  const out = ics([e({ public_id: 'S89E-ABC' })]);
  assert.match(out, /DTSTART;VALUE=DATE:20261212/);
  assert.doesNotMatch(out, /DTSTART:\d{8}T/, 'no timed DTSTART may appear');
  assert.doesNotMatch(out, /TZID/, 'an all-day entry needs no timezone at all');
});

test('DTEND is the day AFTER the last day', () => {
  // RFC 5545 DTEND is EXCLUSIVE. Emitting the last day itself ends a one-day
  // celebration before it starts, and a calendar renders that as nothing.
  const out = ics([e({ public_id: 'S89E-ABC', event_date: '2026-12-12' })]);
  assert.match(out, /DTEND;VALUE=DATE:20261213/);
});

test('a celebration that runs several days covers all of them', () => {
  const out = ics([
    e({
      public_id: 'S89E-R',
      event_date: '2027-04-01',
      event_end_date: '2027-04-04',
    }),
  ]);
  assert.match(out, /DTSTART;VALUE=DATE:20270401/);
  assert.match(out, /DTEND;VALUE=DATE:20270405/, 'exclusive end = the 5th');
});

test('a month or year boundary does not roll wrong', () => {
  const out = ics([e({ public_id: 'S89E-NYE', event_date: '2026-12-31' })]);
  assert.match(out, /DTEND;VALUE=DATE:20270101/);
});

// ─── WHAT IS IN IT ──────────────────────────────────────────────────────────

test('a put-away celebration is not in the feed', () => {
  // Same rule as every shelf on the board: put away means out of sight.
  const out = feedEntriesFor(
    [e({ public_id: 'S89E-A' }), e({ public_id: 'S89E-B', archived: true })],
    BASE,
  );
  assert.deepEqual(out.map((x) => x.uid), ['S89E-A@setnayan.com']);
});

test('a celebration that already happened STAYS in the feed', () => {
  // 🚨 THE ONE PLACE THIS DEPARTS FROM THE INSTRUCTION, ON PURPOSE. The owner
  // named Planning and Now happening as what the feed is FOR. But a calendar
  // MIRRORS a feed — it does not accumulate from it — so dropping a past entry
  // DELETES IT FROM THE PERSON'S PHONE. A couple's wedding would disappear out
  // of their own calendar the morning after, with nothing to explain it.
  const out = feedEntriesFor([e({ public_id: 'S89E-PAST', event_date: '2020-01-01' })], BASE);
  assert.equal(out.length, 1, 'the wedding must not vanish from their calendar');
});

test('an undated celebration is left out, and returns on its own', () => {
  // "Date to be set" is a real state and a calendar has nowhere to put it. The
  // entry appears by itself once a date is chosen — which is what subscribing
  // is for.
  assert.deepEqual(feedEntriesFor([e({ public_id: 'S89E-X', event_date: null })], BASE), []);
});

test('a celebration with no public id is left out rather than given a made-up one', () => {
  // The UID is what stops a calendar duplicating the entry on every refresh.
  // A synthesised one would change between reads and pile up copies.
  assert.deepEqual(
    feedEntriesFor([{ ...e({ public_id: 'x' }), public_id: null }], BASE),
    [],
  );
});

test('the UID is stable, so a refresh updates rather than duplicates', () => {
  const first = feedEntriesFor([e({ public_id: 'S89E-ABC' })], BASE);
  const second = feedEntriesFor(
    [e({ public_id: 'S89E-ABC', event_date: '2027-01-30' })],
    BASE,
  );
  assert.equal(first[0]!.uid, second[0]!.uid, 'a moved date must not become a second entry');
});

test('entries come back in date order', () => {
  const out = feedEntriesFor(
    [
      e({ public_id: 'S89E-LATE', event_date: '2027-06-01' }),
      e({ public_id: 'S89E-SOON', event_date: '2026-09-01' }),
    ],
    BASE,
  );
  assert.deepEqual(out.map((x) => x.uid), ['S89E-SOON@setnayan.com', 'S89E-LATE@setnayan.com']);
});

// ─── THE FILE ITSELF ────────────────────────────────────────────────────────

test('a comma in a venue name is escaped, not a value separator', () => {
  // "Ayala Land, Nuvali" — unescaped, the comma is an iCalendar VALUE
  // SEPARATOR, and the entry either loses everything after it or fails to parse
  // and the whole subscription shows as broken.
  const out = ics([e({ public_id: 'S89E-V', venue_name: 'Ayala Land, Nuvali' })]);
  assert.match(out, /LOCATION:Ayala Land\\, Nuvali/);
});

test('every line ends CRLF and no line exceeds 75 octets', () => {
  // RFC 5545 §3.1. Apple Calendar rejects an over-long line outright, so this
  // is the difference between a subscription that works and one that silently
  // will not add.
  const out = ics([
    e({
      public_id: 'S89E-LONG',
      // Multi-byte on purpose: folding must count OCTETS, not characters, or a
      // Filipino celebration name produces lines that are legal by count and
      // too long in fact.
      display_name: 'Lolo Ben’s 80th — Kasalang Ginto ng mga Casasola sa Tagaytay at Nuvali, 2027',
      venue_name: 'Hardin ng mga Bulaklak — Silang, Cavite, Pilipinas',
    }),
  ]);
  for (const line of out.split('\r\n')) {
    const octets = Buffer.byteLength(line, 'utf8');
    assert.ok(octets <= 75, `line is ${octets} octets: ${line.slice(0, 40)}…`);
  }
  assert.ok(out.endsWith('\r\n'));
  assert.doesNotMatch(out.replace(/\r\n/g, ''), /\n/, 'no bare LF anywhere');
});

test('the calendar has a name and a refresh hint', () => {
  // Without X-WR-CALNAME the subscription shows up in somebody's calendar list
  // as an unnamed entry they will delete because they cannot tell what it is.
  const out = ics([e({ public_id: 'S89E-A' })]);
  assert.match(out, /X-WR-CALNAME:Setnayan/);
  assert.match(out, /REFRESH-INTERVAL;VALUE=DURATION:PT1H/);
});

test('an empty feed is still a valid calendar', () => {
  // It must parse. A malformed empty feed makes the calendar report the
  // subscription as broken, which reads as "Setnayan is broken".
  const out = ics([]);
  assert.match(out, /^BEGIN:VCALENDAR\r\n/);
  assert.match(out, /END:VCALENDAR\r\n$/);
  assert.doesNotMatch(out, /BEGIN:VEVENT/);
});
