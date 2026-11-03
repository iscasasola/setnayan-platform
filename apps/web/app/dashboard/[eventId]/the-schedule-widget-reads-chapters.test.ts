/**
 * the-schedule-widget-reads-chapters.test.ts — 📅 HOME'S SCHEDULE WIDGET IS THE CHAPTERS (owner 2026-11-01, DECISION_LOG
 * "SCHEDULE AND BUDGET GO TO HOME"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §5; approved prototype
 * `home_frames_where_you_act_2026-11-01/`).
 *
 * Owner, verbatim: *"Happening now: chapter with exact schedule if there is"* · *"What's next: next schedule/s"* ·
 * *"Multiple schedules can run at the same time. So all happening now will show."* · *"Keep the doors"*.
 *
 *   1 · THE FACTS: a chapter is a top-level block (`chaptersFromBlocks`) — a moment never stands as a line of its own;
 *       EVERY chapter running now is listed (never only the first, `pickTriggerNowNext`'s one block), each with its
 *       running moment as the exact line; What's next is every chapter starting at the next minute;
 *   2 · THE DOORS: N to approve · Release (the last week; ◆ PRO on Free) · N need you (a clash: one crew in two places
 *       at once) · N owe times (a booked supplier the schedule names on nothing); a zero hides its door;
 *   3 · THE READ: Home reads the widget through `readHomeSchedule`, which reads `event_schedule_blocks` with the
 *       chapters' own field list and builds through `homeScheduleFrom`; the page hands it to the control row;
 *   4 · RENDERED: the card stands full width right after the Countdown, its faces from the chapters, its doors under them.
 *
 * SABOTAGE (seen red, 2026-11-01): keep only `now[0]` in `homeScheduleFrom` (1 red) · drop the `oweTimes` door (2 red) ·
 * read `pickTriggerNowNext` in place of the chapters / unhook `readHomeSchedule` from the page (3 red) · draw the
 * Schedule after the glance row (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { homeScheduleFrom, type HomeScheduleBlock } from '@/lib/home-schedule';
import type { TaskRow } from '@/lib/schedule-chapters';
import { plannedInstant } from '@/lib/run-of-show';
import { fixtureControl } from '@/lib/home-control-fixture';
import { homeControlTiles } from './_components/home-control-faces';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');

const TZ = 'Asia/Manila';
const block = (id: string, label: string, start: string, end: string | null, parent: string | null = null, extra: Partial<HomeScheduleBlock> = {}): HomeScheduleBlock => ({
  block_id: id,
  parent_block_id: parent,
  label,
  start_at: `${start}:00+00:00`,
  end_at: end ? `${end}:00+00:00` : null,
  location: null,
  spot: null,
  ...extra,
});
const DAY: HomeScheduleBlock[] = [
  block('bride', 'Preparation · Bride', '2026-12-12T09:00', '2026-12-12T12:00', null, { location: 'Seda Vertis North', spot: 'Floor 14' }),
  block('hair', 'Hair and makeup', '2026-12-12T09:00', '2026-12-12T10:30', 'bride'),
  block('groom', 'Preparation · Groom', '2026-12-12T09:30', '2026-12-12T11:00', null, { location: 'Seda Vertis North', spot: 'Floor 9' }),
  block('cer', 'Ceremony', '2026-12-12T14:00', '2026-12-12T15:00', null, { location: 'San Agustin Church' }),
  block('rec', 'Reception', '2026-12-12T18:00', null, null, { location: 'Seda Vertis North' }),
  block('cocktails', 'Cocktails', '2026-12-12T18:00', null, null),
];
const at = (wall: string) => plannedInstant(`${wall}:00+00:00`, TZ)!;
const task = (id: string, blockId: string, vendor: string, place: string | null): TaskRow => ({
  task_id: id, block_id: blockId, vendor_id: vendor, crew: null, guest_id: null, group_id: null, role: null, who_label: null, what: 'Shoot', call_at: null, place, sort_order: 0,
});

test('1 · every running chapter is Happening now, with its running moment; What’s next is every chapter starting together', () => {
  const f = homeScheduleFrom({ blocks: DAY, tasks: [], openRequests: 0, bookedVendorIds: [], nowMs: at('2026-12-12T09:45'), tz: TZ, today: '2026-12-12' });
  assert.equal(f.chapters, 5, 'a moment was counted as a chapter');
  assert.deepEqual(f.now.map((l) => l.k), ['Preparation · Bride', 'Preparation · Groom'], 'not every running chapter is Happening now');
  assert.match(f.now[0]!.v, /9:00 AM · Hair and makeup/, 'the running moment is not the exact line');
  assert.deepEqual(f.next.map((l) => l.k), ['Ceremony'], 'What’s next is not the next chapter');
  assert.match(f.next[0]!.v, /^2:00 PM · San Agustin Church$/, 'a line today says only its clock and place');
  assert.ok(!f.now.concat(f.next, f.then).some((l) => l.k === 'Hair and makeup'), 'a moment stands as a line of its own');

  const later = homeScheduleFrom({ blocks: DAY, tasks: [], openRequests: 0, bookedVendorIds: [], nowMs: at('2026-12-12T16:00'), tz: TZ, today: '2026-12-12' });
  assert.deepEqual(later.now, [], 'nothing runs between the ceremony and the reception');
  assert.deepEqual(later.next.map((l) => l.k).sort(), ['Cocktails', 'Reception'], 'two chapters starting together are not both next');

  const before = homeScheduleFrom({ blocks: DAY, tasks: [], openRequests: 0, bookedVendorIds: [], nowMs: at('2026-11-01T09:00'), tz: TZ, today: '2026-11-01' });
  assert.match(before.next[0]!.v, /^Sat, Dec 12 · 9:00 AM/, 'a line on another day does not name its day');
  assert.deepEqual(before.then.map((l) => l.k), ['Preparation · Groom'], 'Then is not the group after');

  // ⏰ A Time TBA chapter (#7151): never Happening now at a guessed midnight; from an earlier day, next with "Time TBA".
  const tba = block('fitting', 'Final fitting', '2026-11-21T00:00', null, null, { time_tba: true });
  const onItsDay = homeScheduleFrom({ blocks: [tba], tasks: [], openRequests: 0, bookedVendorIds: [], nowMs: at('2026-11-21T00:30'), tz: TZ, today: '2026-11-21' });
  assert.deepEqual(onItsDay.now, [], 'a Time TBA chapter runs at midnight');
  const ahead = homeScheduleFrom({ blocks: [tba], tasks: [], openRequests: 0, bookedVendorIds: [], nowMs: at('2026-11-01T09:00'), tz: TZ, today: '2026-11-01' });
  assert.equal(ahead.next[0]?.v, 'Sat, Nov 21 · Time TBA', 'a Time TBA chapter shows a clock');
});

test('2 · the doors: to approve · Release in the last week (◆ PRO on Free) · need you · owe times — a zero hides its door', () => {
  const f = homeScheduleFrom({
    blocks: [...DAY.slice(0, 4), { ...DAY[4]!, responsible_vendor_ids: ['v-tagged'] }],
    // The same photographer in two places at once (Floor 14 and Floor 9, 9:30–10:30) — one clash.
    tasks: [task('t1', 'hair', 'v-photo', 'Floor 14'), task('t2', 'groom', 'v-photo', 'Floor 9')],
    openRequests: 2,
    bookedVendorIds: ['v-photo', 'v-tagged', 'v-quiet', 'v-silent'],
    nowMs: at('2026-12-05T09:00'),
    tz: TZ,
    today: '2026-12-05',
  });
  assert.equal(f.toApprove, 2);
  assert.equal(f.needYou, 1, 'the clash is not counted');
  assert.equal(f.oweTimes, 2, 'a booked supplier named on nothing is not counted (or a named one is)');
  const week = (days: number, pro: boolean) =>
    homeControlTiles(fixtureControl('e1', { countdown: { ...fixtureControl('e1').countdown, days }, schedule: { ...f, pro } })).tiles.find((t) => t.key === 'sched')!;
  assert.deepEqual(week(7, false).doors!.map((d) => d.label), ['2 to approve', 'Release', '1 need you', '2 owe times']);
  assert.equal(week(7, false).doors!.find((d) => d.id === 'release')!.pro, true, 'Release on Free wears no ◆ PRO');
  assert.equal(week(7, true).doors!.find((d) => d.id === 'release')!.pro, false, 'Release on Pro wears ◆ PRO');
  assert.ok(!week(40, false).doors!.some((d) => d.id === 'release'), 'Release shows 40 days out');
  const quiet = homeControlTiles(fixtureControl('e1', { schedule: { ...f, toApprove: 0, needYou: 0, oweTimes: 0, pro: false } })).tiles.find((t) => t.key === 'sched')!;
  assert.deepEqual(quiet.doors, [], 'a measured zero drew a door');
});

test('3 · Home reads the widget through the chapters, in its one round, and hands it to the control row', () => {
  const server = read('lib/home-schedule.server.ts');
  assert.match(server, /HOME_SCHEDULE_FIELDS = `\$\{CHAPTER_FIELDS\}/, 'the widget does not read the chapters’ own fields');
  assert.match(server, /\.from\('event_schedule_blocks'\)\s*\.select\(HOME_SCHEDULE_FIELDS\)/, 'the widget does not read the blocks');
  assert.match(server, /return homeScheduleFrom\(/, 'the read does not build through homeScheduleFrom');
  assert.match(read('lib/home-schedule.ts'), /const chapters = chaptersFromBlocks\(i\.blocks\);/, 'the facts are not built from the chapters');
  assert.doesNotMatch(read('lib/home-schedule.ts'), /pickTriggerNowNext/, 'the widget reads ONE current block');
  const page = read('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /const homeScheduleRead = startAhead\(/, 'the schedule read is not started with the rest');
  assert.match(page, /homeScheduleRead,\s*\]\);/, 'the schedule read is not in the one wait');
  assert.match(page, /schedule:\s*homeSchedule && homeSchedule !== 'unread'/, 'the page does not hand the read to the control row');
});

test('4 · rendered: the Schedule card is the first widget, its faces from the chapters, its doors under them', () => {
  const f = homeScheduleFrom({ blocks: DAY, tasks: [], openRequests: 2, bookedVendorIds: [], nowMs: at('2026-12-12T09:45'), tz: TZ, today: '2026-12-12' });
  const html = drawHome({ control: fixtureControl('e1', { schedule: { ...f, pro: false } }) });
  const compact = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  const order = [...compact.matchAll(/data-home-tile="([a-z]+)"/g)].map((m) => m[1]);
  // 🎴 The Countdown rides the event card (Home redraw 2026-11-02, round 3): the Schedule is the first widget.
  assert.deepEqual(order.slice(0, 1), ['sched'], 'the Schedule is not the first widget');
  const card = slice(compact, 'data-home-tile="sched"', ['data-home-glance']);
  assert.match(text(card), /Happening now Preparation · Bride 9:00 AM · Hair and makeup Preparation · Groom/, 'the faces are not the chapters');
  assert.match(text(card), /What’s next Ceremony/);
  assert.match(card, /data-home-sched-door="approve"/, 'the doors are not under the faces');
  assert.match(text(card), /2 to approve/);
});
