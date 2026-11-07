/**
 * supplier-today-next-events.test.ts — 📸 TODAY'S NEXT EVENTS (THE ONE BUILD A3 · A2 guard 3).
 *
 *   1 · one booking on the next event day → one card, no "1 of 1"; two → two cards, "1 of 2", "2 tomorrow · swipe";
 *   2 · a tap opens that client's HUB PAGE in Clients — never the live `/vendor-dashboard/on-the-day` console;
 *   3 · a refused schedule read says "Schedule couldn’t load" — never "No call time" and never a silent blank;
 *   4 · chips come only from facts: an unknown hub / money / hosts read draws NO chip (never a guess);
 *   5 · the carousel draws no dot pager (v110 "No dot pagers") and is the ONE shared carousel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { assembleNextEvents, clientHubHref, nextEventDay, whenWord } from './supplier-today-next-events';
import type { UpcomingEventRow } from './vendor-overview';

const TODAY = '2026-11-07';
const row = (eventId: string, date: string, eventName = `Event ${eventId}`): UpcomingEventRow => ({
  id: `${eventId}-${date}`,
  eventId,
  eventName,
  date,
  place: 'Taal Vista, Tagaytay',
  category: 'photography',
  inDays: 0,
  href: `/vendor-dashboard/clients/${eventId}?tab=details`,
  threadHref: null,
  opensCard: true,
});

test('1 · the next event day: every booking on the earliest date ahead, one card each', () => {
  const rows = [row('b', '2026-11-08', 'Villanueva debut'), row('a', '2026-11-08', 'Reyes & Santos wedding'), row('c', '2026-11-20'), row('old', '2026-11-01')];
  const day = nextEventDay(rows, TODAY);
  assert.deepEqual(day.map((r) => r.eventId), ['a', 'b']);
  const two = assembleNextEvents(day, {}, TODAY)!;
  assert.equal(two.meta, '2 tomorrow · swipe');
  assert.deepEqual(two.cards.map((c) => c.position), ['1 of 2', '2 of 2']);
  assert.equal(two.cards[0]!.when, 'Tomorrow');
  assert.equal(two.cards[0]!.dateLine, 'Sun 8 Nov · Taal Vista, Tagaytay');

  const one = assembleNextEvents(nextEventDay([row('c', '2026-11-20')], TODAY), {}, TODAY)!;
  assert.equal(one.cards.length, 1);
  assert.equal(one.cards[0]!.position, null, 'one card says no "1 of 1"');
  assert.equal(one.meta, 'in 13 days');
  assert.equal(whenWord(TODAY, TODAY), 'Today');
  assert.equal(assembleNextEvents([], {}, TODAY), null, 'no booking ahead → no card at all');
});

test('2 · a tap opens the client’s Hub page, never the live console', () => {
  const ev = assembleNextEvents([row('a', '2026-11-08')], {}, TODAY)!;
  assert.equal(ev.cards[0]!.href, clientHubHref('a'));
  assert.equal(clientHubHref('a'), '/vendor-dashboard/clients/a?tab=hub');
  const ui = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/today-next-events.tsx'), 'utf8'));
  assert.doesNotMatch(ui, /on-the-day/, 'the card never links the live Hub console');
});

test('3 · a refused schedule read is said, never "No call time"', () => {
  const ev = assembleNextEvents([row('a', '2026-11-08')], { a: { scheduleUnread: true } }, TODAY)!;
  assert.equal(ev.cards[0]!.timeLine, 'Schedule couldn’t load');
  assert.equal(ev.cards[0]!.timeUnread, true);
  const ok = assembleNextEvents([row('a', '2026-11-08')], { a: { callTime: '1:00 PM', programme: 'Ceremony 3:00 PM' } }, TODAY)!;
  assert.equal(ok.cards[0]!.timeLine, 'Call time 1:00 PM · Ceremony 3:00 PM');
  const none = assembleNextEvents([row('a', '2026-11-08')], { a: { callTime: null, programme: null } }, TODAY)!;
  assert.equal(none.cards[0]!.timeLine, null, 'nothing timed yet draws no line — not an invented one');
  const src = readFileSync(join(process.cwd(), 'lib/supplier-today-next-events.ts'), 'utf8');
  assert.doesNotMatch(stripComments(src), /No call time/);
});

test('4 · chips only from facts — unknown reads draw none', () => {
  const blank = assembleNextEvents([row('a', '2026-11-08')], {}, TODAY)!;
  assert.deepEqual(blank.cards[0]!.chips, []);
  const refused = assembleNextEvents([row('a', '2026-11-08')], { a: { hubReady: null, owedPhp: null, hosts: null } }, TODAY)!;
  assert.deepEqual(refused.cards[0]!.chips, [], 'a refused read is no chip, never "Hub not set up" or "Balance paid"');
  const full = assembleNextEvents(
    [row('a', '2026-11-08'), row('b', '2026-11-08')],
    { a: { hubReady: true, owedPhp: 0, hosts: 4 }, b: { hubReady: false, owedPhp: 12000, hosts: 2 } },
    TODAY,
  )!;
  assert.deepEqual(full.cards[0]!.chips.map((c) => c.word), ['Hub ready', 'Balance paid', '4 hosts in chat']);
  assert.deepEqual(full.cards[1]!.chips.map((c) => c.word), ['Hub not set up', '₱12,000 due', '2 hosts in chat']);
});

test('5 · the ONE shared carousel, no dot pager of its own', () => {
  const ui = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/today-next-events.tsx'), 'utf8'));
  assert.match(ui, /<SnapCarousel\b/, 'the shared SnapCarousel — never a second carousel');
  assert.doesNotMatch(ui, /data-snap-dots|scroll-snap-type/, 'no hand-made track or dots');
});
