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
 * drop the `made !== null` check in `roomToGrowRows` → 7 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TODAY_TASK_MODE,
  doneTodayRows,
  growStage,
  nextBadgeWords,
  splitTodayNeeds,
  todayBadgeTag,
  todayProgress,
  feeUrgency,
  feeRowLine,
  permitUrgency,
  eventUrgency,
  eventRowWords,
  todayOneList,
  thisWeekLine,
  todayHeldOff,
  orderByUrgency,
  taskUrgency,
  CARDS_LOCK_KEY,
  CARDS_TURN_ON_HREF,
  PLANS_HREF,
  doneTodayTotal,
  DONE_UNREAD_LINE,
  BILLS_UNREAD_LINE,
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

const NONE_DONE = { replies: 0, payments: 0, delivered: 0, bookings: 0, dates: 0, inquiries: 0, meetings: 0, cancels: 0 };

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
  assert.equal(growStage({ ...base, cutoffs: { fewInquiries: 20, fewBookings: null } })?.why, '312 looked · 14 asked in 30 days');
  assert.equal(growStage({ ...base, inquiries28: null, cutoffs: { fewInquiries: 20, fewBookings: 2 } })?.n, 4);
  assert.equal(growStage({ ...base, bookedThisMonth: null, cutoffs: { fewInquiries: null, fewBookings: 2 } })?.n, 5);
  assert.equal(growStage({ ...base, verified: false })?.n, 1);
  assert.equal(growStage({ ...base, noCover: { serviceId: 's', title: 'Full-day photo' } })?.n, 2);
  assert.equal(growStage({ ...base, setupDrawn: true }), null, 'the six steps already sit on top');
});

test('4 · an unread desk is never done; Done today counts only what was read', () => {
  assert.deepEqual(todayProgress(null, 3), { tasks: null, progress: null, allDone: false, pips: null });
  assert.deepEqual(todayProgress(6, 1), { tasks: '6 tasks today', progress: '1 of 7 done', allDone: false, pips: { done: 1, total: 7 } });
  assert.equal(todayProgress(0, 2).allDone, true);
  assert.deepEqual(doneTodayRows(null, 0), []);
  assert.deepEqual(doneTodayRows({ ...NONE_DONE, replies: 2, delivered: 1 }, 0).map((r) => r.line), ['2 replies posted', 'You delivered']);
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

// REWRITTEN ON PURPOSE (owner 19 Nov: "we already agreed they can add as many … so we can motivate them to upgrade"):
// making a card is unlimited, the plan counts the LIVE ones — so the row is "turn on", never "make N more".
test('7 · the library is a task; the cards row is "You can turn on N more", a lock at zero, and nothing on an unread number', () => {
  const lib = { open: true, photos: 0, href: '/l', label: 'Add to the inspiration library' };
  const none = { allowed: null, live: null, hidden: null };
  // Room, and a card waiting hidden: turn it on.
  const rows = roomToGrowRows({ library: lib, cards: { allowed: 3, live: 1, hidden: 2 } });
  assert.deepEqual(rows.map((r) => r.key), [CARDS_TASK_KEY, LIBRARY_TASK_KEY]);
  assert.equal(rows[0]!.label, 'You can turn on 2 more service cards');
  assert.equal(rows[0]!.line, '2 hidden · your plan shows 3 live');
  assert.equal(rows[0]!.button, 'Turn on');
  assert.equal(rows[0]!.href, CARDS_TURN_ON_HREF);
  assert.equal(rows[1]!.line, 'None yet · couples find you through them');
  // Room, but nothing hidden: the way to turn one on is to make one.
  const make = roomToGrowRows({ library: lib, cards: { allowed: 3, live: 2, hidden: 0 } })[0]!;
  assert.equal(make.label, 'You can turn on 1 more service card');
  assert.equal(make.line, 'Your plan shows 3 live · 2 on now');
  assert.equal(make.button, 'Make a card');
  // The row never says "make N more" — making is unlimited.
  assert.doesNotMatch(rows[0]!.label + make.label, /You can make/);
  // Every live spot used and a card waiting hidden: 🔒 the Problem, then the Solution, and the door to the plans.
  const lock = roomToGrowRows({ library: lib, cards: { allowed: 3, live: 3, hidden: 4 } })[0]!;
  assert.equal(lock.key, CARDS_LOCK_KEY);
  assert.equal(lock.label, '🔒 Your plan shows 3 service cards live');
  assert.equal(lock.line, '4 hidden · hide one, or upgrade to show more');
  assert.equal(lock.href, PLANS_HREF);
  assert.equal(lock.button, 'See plans');
  // Full and nothing hidden: nothing is blocked, so nothing is said (a lock with no problem is an advert).
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: 3, live: 3, hidden: 0 } }).map((r) => r.key), [LIBRARY_TASK_KEY]);
  // A shop already past its total (kept its cards from before): the same lock, never a negative "turn on -2".
  assert.equal(roomToGrowRows({ library: lib, cards: { allowed: 3, live: 5, hidden: 1 } })[0]!.key, CARDS_LOCK_KEY);
  // An unread number decides nothing.
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: null, live: 1, hidden: 2 } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'an unread plan total guessed room');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: 3, live: null, hidden: 2 } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'an unread live count guessed room');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: 3, live: 1, hidden: null } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'an unread hidden count guessed room');
  assert.deepEqual(roomToGrowRows({ library: lib, cards: { allowed: Infinity, live: 3, hidden: 2 } }).map((r) => r.key), [LIBRARY_TASK_KEY], 'no limit is not a count');
  assert.deepEqual(roomToGrowRows({ library: { ...lib, open: false }, cards: none }), [], 'the library row drawn for a shop it refuses');
  assert.equal(roomToGrowRows({ library: { ...lib, photos: null }, cards: none })[0]!.line, 'Your photos help couples find you');
});

test('7b · the plan numbers are READ, never typed: the row reads the live gate\'s own total and counts as it counts', () => {
  const server = readFileSync(join(process.cwd(), 'lib/supplier-today-v2.server.ts'), 'utf8');
  assert.match(server, /const caps = await fetchCapsWithAddOns\(supabase, vendorProfileId, t\.tier_state\);/, 'the live total is not the plan\'s own (caps + bought add-ons)');
  assert.match(server, /allowed: caps\.serviceCardsTotal, live: live\.count, hidden: hidden\.count/);
  assert.match(server, /\.is\('branch_copy_of', null\)/, 'branch copies are counted — the live gate leaves them out');
  assert.match(server, /if \(t\.is_founder === true\) return null;/, 'a founder (no live limit) is counted down');
  assert.match(server, /readCardRoom\(supabase, vendorProfileId\)\.catch\(\(\) => null\)/, 'the cards row is not read');
  const body = server.slice(server.indexOf('async function readCardRoom'), server.indexOf('async function readInspirationPhotos'));
  assert.doesNotMatch(body, /\b(1|3|10|20|27|68|80|200)\b/, 'a plan number is typed into the read');
  const rule = readFileSync(join(process.cwd(), 'lib/supplier-today-v2.ts'), 'utf8');
  const fn = rule.slice(rule.indexOf('export function roomToGrowRows'), rule.indexOf('if (i.library.open)'));
  assert.doesNotMatch(fn, /\b(3|10|20|27|68|80|200)\b/, 'a plan number is typed into the rule');
});

/* ── THE REVIEW HOLD ON #7994 (19 Nov) — one test per failure path, in the style of `reads-are-honest.test.ts`: a part
   that could not be READ may never be drawn as an absence. Each was seen RED against the old code path first. ──────── */

test('R1 · unread fee bills never allow "You’re done for today" — the read tasks still count', () => {
  assert.equal(todayProgress(0, 2).allDone, true, 'anti-vacuity: with everything read and nothing left, it IS done');
  const p = todayProgress(0, 2, { billsUnread: true });
  assert.equal(p.allDone, false, 'a supplier who may owe a fee we could not read was told they are done');
  assert.equal(p.pips, null, 'pips claim how much is done while a part is unread');
  assert.equal(todayProgress(3, 0, { billsUnread: true }).tasks, '3 tasks today', 'the tasks that WERE read went missing');
});

test('R2 · a refused Done-today read is "not read" — never 0 done, never a made-up "N of M"', () => {
  assert.equal(doneTodayTotal(null, 4), null, 'a refused read became a number');
  assert.equal(doneTodayTotal(NONE_DONE, 0), 0, 'anti-vacuity: a READ day with nothing done is a real 0');
  const p = todayProgress(5, null);
  assert.equal(p.progress, null, '"N of M done" was built on an unread count');
  assert.equal(p.pips, null);
  assert.equal(p.tasks, '5 tasks today');
  assert.match(DONE_UNREAD_LINE, /Couldn’t load/);
  assert.match(BILLS_UNREAD_LINE, /Couldn’t load/);
});

test('R3 · every answer that leaves the list is counted, so "N of M" only grows', () => {
  // Five tasks; the supplier answers a meeting, an inquiry and a cancel request. M must stay 5 while done goes 0 → 3.
  const before = todayProgress(5, doneTodayTotal(NONE_DONE, 0));
  const after = todayProgress(2, doneTodayTotal({ ...NONE_DONE, meetings: 1, inquiries: 1, cancels: 1 }, 0));
  assert.equal(before.pips?.total, 5);
  assert.deepEqual(after.pips, { done: 3, total: 5 }, 'M shrank while the supplier worked');
  assert.equal(after.progress, '3 of 5 done');
  assert.deepEqual(
    doneTodayRows({ ...NONE_DONE, meetings: 1, inquiries: 2, cancels: 1 }, 0).map((r) => r.key),
    ['done-inquiries', 'done-meetings', 'done-cancels'],
    'an answered meeting, inquiry or cancel request is not listed under Done today',
  );
});

test('R4 · unread service cards never read as "every card has a cover" — the shop is not moved past stage 2', () => {
  assert.equal(growStage(base)?.n, 5, 'anti-vacuity: with the cards read and none bare, the shop moves on');
  assert.equal(growStage({ ...base, coversUnread: true }), null, 'a refused cards read skipped grow stage 2');
  // What WAS read still shows: not findable is a stage-2 move on its own.
  assert.equal(growStage({ ...base, coversUnread: true, findable: false, findableHref: '/x' })?.n, 2);
});

/* ── TODAY v3 PART 1 (owner 19 Nov, "Yes, all your picks" · "all recommended"): ONE list, most urgent first. ── */

const NOW = Date.parse('2026-11-19T04:00:00Z');
const dated = (id: string, dueAt: string) => ({ id, kind: 'date_change', dueAt }) as unknown as WhatsNewCard;

test('V1 · a level comes only from a deadline the code already has — and always wears a word', () => {
  assert.deepEqual(taskUrgency(dated('d', '2026-11-18T04:00:00Z'), NOW), { level: 'red', word: 'Overdue' });
  assert.deepEqual(taskUrgency(dated('d', '2026-11-19T20:00:00Z'), NOW), { level: 'red', word: 'Today' }, 'under 24 hours left is today');
  assert.deepEqual(taskUrgency(dated('d', '2026-11-22T04:00:00Z'), NOW), { level: 'amber', word: 'Soon' });
  // No deadline on the card → normal. A review, a message, an inquiry, a booking ask and a dispute wear no level.
  for (const k of ['review', 'message', 'inquiry', 'lock_request', 'lock', 'dispute', 'mark_complete'] as const) assert.equal(taskUrgency(card('x', k), NOW), null, `${k} was given a level nobody set`);
  assert.equal(taskUrgency(null, NOW), null);
  assert.equal(taskUrgency(dated('d', 'not a date'), NOW), null, 'an unreadable deadline guessed a level');
});

test('V2 · one list: red, then amber, then the rest — each level in the order it arrived', () => {
  const s = splitTodayNeeds({
    needs: [need('r1'), need('soon'), need('m1'), need('late'), need('r2'), need('today')],
    cards: [card('r1', 'review'), dated('soon', '2026-11-25T04:00:00Z'), card('m1', 'message'), dated('late', '2026-11-18T00:00:00Z'), card('r2', 'review'), dated('today', '2026-11-19T10:00:00Z')],
    completedToGo: null,
    aside: new Set(),
    now: NOW,
  });
  assert.deepEqual(s.list.map((r) => r.key), ['late', 'today', 'soon', 'r1', 'm1', 'r2'], 'the list is not most urgent first');
  assert.deepEqual(s.list.map((r) => r.urgency?.word ?? '—'), ['Overdue', 'Today', 'Soon', '—', '—', '—']);
  // Nothing is lost or doubled: the one list is exactly the quick rows plus the others.
  assert.equal(s.list.length, s.quick.length + s.screen.length);
  // Without a clock no row wears a level, and the desk's own order stands.
  const plain = splitTodayNeeds({ needs: [need('r1'), need('late')], cards: [card('r1', 'review'), dated('late', '2026-11-18T00:00:00Z')], completedToGo: null, aside: new Set() });
  assert.deepEqual(plain.list.map((r) => r.key), ['r1', 'late']);
  assert.deepEqual(orderByUrgency([]), []);
});

test('V3 · EACH fee bill wears its own level and word (drawing V3 · 3) — never one block at the most pressing level', () => {
  const today = '2026-11-19';
  assert.deepEqual(feeUrgency('2026-11-14', today), { level: 'red', word: 'Overdue' });
  assert.deepEqual(feeUrgency('2026-11-19', today), { level: 'red', word: 'Today' }, 'its last day is today');
  assert.deepEqual(feeUrgency('2026-11-21', today), { level: 'amber', word: 'Soon' });
  assert.deepEqual(feeUrgency('2026-11-30', today), { level: 'amber', word: 'Soon' });
  assert.deepEqual(feeUrgency(null, today), { level: 'amber', word: 'Soon' }, 'an unknown due date is still owed');
  // The closed row says the level once ("Overdue · since Sat 14 Nov"), never "overdue" twice.
  assert.equal(feeRowLine({ dueOn: '2026-11-14' }, today, '₱4,250.00 · overdue since Sat 14 Nov'), 'since Sat 14 Nov');
  assert.equal(feeRowLine({ dueOn: '2026-11-19' }, today, '₱4,250.00 · due today'), '₱4,250.00');
  assert.equal(feeRowLine({ dueOn: '2026-11-30' }, today, '₱4,250.00 · due Mon 30 Nov'), 'due Mon 30 Nov');
});

test('V4 · the permit wears a level only from the rule that already tints it: expired red, 7 days or fewer amber', () => {
  assert.deepEqual(permitUrgency({ key: 'renewal', lineTone: 'danger' }), { level: 'red', word: 'Overdue' });
  assert.deepEqual(permitUrgency({ key: 'renewal', lineTone: 'warn' }), { level: 'amber', word: 'Soon' });
  assert.equal(permitUrgency({ key: 'renewal', lineTone: null }), null, 'a permit 8+ days out was given a level');
  assert.equal(permitUrgency({ key: 'door-payout', lineTone: 'danger' }), null, 'a door was read as the permit');
  const base = { kind: 'documents' as const, icon: 'file' as const, target: { to: 'today' as const } };
  const s = (lineTone: 'warn' | 'danger' | null) =>
    splitTodayNeeds({ needs: [{ ...base, key: 'renewal', label: 'Business permit', line: 'x', lineTone }], cards: [], completedToGo: null, aside: new Set(), now: NOW });
  assert.equal(s('warn').permit?.urgency.word, 'Soon');
  assert.equal(s('warn').recommended.length, 0, 'an urgent permit is said twice — on the list and under recommended');
  assert.equal(s(null).permit, null);
  assert.equal(s(null).recommended[0]?.key, 'renewal', 'a permit further out left "Also for your badges"');
  // Without a clock nothing wears a level — the permit stays recommended.
  assert.equal(splitTodayNeeds({ needs: [{ ...base, key: 'renewal', label: 'p', line: 'x', lineTone: 'danger' }], cards: [], completedToGo: null, aside: new Set() }).permit, null);
});

test('V5 · a booked event today is red "Today", tomorrow amber "Soon"; later has no level', () => {
  assert.deepEqual(eventUrgency(0), { level: 'red', word: 'Today' });
  assert.deepEqual(eventUrgency(1), { level: 'amber', word: 'Soon' });
  assert.equal(eventUrgency(2), null);
  assert.equal(eventUrgency(Number.NaN), null);
  const e = { id: 'e', eventName: 'Santos wedding', date: '2026-12-12', inDays: 1, place: 'Hall A', href: '/x' };
  assert.equal(eventRowWords(e).label, 'Santos wedding is tomorrow');
  assert.match(eventRowWords(e).line, /see the day$/);
  assert.equal(eventRowWords({ ...e, inDays: 0 }).label, 'Santos wedding is today');
});

test('V6 · the one list: every bill, the permit and the events each sit at their own level, interleaved', () => {
  const today = '2026-11-19';
  const split = splitTodayNeeds({
    needs: [need('r1'), need('dc'), { key: 'renewal', kind: 'documents', label: 'Business permit expires in 5 days', line: 'x', icon: 'file', lineTone: 'warn', target: { to: 'today' } }],
    cards: [card('r1', 'review'), dated('dc', '2026-11-19T10:00:00Z')],
    completedToGo: null,
    aside: new Set(),
    now: NOW,
  });
  const list = todayOneList({
    split,
    bills: [{ orderId: 'soon', dueOn: '2026-11-30' }, { orderId: 'late', dueOn: '2026-11-14' }],
    events: [{ id: 'tmr', eventName: 'Santos', date: '2026-11-20', inDays: 1, place: null, href: '/x' }, { id: 'far', eventName: 'Lim', date: '2026-12-20', inDays: 31, place: null, href: '/y' }],
    todayIso: today,
  });
  assert.deepEqual(list.map((e) => e.key), ['dc', 'fee-late', 'fee-soon', 'renewal', 'event-tmr', 'r1'], 'not red, then amber, then the rest — or a bill moved as one block');
  assert.deepEqual(list.map((e) => e.urgency?.word ?? '—'), ['Today', 'Overdue', 'Soon', 'Soon', 'Soon', '—']);
});

test('T1 · v3 part 2: a task put off sits under Tomorrow, out of the count — a red one never leaves Today', () => {
  const s = splitTodayNeeds({
    needs: [need('r1'), need('late'), need('m1'), need('soon')],
    cards: [card('r1', 'review'), dated('late', '2026-11-18T00:00:00Z'), card('m1', 'message'), dated('soon', '2026-11-25T04:00:00Z')],
    completedToGo: null,
    aside: new Set(),
    now: NOW,
    putOff: new Set(['r1', 'late', 'soon']),
  });
  assert.deepEqual(s.tomorrow.map((r) => r.key), ['r1', 'soon'], 'a put-off task is not under Tomorrow');
  assert.deepEqual(s.list.map((r) => r.key), ['late', 'm1'], 'a red task was hidden by a put-off record, or a put-off task stayed listed');
  assert.equal(s.quick.length + s.screen.length, 2, 'a put-off task is still counted today');
  // No record (or an unread one) holds nothing off.
  assert.equal(splitTodayNeeds({ needs: [need('r1')], cards: [card('r1', 'review')], completedToGo: null, aside: new Set(), now: NOW }).tomorrow.length, 0);
});

test('S1 · v3 part 5: a booking ask is amber only inside the owner’s window — not set, never coloured', () => {
  const ask = (h: number) => ({ ...card('a', 'lock_request'), expiresAt: new Date(NOW + h * 3_600_000).toISOString() }) as WhatsNewCard;
  assert.deepEqual(taskUrgency(ask(10), NOW, 24), { level: 'amber', word: 'Soon' });
  assert.equal(taskUrgency(ask(30), NOW, 24), null, 'an ask outside the window was coloured');
  assert.equal(taskUrgency(ask(10), NOW, null), null, 'a window nobody set coloured a row');
  assert.equal(taskUrgency(ask(-1), NOW, 24), null, 'a lapsed ask wears Soon');
});

test('T2 · v3 part 2: a bill, the permit and an event go to tomorrow too — a red one never', () => {
  const today = '2026-11-19';
  const split = splitTodayNeeds({ needs: [need('r1')], cards: [card('r1', 'review')], completedToGo: null, aside: new Set(), now: NOW, putOff: new Set(['fee-soon', 'fee-late', 'event-tmr']) });
  const args = {
    split,
    bills: [{ orderId: 'soon', dueOn: '2026-11-30' }, { orderId: 'late', dueOn: '2026-11-14' }],
    events: [{ id: 'tmr', eventName: 'Santos', date: '2026-11-20', inDays: 1, place: null, href: '/x' }],
    todayIso: today,
  };
  assert.deepEqual(todayOneList(args).map((e) => e.key), ['fee-late', 'r1'], 'an overdue bill was hidden, or a put-off one stayed');
  assert.deepEqual(todayHeldOff(args).map((e) => e.key), ['fee-soon', 'event-tmr']);
});

test('S2 · 20 Nov ruling: an unanswered inquiry turns amber after the owner’s hours; events this week are ONE line', () => {
  const inq = (h: number) => ({ ...card('i', 'inquiry'), createdAt: new Date(NOW - h * 3_600_000).toISOString() }) as WhatsNewCard;
  assert.deepEqual(taskUrgency(inq(25), NOW, 24), { level: 'amber', word: 'Soon' });
  assert.equal(taskUrgency(inq(3), NOW, 24), null, 'a fresh inquiry was coloured');
  assert.equal(taskUrgency(inq(300), NOW, null), null, 'a window nobody set coloured an inquiry');
  const ev = (inDays: number) => ({ inDays });
  assert.deepEqual(thisWeekLine([ev(0), ev(1), ev(2), ev(5), ev(7), ev(8)], 7), { count: 3, label: 'This week: 3 events' }, 'today/tomorrow (own rows) or beyond the window were counted');
  assert.deepEqual(thisWeekLine([ev(3)], 7), { count: 1, label: 'This week: 1 event' });
  assert.equal(thisWeekLine([ev(3)], null), null, 'a window nobody set drew a line');
  assert.equal(thisWeekLine([ev(1)], 7), null);
});
