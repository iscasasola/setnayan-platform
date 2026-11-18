/**
 * supplier-today-v2.test.ts — 📋 TODAY v2, "ONE TASK" (owner 18 Nov 2026, `Today, one task` v2, "all picks").
 *
 *   1 · every desk kind has a mode, and exactly the drawing's five are quick;
 *   2 · quick rows come first, each group keeps the desk's order (pick 3), and the shop's own gaps leave the count (pick 2);
 *   3 · a blank grow line is OFF — the stage is skipped, never guessed (pick 1); an unread count decides nothing;
 *   4 · an unread desk never says "done" (the shipped rule), and Done today never invents a row;
 *   5 · trending says nothing about a quiet or unread market;
 *   6 · "Not now" lapses at midnight; "Got it" stays and counts once, on its day;
 *   7 · the library and the plan's unused cards are tasks (owner 18 Nov) — an unread number draws no cards row.
 *
 * SABOTAGE (each seen red once): make `meeting` a screen → 1 red; count `renewal` as a task → 2 red; default
 * `fewInquiries` to 20 in `growStage` → 3 red;
 * drop the `online !== null` check in `roomToGrowRows` → 7 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TODAY_TASK_MODE,
  doneTodayRows,
  growStage,
  nextBadgeWords,
  splitTodayNeeds,
  todayBadgeTag,
  todayProgress,
  trendingLines,
  roomToGrowRows,
  CARDS_TASK_KEY,
  LIBRARY_TASK_KEY,
  type GrowInput,
} from './supplier-today-v2';
import { readTodayAside, setAside, gotItToday, asideKeys } from './today-aside';
import type { TodayNeed } from './supplier-today';
import type { WhatsNewCard } from './vendor-overview';
import type { DemandRadar } from './demand-radar';

test('1 · five quick kinds, the rest open one screen', () => {
  const quick = Object.entries(TODAY_TASK_MODE).filter(([, m]) => m === 'quick').map(([k]) => k).sort();
  assert.deepEqual(quick, ['date_change', 'lock', 'mark_complete', 'meeting', 'review']);
  assert.equal(Object.keys(TODAY_TASK_MODE).length, 13, 'a desk kind has no mode');
  assert.equal(todayBadgeTag('review', null)?.word, 'Your page');
  assert.equal(todayBadgeTag('mark_complete', '2 to go')?.word, 'Completed bookings · 2 to go');
  assert.equal(todayBadgeTag('meeting', null), null, 'a kind that moves no badge got a made-up tag');
});

const need = (key: string): TodayNeed => ({ key, kind: null, label: key, line: '', icon: 'check', target: { to: 'customers' } });
const card = (id: string, kind: WhatsNewCard['kind']) => ({ id, kind }) as unknown as WhatsNewCard;

test('2 · quick first, desk order kept, gaps out of the count, set-asides left out', () => {
  const s = splitTodayNeeds({
    needs: [need('m1'), need('r1'), need('door-payout'), need('lr1'), need('r2'), need('renewal'), need('unread'), need('ll1')],
    cards: [card('m1', 'message'), card('r1', 'review'), card('lr1', 'lock_request'), card('r2', 'review'), card('ll1', 'lock_request_lapsed')],
    completedToGo: null,
    aside: new Set(['ll1']),
  });
  assert.deepEqual(s.quick.map((r) => r.key), ['r1', 'r2']);
  assert.deepEqual(s.screen.map((r) => r.key), ['m1', 'lr1']);
  assert.deepEqual(s.recommended.map((r) => r.key), ['door-payout', 'renewal']);
  assert.equal(s.unread?.key, 'unread');
});

const base: GrowInput = {
  setupDrawn: false,
  verified: true,
  findable: true,
  findableHref: null,
  noCover: null,
  views: 312,
  inquiries28: 14,
  bookedThisMonth: 0,
  cutoffs: { fewInquiries: null, fewBookings: null },
  hasQuoteDraft: false,
  payoutNone: false,
  hasMarkComplete: false,
  permitDue: false,
  completedToGo: null,
};

test('3 · a blank line is off; a set line decides; an unread count decides nothing', () => {
  assert.equal(growStage(base)?.n, 5, 'a blank line turned a stage on');
  assert.equal(growStage({ ...base, cutoffs: { fewInquiries: 20, fewBookings: null } })?.n, 3);
  assert.equal(growStage({ ...base, cutoffs: { fewInquiries: 20, fewBookings: null } })?.why, '312 looked · 14 asked in 28 days');
  assert.equal(growStage({ ...base, inquiries28: null, cutoffs: { fewInquiries: 20, fewBookings: 2 } })?.n, 4);
  assert.equal(growStage({ ...base, bookedThisMonth: null, cutoffs: { fewInquiries: null, fewBookings: 2 } })?.n, 5);
  assert.equal(growStage({ ...base, verified: false })?.n, 1);
  assert.equal(growStage({ ...base, noCover: { serviceId: 's', title: 'Full-day photo' } })?.n, 2);
  assert.equal(growStage({ ...base, setupDrawn: true }), null, 'the six steps already sit on top');
});

test('4 · an unread desk is never done; Done today counts only what was read', () => {
  assert.deepEqual(todayProgress(null, 3), { tasks: null, progress: null, allDone: false });
  assert.deepEqual(todayProgress(6, 1), { tasks: '6 tasks today', progress: '1 of 7 done', allDone: false });
  assert.equal(todayProgress(0, 2).allDone, true);
  assert.deepEqual(doneTodayRows(null, 0), []);
  assert.deepEqual(doneTodayRows({ replies: 2, payments: 0, delivered: 1, bookings: 0, dates: 0 }, 0).map((r) => r.line), ['2 replies posted', 'You delivered']);
  assert.deepEqual(nextBadgeWords('Bronze at 5 bookings · 2 to go'), { title: 'Next badge: Bronze at 5 bookings', toGo: '2 to go' });
  assert.equal(nextBadgeWords(null), null);
});

test('5 · a quiet or unread market says nothing', () => {
  assert.deepEqual(trendingLines(null, null), []);
  const quiet = { hasData: false, totalSignal: 0, bucketCount: 0, months: [], regions: [], looks: [], eventTypes: [] } as DemandRadar;
  assert.deepEqual(trendingLines(quiet, null), []);
  const hot = { ...quiet, hasData: true, months: [{ month: '2026-12-01', label: 'Dec 2026', inquiries: 3, unlocks: 0, bookings: 1, total: 4 }, { month: '2027-01-01', label: 'Jan 2027', inquiries: 1, unlocks: 0, bookings: 0, total: 1 }], looks: [{ style: 'cine', label: 'Cine', inquiries: 2, unlocks: 0, bookings: 0, total: 2 }] } as DemandRadar;
  assert.deepEqual(trendingLines(hot, { title: 'Full-day photo' }).map((l) => l.label), ['Uy, December is hot', 'Cine is the look right now', 'Your Full-day photo is Trending']);
});

test('6 · Not now lapses at midnight; Got it stays and counts on its day', () => {
  const day1 = readTodayAside(null, '2026-11-18');
  const raw = setAside(readTodayAside(setAside(day1, 'door-credit', 'notNow', []), '2026-11-18'), 'll1', 'gotIt', ['ll1']);
  const same = readTodayAside(raw, '2026-11-18');
  assert.deepEqual([...asideKeys(same)].sort(), ['door-credit', 'll1']);
  assert.equal(gotItToday(same, new Set(['ll1'])), 1);
  const next = readTodayAside(raw, '2026-11-19');
  assert.deepEqual([...asideKeys(next)], ['ll1'], '"Not now" outlived its day');
  assert.equal(gotItToday(next, new Set(['ll1'])), 0, '"Got it" counted again the next day');
  assert.deepEqual([...asideKeys(readTodayAside('%%%not-json', '2026-11-18'))], []);
});

test('7 · the library and the unused cards are tasks; an unread number draws no cards row', () => {
  const lib = { open: true, photos: 0, href: '/l', label: 'Add to the inspiration library' };
  const rows = roomToGrowRows({ library: lib, cards: { allowed: 3, online: 1 } });
  assert.deepEqual(rows.map((r) => r.key), [CARDS_TASK_KEY, LIBRARY_TASK_KEY]);
  assert.equal(rows[0]!.label, 'You can put 2 more cards online');
  assert.equal(rows[0]!.line, 'Your plan holds 3 · 1 online now');
  assert.equal(rows[1]!.line, 'None yet · couples find you through them');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: null, online: 1 } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'an unread allowance guessed room');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: 3, online: null } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'an unread count guessed room');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: 3, online: 3 } }).map((r) => r.key), [LIBRARY_TASK_KEY]);
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: Infinity, online: 3 } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'no limit is not a count');
  assert.deepEqual(roomToGrowRows({ library: { ...lib, open: false }, cards: { allowed: null, online: null } }), [], 'the library row drawn for a shop it refuses');
  assert.equal(roomToGrowRows({ library: { ...lib, photos: null }, cards: { allowed: null, online: null } })[0]!.line, 'Your photos help couples find you');
});
