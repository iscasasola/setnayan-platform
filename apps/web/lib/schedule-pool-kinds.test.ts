import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEDULE_OR_HALL_POOLS, isScheduleOrHall } from './schedule-pool-kinds';
import { SPACE_KINDS } from './spaces';
import { stripComments } from './strip-comments';

/**
 * 🏛 A cart is never a hall, and a rental is never a team's schedule (ship review 21 Nov on #8088). Every reader that
 * lists schedules or halls keeps only a team schedule, a hall or a room. Red when a reader loses the filter.
 */
const WEB = process.cwd();

test('1 · the rule: a team schedule, a hall and a room stay; every other kind of space goes', () => {
  assert.equal(isScheduleOrHall(null), true);
  assert.equal(isScheduleOrHall(undefined), true);
  for (const k of SPACE_KINDS) assert.equal(isScheduleOrHall(k), k === 'hall' || k === 'room', k);
  assert.equal(SCHEDULE_OR_HALL_POOLS, 'space_kind.is.null,space_kind.in.(hall,room)');
});

const READERS: ReadonlyArray<[string, string]> = [
  ['app/vendor-dashboard/services/[serviceId]/page.tsx', 'a venue card’s halls pick'],
  ['app/vendor-dashboard/calendar/actions.ts', 'setServiceHalls'],
  ['lib/vendor-schedule.ts', 'Teams and days'],
  ['lib/service-card-maker.server.ts', 'a card’s Schedule pick'],
  ['lib/supplier-today.server.ts', 'Today'],
  ['lib/thread-day-answer.server.ts', 'a chat’s day answer'],
  ['lib/check-a-date.server.ts', 'Check a date'],
];

test('2 · every pre-Spaces reader of schedule pools filters to schedules and halls', () => {
  for (const [rel, what] of READERS) {
    const src = stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));
    // Each read up to the next `.from(`: a LISTING read is a select that keeps active pools or halls.
    const reads = src.split(".from('vendor_schedule_pools')").slice(1).map((r) => r.split('.from(')[0]!.slice(0, 700));
    const listing = reads.filter((r) => /^\s*\.select\(/.test(r) && /\.eq\('(is_active|is_hall)', true\)/.test(r));
    assert.ok(listing.length > 0, `${rel} no longer lists schedule pools — move this guard with it`);
    for (const r of listing) assert.match(r, /\.or\(SCHEDULE_OR_HALL_POOLS\)/, `${what} (${rel}) lists rentals as schedules or halls again`);
  }
});

test('3 · a hall made in Teams and days is a Space at once', () => {
  const src = stripComments(fs.readFileSync(path.join(WEB, 'app/vendor-dashboard/calendar/actions.ts'), 'utf8'));
  const create = src.slice(src.indexOf('export async function createCalendar('), src.indexOf('export async function editCalendar('));
  assert.match(create, /space_kind: isHall \? 'hall' : null,/, 'a hall made in Teams and days never shows on Spaces');
});
