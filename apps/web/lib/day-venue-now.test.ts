/**
 * 🗺 "directions to the location/venue where things are happening is only 1 of
 * 2" (owner 2026-10-01). Executes `dayVenueNow` — the one rule every day reader
 * asks — and pins that the day's readers really ask it (a rule nobody calls is
 * the "built but not there" the owner ruled out on 2026-10-02).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { EventVenue } from '@/lib/event-venues';
import { ceremonyIsOver, dayVenueNow } from './day-venue-now';

const venue = (role: EventVenue['role'], name: string): EventVenue => ({
  role,
  name,
  address: null,
  latitude: null,
  longitude: null,
});
const church = venue('ceremony', 'San Agustin Church');
const hotel = venue('reception', 'Manila Hotel');
const both = [church, hotel];

type Block = Parameters<typeof ceremonyIsOver>[0][number];
const block = (type: Block['block_type'], start: string, extra: Partial<Block> = {}): Block => ({
  block_type: type,
  start_at: start,
  end_at: null,
  parent_block_id: null,
  run_state: 'upcoming',
  actual_end_at: null,
  ...extra,
});
// Wall clock parked in UTC — the way the schedule stores it.
const ms = (iso: string) => Date.parse(iso);
const day = [block('ceremony', '2027-03-13T15:00:00Z'), block('reception', '2027-03-13T18:00:00Z')];

test('one venue (or one that is both) is the place all day', () => {
  assert.equal(dayVenueNow({ venues: [hotel], blocks: day, nowMs: ms('2027-03-13T20:00:00Z') }), hotel);
  assert.equal(dayVenueNow({ venues: [], blocks: day, nowMs: 0 }), null);
});

test('before the ceremony is over: the ceremony venue — never both', () => {
  assert.equal(dayVenueNow({ venues: both, blocks: day, nowMs: ms('2027-03-13T09:00:00Z') }), church);
  assert.equal(dayVenueNow({ venues: both, blocks: day, nowMs: ms('2027-03-13T16:00:00Z') }), church);
});

test('after it: the reception — the input moves, the answer moves', () => {
  assert.equal(dayVenueNow({ venues: both, blocks: day, nowMs: ms('2027-03-13T18:00:00Z') }), hotel);
});

test('the ceremony ends at its own end time when it has one', () => {
  const withEnd = [block('ceremony', '2027-03-13T15:00:00Z', { end_at: '2027-03-13T16:00:00Z' }), day[1]!];
  assert.equal(ceremonyIsOver(withEnd, ms('2027-03-13T16:30:00Z')), true);
  assert.equal(ceremonyIsOver(withEnd, ms('2027-03-13T15:30:00Z')), false);
});

test('the run of show outranks the clock', () => {
  const done = [block('ceremony', '2027-03-13T15:00:00Z', { run_state: 'done' }), day[1]!];
  assert.equal(dayVenueNow({ venues: both, blocks: done, nowMs: ms('2027-03-13T15:10:00Z') }), hotel);
  const running = [block('ceremony', '2027-03-13T15:00:00Z', { run_state: 'live' }), day[1]!];
  assert.equal(dayVenueNow({ venues: both, blocks: running, nowMs: ms('2027-03-13T19:00:00Z') }), church);
});

test('no programme → the ceremony is still the place to go (nothing guessed)', () => {
  assert.equal(dayVenueNow({ venues: both, blocks: [], nowMs: ms('2027-03-13T22:00:00Z') }), church);
});

test('REACHED: the Live directions, the Welcome venue and the day venue scene all ask the one rule', () => {
  const body = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(body, /dayVenuesNow\(/, 'site-body.tsx no longer asks dayVenuesNow — the day can point at two venues again');
  assert.ok(
    !/<DayDirections venues=\{event\.venues/.test(body),
    'DayDirections is handed every venue again — "only 1 of 2" is broken',
  );
  const scene = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/_components/hideable-widget-render.tsx'), 'utf8'),
  );
  assert.match(scene, /dayVenuesNow\(/, 'the venue scene on the day draws both venues again');
  const pub = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/_components/public-hideable-widget.tsx'), 'utf8'),
  );
  assert.match(pub, /dayVenuesNow\(/, 'a stranger’s venue scene on the day draws both venues again');
});
