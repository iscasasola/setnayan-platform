/**
 * change-the-schedule.test.ts — owner 2026-11-04: on the supplier and crew Hub, "Change the schedule" (move a part ±
 * minutes, later parts follow; skip a part) replaces Hold 10 min; the change reaches the couple's timeline and the
 * guests' Event Hub; the crew row opens what Member / Helper get.
 *
 *   ⓵ MOVE carries the picked part and every later part that has not run — never a part that is done or another live one.
 *   ⓶ SKIP is one part that has not started; it is over (never a ✓, never "left"), and Undo puts it back.
 *   ⓷ A guest never sees a skipped part, and is told only about a part a guest can see.
 *   ⓸ The sheet: one dropdown per choice, no pill row of +N buttons left on the floor.
 *   ⓹ The crew row's sheet promises only what the crew phone draws.
 *   ⓺ Day-of tools stay Free: nothing on these paths asks for Pro.
 *   ⓻ Who may (owner 2026-11-05): a crew phone only asks; the emcee changes it with a lent Edit.
 *   ⓼ Ask to skip (owner 2026-11-05, "yes they can request"): the crew phone asks, a locked part says the lock's line and
 *      offers no ask; the coordinator answers on the floor with one tap; an approved skip IS the floor's own Skip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  MOVE_MINUTES,
  changedWords,
  guestNotice,
  guestsSeePart,
  isFinishedRunState,
  moveLead,
  moveWords,
  movableParts,
  partsThatFollow,
  requestLead,
  requestWords,
  skippableParts,
  undoOf,
  withoutSkipped,
  type ChangeablePart,
} from './change-the-schedule';
import { remainingBlockCount } from './floor-command';
import { crewRoleGets, crewRoleOpens } from './crew-pass';
import type { RunOfShowBlock } from './run-of-show';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const part = (id: string, hhmm: string, run_state: ChangeablePart['run_state'] = 'upcoming'): ChangeablePart => ({
  block_id: id,
  label: id[0]!.toUpperCase() + id.slice(1),
  start_at: `2026-12-18T${hhmm}:00Z`,
  run_state,
});
const DAY: ChangeablePart[] = [
  part('arrival', '14:00', 'done'),
  part('ceremony', '15:00', 'live'),
  part('photos', '16:00'),
  part('cocktails', '16:30', 'skipped'),
  part('dinner', '18:00'),
  part('dance', '20:00'),
];

test('⓵ a move carries the picked part and every later part that has not run', () => {
  assert.deepEqual(
    partsThatFollow(DAY, 'ceremony').map((p) => p.block_id),
    ['ceremony', 'photos', 'cocktails', 'dinner', 'dance'],
    'the live part moves with everything after it (a skipped part keeps its place in the order)',
  );
  assert.deepEqual(partsThatFollow(DAY, 'dinner').map((p) => p.block_id), ['dinner', 'dance'], 'earlier parts stay put');
  assert.deepEqual(partsThatFollow(DAY, 'arrival'), [], 'a part that is done cannot move');
  assert.deepEqual(partsThatFollow(DAY, 'nope'), []);
  assert.deepEqual(movableParts(DAY).map((p) => p.block_id), ['ceremony', 'photos', 'dinner', 'dance']);
  // ⏰ A Time-TBA part has no time: never offered, never moved from, never carried along by a move.
  const tba = { ...part('reception', '16:00'), start_at: '2026-12-18T00:00:00Z', time_tba: true };
  const withTba = [...DAY, tba];
  assert.ok(!movableParts(withTba).some((p) => p.block_id === 'reception'));
  assert.ok(!skippableParts(withTba).some((p) => p.block_id === 'reception'));
  assert.deepEqual(partsThatFollow(withTba, 'reception'), []);
  assert.ok(!partsThatFollow(withTba, 'ceremony').some((p) => p.block_id === 'reception'));
  assert.equal(moveWords(10), 'later 10 min');
  assert.equal(moveWords(-60), 'earlier 1 h');
  assert.equal(moveWords(75), 'later 1 h 15 min');
  assert.match(moveLead(DAY[2]!, 15, 3), /^Photos moves to 4:15 PM, and the 3 parts after it move with it/);
  assert.match(moveLead(DAY[5]!, -5, 0), /^Dance moves to 7:55 PM\. Nothing after it moves\./);
  assert.equal(changedWords({ op: 'move', blockId: 'photos', minutes: 10 }, DAY[2]!, 4), 'Moved later 10 min · 4 parts');
  // Undo hands back the exact rows, by the same minutes the other way.
  assert.deepEqual(undoOf({ op: 'move', blockId: 'photos', minutes: 10 }, ['photos', 'dinner']), {
    op: 'move',
    blockId: 'photos',
    minutes: -10,
    ids: ['photos', 'dinner'],
  });
});

test('⓶ a skip is one part that has not started — over, never a ✓, never left to do', () => {
  assert.deepEqual(skippableParts(DAY).map((p) => p.block_id), ['photos', 'dinner', 'dance'], 'never the live part');
  assert.equal(isFinishedRunState('skipped'), true);
  assert.equal(isFinishedRunState('done'), true);
  assert.equal(isFinishedRunState('upcoming'), false);
  assert.equal(remainingBlockCount(DAY as unknown as RunOfShowBlock[]), 4, 'a skipped part is still counted as left');
  assert.deepEqual(undoOf({ op: 'skip', blockId: 'photos' }), { op: 'unskip', blockId: 'photos' });
  assert.deepEqual(undoOf({ op: 'unskip', blockId: 'photos' }), { op: 'skip', blockId: 'photos' });
  assert.equal(changedWords({ op: 'skip', blockId: 'photos' }, DAY[2]!, 1), 'Skipped · Photos · later parts keep their times');
  // The couple's timeline says SKIPPED and never draws a ✓ for it.
  const rail = read('app/dashboard/[eventId]/schedule/_components/day-rail.tsx');
  assert.match(rail, /m\.run_state === 'skipped' \? \([\s\S]{0,200}SKIPPED/, 'the couple’s timeline does not say SKIPPED');
  assert.doesNotMatch(rail, /run_state === 'skipped'[^?]{0,40}\?\s*\(\s*<Check/, 'a skipped part is drawn as done');
});

test('⓷ guests never see a skipped part, and are told only about a part they can see', () => {
  assert.deepEqual(withoutSkipped(DAY).map((p) => p.block_id), ['arrival', 'ceremony', 'photos', 'dinner', 'dance']);
  assert.equal(guestsSeePart({ is_public: true, audience: null }), true);
  assert.equal(guestsSeePart({ is_public: false, audience: null }), false, 'a private moment told to guests');
  assert.equal(guestsSeePart({ is_public: true, audience: 'entourage' }), false, 'a role-only moment told to every guest');
  const told = guestNotice({ op: 'move', blockId: 'dinner', minutes: 30 }, DAY[4]!, 1);
  assert.equal(told.title, 'Dinner is now at 6:30 PM');
  assert.equal(guestNotice({ op: 'skip', blockId: 'dinner' }, DAY[4]!, 0).title, 'Dinner is off the schedule');
  // Every guest read drops it — after the fenced read, so the guests' fence chain stays as pinned.
  for (const rel of ['lib/schedule.ts', 'app/_actions/run-of-show.ts', 'app/api/live/run-of-show/[eventId]/route.ts']) {
    assert.match(read(rel), /withoutSkipped\(/, `${rel} hands a skipped part to the guests`);
  }
  // Guests are told in the app only — the shipped notice type, never an email, never a second notice.
  const notify = read('lib/schedule-shift-notify.server.ts');
  assert.match(notify, /rpc\('tell_guests_the_schedule_changed'/);
  const server = read('lib/change-the-schedule.server.ts');
  assert.match(server, /guests: seen \? guestNotice\(/, 'the guests are told about a part they cannot see');
  assert.doesNotMatch(server, /sendEmail|resend/i, 'Change the schedule sends an email');
});

test('⓸ the sheet: one dropdown per choice, and the floor’s +N pill row is gone', () => {
  assert.deepEqual([...MOVE_MINUTES], [5, 10, 15, 20, 30, 45, 60]);
  const sheet = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/change-the-schedule.tsx');
  assert.equal(sheet.match(/<ChosenRow\b/g)?.length, 3, 'Part ▾ · Move it ▾ · By ▾ — each one dropdown');
  assert.match(sheet, /label=\{ask \? 'Ask the hosts' : 'Move'\}/);
  assert.match(sheet, /label=\{ask \? 'Ask to skip' : 'Skip this part'\}/);
  assert.match(sheet, /pushUndo\(/, 'a change has no Undo');
  const updater = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/schedule-updater.tsx');
  assert.match(updater, /<ChangeTheSchedule\b/);
  assert.doesNotMatch(updater, /RETIME_PRESETS|\+\{m\}m|Hold 10/, 'the old +N pill row is back');
});

test('⓹ the crew row’s sheet promises only what the crew phone draws', () => {
  for (const coordinator of [true, false]) {
    for (const role of ['member', 'helper'] as const) {
      const opens = crewRoleOpens(role, coordinator);
      const gets = crewRoleGets(role, coordinator).opens.join(' | ');
      assert.equal(/Seat scanner/.test(gets), opens.scanner, `${role}/${coordinator}: the scanner line disagrees with the phone`);
      assert.equal(/Run of show/.test(gets), opens.runOfShow, `${role}/${coordinator}: the run-of-show line disagrees`);
      assert.equal(/change the schedule/i.test(gets), role === 'member' && coordinator, `${role}/${coordinator}: change promised`);
      // A crew phone ASKS (owner 2026-11-05 (D)) — the sheet never promises the crew a change of its own.
      if (role === 'member' && coordinator) assert.match(gets, /Ask to change the schedule[^|]*approve/);
    }
  }
  const panel = read('app/vendor-dashboard/on-the-day/_components/crew-panel.tsx');
  assert.match(panel, /crewRoleGets\(/, 'the crew row no longer opens what the role gets');
  // The crew phone draws Change the schedule only on the database's own answer — the same gate the write asks.
  const page = read('app/join/crew/[token]/page.tsx');
  assert.match(page, /rpc\('crew_schedule_door'/);
  assert.match(page, /doorRes\.data === 'ok' && blocks \? <ChangeTheSchedule\b[^>]*via="crew"/);
});

test('⓺ day-of tools stay Free — nothing on these paths asks for Pro', () => {
  for (const rel of [
    'lib/change-the-schedule.server.ts',
    'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/change-the-schedule.tsx',
    'app/vendor-dashboard/on-the-day/_components/crew-panel.tsx',
  ]) {
    assert.doesNotMatch(read(rel), /entitlement|isPro\b|ProMark|requirePro|◆/, `${rel} gates a day-of tool on Pro`);
  }
});

test('⓻ who may change it (owner 2026-11-05): a crew phone ASKS, the emcee changes with a lent Edit', () => {
  // (D) a crew change is a request the coordinator / hosts approve with one tap — never a write on the schedule.
  const server = read('lib/change-the-schedule.server.ts');
  assert.match(server, /rpc\('crew_request_schedule_move'/);
  assert.doesNotMatch(server, /crew_change_schedule/, 'the crew phone writes the schedule directly');
  assert.match(server, /notifyScheduleRequest\(/, 'the hosts are not told a crew request is waiting');
  assert.match(requestLead(DAY[2]!, 15, 2), /^Asks the hosts to move Photos and the 2 parts after it — Photos to 4:15 PM\. Nothing changes until they approve/);
  assert.equal(requestWords(-10, DAY[4]!, 1), 'Move Dinner earlier 10 min.');
  const sheet = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/change-the-schedule.tsx');
  assert.match(sheet, /const ask = via === 'crew'/);
  assert.match(sheet, /const canSkip = skippableHere && !lockedShop && !alreadyAsked/, 'the crew phone offers an ask the database refuses');
  assert.match(sheet, /label=\{ask \? 'Ask the hosts' : 'Move'\}/);
  // (A)(C) the floor door asks the shipped "Done · next" gate — couple · lent Edit (within the access window) ·
  // booked coordinator — so an emcee the hosts lent The Day = Edit is let in, and View / Off are not.
  const actions = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts');
  const body = actions.slice(actions.indexOf('export async function floorChangeSchedule'));
  assert.match(body, /await mayAdvance\(/);
  assert.doesNotMatch(body.slice(0, body.indexOf('changeTheSchedule(')), /requireCoordinator\(/, 'the emcee lent The Day is refused as "not the coordinator"');
});

test('⓼ ask to skip (owner 2026-11-05): the crew asks, a locked part offers no ask, the floor answers with one tap', () => {
  const server = read('lib/change-the-schedule.server.ts');
  // The crew phone's skip is an ASK — the database files it (gates, the lock's line, one per part) and nothing is skipped.
  assert.match(server, /if \(via === 'crew' && change\.op === 'skip'\) return askToSkip\(/);
  assert.match(server, /rpc\('crew_request_schedule_skip'/);
  // The coordinator is told IN THE APP only — never the emailed request notice (owner: no new emails).
  const ask = server.slice(server.indexOf('async function askToSkip'), server.indexOf('export async function readCrewSkipAsks'));
  assert.match(ask, /type: 'schedule_ask'/);
  assert.doesNotMatch(ask, /notifyScheduleRequest\(|schedule_change_requested/, 'a skip ask is emailed');
  // A locked part: the lock's line, and no Ask to skip.
  const sheet = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/change-the-schedule.tsx');
  assert.match(sheet, /\{lockedHead\(lockedShop\)\}/);
  const page = read('app/join/crew/[token]/page.tsx');
  assert.match(page, /readPartLocks\(admin, eventId\)/, 'the crew page does not know which parts are locked');
  assert.match(page, /lockedBy=\{lockedBy\} asked=\{asked\}/);
  // An approved skip IS the floor's own Skip — the one accept path calls changeTheSchedule, never a copy of it.
  const decide = read('lib/schedule-suggestion-decide.server.ts');
  assert.match(decide, /suggestion\.kind === 'skip' && suggestion\.block_id\) \{\s*const res = await changeTheSchedule\(db, userId \?\? '', eventId, \{ op: 'skip', blockId: suggestion\.block_id \}, 'floor'\)/);
  // The floor answers only its OWN crew's open skip ask, through the one accept path, after the floor's own gate.
  const actions = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts');
  const body = actions.slice(actions.indexOf('export async function floorChangeSchedule'));
  const answer = body.slice(body.indexOf("if (change.op === 'answer') {"));
  assert.ok(body.indexOf('await mayAdvance(') < body.indexOf("if (change.op === 'answer') {"), 'the answer skips the floor gate');
  assert.match(answer, /\.eq\('vendor_profile_id', profile\?\.vendor_profile_id \?\? ''\)/, 'the floor answers another shop’s ask');
  assert.match(answer, /decideSuggestion\(supabase, user\.id, eventId, change\.suggestionId,/);
  const asks = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/crew-asks.tsx');
  assert.match(asks, /op: 'answer', suggestionId: id, accept/);
  assert.doesNotMatch(asks, /router\.refresh\(/, 'the floor refreshes after an action that already revalidated');
});
