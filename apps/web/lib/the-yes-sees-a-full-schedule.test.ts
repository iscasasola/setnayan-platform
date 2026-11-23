/**
 * 👥 THE SUPPLIER'S YES SEES A FULL SCHEDULE: the app half (walk 22 Nov 2026; the DB half is
 * `tests/db/the-yes-sees-a-full-schedule.db.test.ts`, migration 20271359089802).
 *
 * Fails if:
 *   1 · the yes (`vendorAgreeToLock`) stops asking `fullSchedulesOfAsk` BEFORE `vendor_agree_to_lock` (nothing booked,
 *       no fee minted), or stops naming the full schedules in the answer;
 *   2 · the yes and the deposit stop sharing ONE pool list (`poolIdsOfBooking`), so the yes could weigh other schedules;
 *   3 · the supplier is not told which schedule is full, or is given no way to Dates.
 *
 * SABOTAGE (each seen red, restored): see the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { lockAgreeHalls, lockAgreeHallsParam, lockAgreeNotice } from '@/lib/lock-answer-notice';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function at(src: string, needle: string, from = 0): number {
  const i = src.indexOf(needle, from);
  assert.ok(i >= 0, `${needle} not found`);
  return i;
}

test('1 · the yes asks for a full schedule before the RPC that books, and names it', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const f0 = at(src, 'export async function vendorAgreeToLock(');
  const check = at(src, 'await fullSchedulesOfAsk(supabase, eventVendorId, createAdminClient())', f0);
  assert.ok(check < at(src, "supabase.rpc('vendor_agree_to_lock'", f0), 'refused before vendor_agree_to_lock runs');
  assert.match(src.slice(check, check + 400), /lock_agree=schedule_full\$\{lockAgreeHallsParam\(\{ taken: full, free: \[\] \}\)\}/);
});

test('2 · ONE pool list for the deposit and the yes', () => {
  const pools = read('lib/schedule-pools.ts');
  const dep = pools.slice(at(pools, 'export async function acquireSchedulePoolsForBooking('), at(pools, 'export async function poolIdsOfBooking('));
  assert.match(dep, /await poolIdsOfBooking\(admin, row\)/, 'the deposit reads the one list');
  const yes = pools.slice(at(pools, 'export async function fullSchedulesOfAsk('));
  assert.match(yes, /await poolIdsOfBooking\(admin,/, 'the yes reads the same list');
  assert.match(yes, /supabase\.rpc\('vendor_card_schedules_on'/, 'asked through the supplier’s own session');
  assert.doesNotMatch(yes, /resolvePoolIdsFor(Service|Category)\(/, 'never a second resolution');
});

test('3 · the supplier is told which schedule is full, with the door to Dates', () => {
  const halls = lockAgreeHalls('Crew A|Crew B', '');
  const two = lockAgreeNotice('schedule_full', { halls });
  assert.equal(two?.tone, 'refused');
  assert.match(two?.text ?? '', /^Crew A and Crew B are already full that day, so this booking cannot be taken\./);
  assert.equal(two?.door?.href, '/vendor-dashboard/customers?seg=dates');
  const one = lockAgreeNotice('schedule_full', { halls: lockAgreeHalls('Crew A', '') });
  assert.match(one?.text ?? '', /^Crew A is already full that day/);
  const unnamed = lockAgreeNotice('schedule_full', {});
  assert.match(unnamed?.text ?? '', /^A schedule this card uses is already full that day/, 'no names: still a plain reason');
  assert.equal(lockAgreeHallsParam({ taken: ['Crew A'], free: [] }), '&taken=Crew%20A&free=');
});
