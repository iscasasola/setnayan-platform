/**
 * event-today.test.ts — ☀ THE EVENT'S TODAY IS ONE LIST BY URGENCY (owner 20 Nov 2026: *"make the Today of the event
 * dashboard run like the Focus of Admin and Today of Suppliers Dashboard"*; drawing
 * `prototypes/event_today_focus_2026-11-20/` v3, part D).
 *
 *   1 · the levels come from deadlines the app already keeps — a payment's band, a task's due date, a reply deadline;
 *   2 · one list: red, then amber, then the rest; the strip's item is left out; the count is the strip + the rows;
 *   3 · the plan shows its three soonest, then ONE "N more this week" — the plan's own figure less what is on screen;
 *   4 · "Do it tomorrow" moves a row under Tomorrow and out of the count — never a red row, and never on an unread
 *       record list;
 *   5 · a failed read is a "couldn't load" row, never "nothing needs you";
 *   6 · the Budget card leaves out the strip's payment and every red payment row — a due-soon one stays.
 *
 * SABOTAGE (each seen red once, 2026-11-20, then reverted): `orderByUrgency(rows)` → `rows` (2 red) · the
 * `p.id === today.holds?.pay` skip removed (2 red) · `canPutOff(raw.urgency?.level)` dropped from the split (4 red) ·
 * `activePutOffs(i.putOffs …)` handed `[]` for null → still green by design, so `held.has` forced true (4 red) ·
 * `unread = true` dropped on a failed plan read (5 red) · `payUrgency(p)?.level === 'red'` → any level (6 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureControl, fixtureControlUnread, fixtureDay } from './home-control-fixture';
import { homeToday, homeWaiting, type HomeControlInput } from '@/app/dashboard/[eventId]/_components/home-control-faces';
import { buildEventToday, deadlineUrgency, eventTodayNeedWords, paysHeldByToday, payUrgency, taskUrgency, type EventTodayAsk } from './event-today';

const TODAY = '2026-11-20';
const build = (c: HomeControlInput, over: { asks?: EventTodayAsk[]; putOffs?: { task_key: string; until_day: string }[] | null } = {}) =>
  buildEventToday({ control: c, today: homeToday(c.next, c.guests, homeWaiting(c)), asks: over.asks, putOffs: over.putOffs === undefined ? [] : over.putOffs, todayIso: TODAY });
const keys = (rows: { key: string }[]) => rows.map((r) => r.key);

test('1 · every level is a deadline the app already keeps', () => {
  assert.deepEqual(payUrgency({ state: 'overdue', days: -3 }), { level: 'red', word: 'Overdue' });
  assert.deepEqual(payUrgency({ state: 'due_soon', days: -1 }), { level: 'red', word: 'Overdue' }, 'a passed date is late whatever the band says');
  assert.deepEqual(payUrgency({ state: 'due_soon', days: 0 }), { level: 'red', word: 'Today' });
  assert.deepEqual(payUrgency({ state: 'due_soon', days: 4 }), { level: 'amber', word: 'Soon' });
  assert.equal(payUrgency({ state: 'upcoming', days: 13 }), null, 'a payment outside the window is a Today row — it belongs to Budget');
  assert.equal(payUrgency({ state: 'none', days: null }), null);
  assert.deepEqual(taskUrgency(-1), { level: 'red', word: 'Overdue' });
  assert.deepEqual(taskUrgency(0), { level: 'red', word: 'Today' });
  assert.deepEqual(taskUrgency(7), { level: 'amber', word: 'Soon' });
  assert.equal(taskUrgency(8), null);
  assert.equal(taskUrgency(null), null);
  const now = Date.parse('2026-11-20T04:00:00Z');
  assert.equal(deadlineUrgency('2026-11-20T03:00:00Z', now)?.word, 'Overdue');
  assert.equal(deadlineUrgency('2026-11-20T20:00:00Z', now)?.word, 'Today');
  assert.equal(deadlineUrgency('2026-11-22T20:00:00Z', now)?.word, 'Soon');
  assert.equal(deadlineUrgency(null, now), null);
});

test('2 · one list by urgency; the strip’s item is not repeated; the count is the strip + the rows', () => {
  const c = fixtureControl('e1');
  const t = build(c);
  // The fixture: li-1 is late (the strip holds it), li-2 is due soon, t1 is due this week, a quote waits, invitations unsent.
  assert.ok(!keys(t.list).includes('pay:li-1'), 'the list repeats the payment the card’s strip holds');
  assert.deepEqual(keys(t.list), ['pay:li-2', 'task:t1', 'task:t2', 'task:t3', 'decide:suppliers', 'setup:invite'], 'the rows or their order changed');
  const levels = t.list.map((r) => r.urgency?.level ?? 'none');
  assert.deepEqual(levels, [...levels].sort((a, b) => ['red', 'amber', 'none'].indexOf(a) - ['red', 'amber', 'none'].indexOf(b)), 'the list is not red, then amber, then the rest');
  assert.equal(t.listCount, 6);
  assert.equal(t.count, 7, 'the card’s count is not the strip’s item + the rows still on Today');
  assert.deepEqual(t.nowUrgency, { level: 'red', word: 'Overdue' }, 'the strip does not say why it is first');
  assert.deepEqual(eventTodayNeedWords(t), { figure: '7 things', words: 'need you' });
  // A payment row carries the shipped Pay door for THAT payment; a payment outside the window is not a row.
  const pay = t.list[0]!;
  assert.equal(pay.pay?.href, '/dashboard/e1/budget?pay=li-2');
  assert.match(pay.line, /₱22,275 · due /);
  assert.ok(!keys(t.list).includes('pay:li-3'), 'a payment that is neither late nor due soon became a Today row');
  // A red row sorts first, wherever its source sits.
  const late = fixtureControl('e1');
  if (late.checklist && late.checklist !== 'unread') late.checklist.next[2] = { ...late.checklist.next[2]!, dueDate: fixtureDay(-2), daysUntilDue: -2 };
  const lt = build(late);
  assert.equal(lt.list[0]!.key, 'task:t3', 'an overdue task is not first');
  assert.equal(lt.list[0]!.putOff, false, 'a red row may go to tomorrow');
  // The invitations row words what the Guests tile words, and opens the shipped send door.
  const invite = t.list.find((r) => r.key === 'setup:invite')!;
  assert.equal(invite.title, 'Send the invitations');
  assert.equal(invite.line, '35 not invited yet');
  assert.deepEqual(invite.door, { label: 'Send the invitations', href: '/dashboard/e1/guests/send' });
});

test('3 · the plan shows three, then ONE "N more this week" — the plan’s own figure less what is on screen', () => {
  const c = fixtureControl('e1');
  assert.equal(build(c).more, null, 'one task is due this week and it is on screen — yet a "more" row is drawn');
  const busy = fixtureControl('e1');
  if (busy.checklist && busy.checklist !== 'unread') {
    busy.checklist.dueThisWeek = 41;
    busy.checklist.next = [-150, -147, -144, -140].map((d, i) => ({ id: `o${i}`, tick: { kind: 'task' as const, id: `o${i}` }, title: `Task ${i}`, dueDate: fixtureDay(d), daysUntilDue: d }));
  }
  const t = build(busy);
  assert.equal(t.list.filter((r) => r.kind === 'task').length, 3, 'the list does not show the three soonest');
  assert.deepEqual(t.more, { count: 38, href: '/dashboard/e1/schedule?view=preparation&filter=todo' });
  assert.deepEqual(t.foot, { pct: 62, week: 41, href: '/dashboard/e1/schedule?view=preparation&filter=todo' });
  assert.ok(t.list.every((r) => r.kind !== 'task' || r.urgency?.word === 'Overdue'));
});

test('4 · "Do it tomorrow" is out of the count — never a red row, never on an unread record list', () => {
  const c = fixtureControl('e1');
  const off = [
    { task_key: 'pay:li-2', until_day: '2026-11-21' },
    { task_key: 'task:t2', until_day: '2026-11-21' },
    { task_key: 'task:t3', until_day: '2026-11-20' }, // its day has come — back on Today
  ];
  const t = build(c, { putOffs: off });
  assert.deepEqual(keys(t.tomorrow), ['pay:li-2', 'task:t2']);
  assert.ok(!keys(t.list).includes('pay:li-2') && keys(t.list).includes('task:t3'));
  assert.equal(t.count, 5, 'a put-off row is still counted');
  // Unread records hold nothing off.
  assert.equal(build(c, { putOffs: null }).tomorrow.length, 0, 'an unread record list hid a row');
  // A red row ignores its record.
  const late = fixtureControl('e1');
  if (late.checklist && late.checklist !== 'unread') late.checklist.next[1] = { ...late.checklist.next[1]!, daysUntilDue: -1 };
  const lt = build(late, { putOffs: off });
  assert.ok(keys(lt.list).includes('task:t2'), 'an overdue task was hidden by an old record');
  assert.ok(!keys(lt.tomorrow).includes('task:t2'));
});

test('5 · a failed read is a "couldn’t load" row, never "nothing needs you"; asks are rows; an offer is not counted', () => {
  const t = build(fixtureControlUnread('e1'));
  assert.ok(keys(t.list).includes('unread:pay') && keys(t.list).includes('unread:plan') && keys(t.list).includes('unread:suppliers'));
  assert.equal(t.listCount, 0);
  assert.equal(t.unread, true);
  assert.deepEqual(eventTodayNeedWords(t), { figure: null, words: 'Part of Today couldn’t load' });
  assert.equal(t.list.every((r) => r.putOff === false), true, 'a "couldn’t load" row can go to tomorrow');
  const asks: EventTodayAsk[] = [
    { key: 'ask:coordinator:m1', title: 'Pick your coordinator’s access', line: 'Araw Planners joined as your coordinator', icon: 'person', href: '/x' },
    { key: 'ask:date-change', title: 'Date change: 1 of 2 suppliers answered', line: 'Someone hasn’t answered', icon: 'cal', href: '/y', urgency: { level: 'red', word: 'Overdue' } },
    { key: 'ask:event-day-prep', title: 'Prepare for event day', line: 'Works on bad venue signal', icon: 'phone', href: null, offer: true },
    { key: 'ask:mood', title: 'We couldn’t check the Mood Board for changes', line: 'Try again', icon: 'warn', href: '/m', unread: true, reload: true },
  ];
  const a = build(fixtureControl('e1'), { asks, putOffs: [{ task_key: 'ask:date-change', until_day: '2026-11-21' }] });
  assert.equal(a.list[0]!.key, 'ask:date-change', 'a red ask is not first, or a record hid it');
  assert.equal(a.listCount, 6 + 2, 'the offer or the unread row was counted, or an ask was not');
  assert.equal(a.unread, true);
  // Calm, with everything read: said plainly.
  const calm = fixtureControl('e1', { budget: { paidPhp: 0, owingPhp: 0, pays: [] }, suppliers: { booked: 0, of: 6, toDecide: [], replied: 0 }, checklist: { done: 1, total: 1, open: 0, dueThisWeek: 0, next: [] } });
  calm.next = { ...calm.next, kind: 'plan' } as HomeControlInput['next'];
  const ct = build(calm);
  assert.equal(ct.count, 0);
  assert.deepEqual(eventTodayNeedWords(ct), { figure: null, words: 'Nothing needs you today' });
});

test('6 · the Budget card leaves out the strip’s payment and every red payment row — a due-soon one stays', () => {
  const c = fixtureControl('e1');
  const pays = c.budget && c.budget !== 'unread' && c.budget.pays !== 'unread' ? c.budget.pays : [];
  assert.deepEqual(paysHeldByToday(pays, 'li-1'), ['li-1']);
  const two = pays.map((p) => (p.id === 'li-3' ? { ...p, days: -1, state: 'overdue' as const } : p));
  assert.deepEqual(paysHeldByToday(two, 'li-1').sort(), ['li-1', 'li-3']);
  assert.ok(!paysHeldByToday(two, 'li-1').includes('li-2'), 'a due-soon payment left the Budget card');
  assert.deepEqual(paysHeldByToday('unread', null), []);
});
