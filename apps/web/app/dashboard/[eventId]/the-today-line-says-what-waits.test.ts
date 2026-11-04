/**
 * the-today-line-says-what-waits.test.ts — ☀ TODAY NEVER SAYS "NOTHING WAITS ON YOU" WHILE SOMETHING DOES (audit
 * 2026-11-02 #2). `homeToday` only knew hub · count · guests · papic · ai · plan, so an overdue payment, a quote waiting
 * on the couple, supplier changes to approve and an access ask all sat under a green "Nothing waits on you". EXECUTED on
 * the control row's own fixture:
 *   1. each waiting thing replaces the calm line (and the AI offer), pointing at the widget that holds it;
 *   2. the picker's own firsts (date, guests unread, Papic, the guide, invitations) are never pushed aside;
 *   3. a widget that could not be read means "nothing waits" is not known — never calm;
 *   4. calm only when nothing waits and everything was read; and Home's first screen asks the same question.
 * Sabotage (2026-11-02, each reverted, each red): `homeToday` ignoring `waiting` · the overdue filter dropped ·
 * the unread branch removed · HomeFirstScreen back on `homeToday(next, control.guests)`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl, fixturePays, fixtureSchedule } from '@/lib/home-control-fixture';
import type { HomeNext } from '@/lib/home-first-screen';
import { homeToday, homeWaiting, type HomeControlInput } from './_components/home-control-faces';

const PLAN: HomeNext = { kind: 'plan', title: 'You are on track', body: '', action: '' };
const AI: HomeNext = { kind: 'ai', title: 'Setnayan AI', body: '', action: '' };
const quiet = (over: Partial<HomeControlInput> = {}): HomeControlInput =>
  fixtureControl('e1', {
    next: PLAN,
    budget: { paidPhp: 1, owingPhp: 1, pays: fixturePays().filter((p) => p.state !== 'overdue') },
    suppliers: { booked: 2, of: 6, toDecide: [], replied: 0 },
    schedule: { ...fixtureSchedule('before'), toApprove: 0 },
    asks: 0,
    ...over,
  });
const today = (c: HomeControlInput, next: HomeNext = PLAN) => homeToday(next, c.guests, homeWaiting(c));

test('1 · each waiting thing replaces the calm line, pointing at its widget', () => {
  assert.equal(today(quiet({ asks: 2 })).target, 'asks');
  assert.match(today(quiet({ asks: 2 })).words, /2 access requests wait on you/);
  const overdue = today(quiet({ budget: { paidPhp: 1, owingPhp: 1, pays: fixturePays() } }));
  assert.equal(overdue.target, 'budget');
  // 🎴 Now names the late payment itself (Home redraw 2026-11-02): the amount and who; Pay opens it.
  assert.match(overdue.words, /^₱8,000 to Lumière Catering$/);
  assert.match(overdue.tail, /late/);
  assert.equal(overdue.holds?.pay, 'li-1', 'Now does not hold the payment it names — Budget would repeat it');
  assert.equal(today(quiet({ schedule: { ...fixtureSchedule('before'), toApprove: 3 } })).target, 'sched');
  const quote = today(quiet({ suppliers: { booked: 2, of: 6, toDecide: [{ name: 'Bloom & Vine', vendorId: 'v' }], replied: 1 } }));
  assert.equal(quote.target, 'sup');
  assert.match(quote.words, /Bloom & Vine/);
  for (const t of [today(quiet({ asks: 1 })), overdue, quote]) assert.equal(t.calm, false);
  // The AI offer is an offer — an overdue payment outranks it.
  assert.equal(today(quiet({ budget: { paidPhp: 1, owingPhp: 1, pays: fixturePays() } }), AI).target, 'budget');
});

/*
  🎴 THE REDRAW'S ORDER (owner-approved Home redraw 2026-11-02, round 3 — supersedes this file's "the picker's own firsts
  are never pushed aside"): *"a late payment, then the oldest request waiting, then a setup step, then an overdue task"*.
  Only a read that failed outranks what waits (it is said first, never calm).
*/
test('2 · a late payment, then a request, then the picker’s setup step, then an overdue task', () => {
  const date: HomeNext = { kind: 'date', title: 'Set your wedding date', body: '', action: '' };
  const invite: HomeNext = { kind: 'invite', title: 'Send 5 invitations', body: '', action: '' };
  const unread: HomeNext = { kind: 'unread', title: 'We couldn’t read your guest list', body: '', action: '' };
  const late = { budget: { paidPhp: 1, owingPhp: 1, pays: fixturePays() } };
  assert.equal(today(quiet({ asks: 3, ...late }), date).target, 'budget', 'a late payment is not first');
  assert.equal(today(quiet({ asks: 3 }), invite).target, 'asks', 'a request does not outrank the setup step');
  assert.equal(today(quiet({}), invite).target, 'guests', 'the setup step is pushed aside by nothing');
  assert.equal(today(quiet({ asks: 3, ...late }), unread).target, 'guests', 'a failed read is not said first');
  // An overdue task — only once nothing else waits and the picker has no setup step.
  const task = { id: 't9', title: 'Book the church', dueDate: '2026-01-01', daysUntilDue: -5, tick: { kind: 'task' as const, id: 't9' } };
  const checklist = { done: 1, total: 3, open: 2, dueThisWeek: 1, next: [task] };
  const t = today(quiet({ checklist }));
  assert.equal(t.target, 'plan');
  assert.equal(t.words, 'Book the church');
  assert.equal(t.holds?.task, 't9', 'Now does not hold the task it names — To do would repeat it');
  assert.equal(today(quiet({ checklist }), invite).target, 'guests', 'an overdue task outranks the setup step');
});

test('3 · an unread widget means "nothing waits" is not known', () => {
  for (const over of [{ budget: 'unread' as const }, { suppliers: 'unread' as const }, { schedule: 'unread' as const }, { asks: 'unread' as const }]) {
    const t = today(quiet(over));
    assert.equal(t.calm, false, `${Object.keys(over)[0]} unread still reads as calm`);
    assert.doesNotMatch(t.words, /Nothing waits/);
  }
});

test('4 · calm only when nothing waits and everything was read — and the first screen asks the same', () => {
  const t = today(quiet());
  assert.equal(t.calm, true);
  assert.equal(t.words, 'Nothing waits on you');
  const screen = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', '_components', 'home-first-screen.tsx'), 'utf8'));
  assert.match(screen, /homeToday\(next, control\.guests, homeWaiting\(control\)\)/, 'the first screen’s Today ignores what waits');
  assert.match(screen, /holds=\{today\.holds\?\.task \?\? null\}/, 'the To do list repeats the task Now holds');
  const faces = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', '_components', 'home-control-faces.ts'), 'utf8'));
  assert.match(faces, /homeToday\(input\.next, input\.guests, homeWaiting\(input\)\)/, 'the tiles’ Today ignores what waits');
});
