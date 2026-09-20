/**
 * ONE ACTION UNDER THE MARK, AND ITS LABEL IS THE STATUS — arrival design
 * slice 2 (owner-approved canvas, 2026-09-20).
 *
 * The two ways this goes wrong are both here:
 *   1. it asks a guest who has already answered — the label stops being a
 *      status and becomes a nag;
 *   2. the day flips on the SERVER's clock. `new Date('2026-12-18')` is
 *      midnight UTC, which is 08:00 on the 18th in Manila — so a naive
 *      comparison turns the day-of branch on eight hours early, during the
 *      night before the wedding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveArrivalAction } from './arrival-action';
import { manilaToday } from './std-views';

const BASE = { slug: 'cale-ice', eventDate: '2026-12-18' };

test('a guest who has not answered is asked, once, in one word', () => {
  const a = resolveArrivalAction({ ...BASE, rsvpStatus: 'pending', today: '2026-09-20' });
  assert.equal(a?.label, 'RSVP');
  assert.equal(a?.kind, 'ask');
  assert.equal(a?.secondary, undefined, 'one accented control, nothing beside it');
});

test('a guest who answered is TOLD, not asked again', () => {
  const going = resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: '2026-09-20' });
  assert.equal(going?.label, 'You’re going');
  assert.equal(going?.kind, 'going');
  assert.equal(going?.secondary?.label, 'Change', 'and can still change it');
  assert.doesNotMatch(going?.label ?? '', /RSVP/, 'the label is the status, not the verb');

  const no = resolveArrivalAction({ ...BASE, rsvpStatus: 'declined', today: '2026-09-20' });
  assert.match(no?.label ?? '', /can’t make it/);
  assert.equal(no?.secondary?.label, 'Change');
});

test('"maybe" still owes an answer, and says why it is asking', () => {
  const a = resolveArrivalAction({ ...BASE, rsvpStatus: 'maybe', today: '2026-09-20' });
  assert.equal(a?.kind, 'ask');
  assert.match(a?.note ?? '', /maybe/i);
});

test('an anonymous reader gets nothing — the public page keeps its own call to action', () => {
  assert.equal(resolveArrivalAction({ ...BASE, rsvpStatus: null, today: '2026-09-20' }), null);
  assert.equal(resolveArrivalAction({ ...BASE, today: '2026-09-20' }), null);
});

test('🕐 THE DAY IS MANILA’S DAY, and the boundary is not off by eight hours', () => {
  // The night before, in Manila: still asking.
  assert.equal(resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: '2026-12-17' })?.kind, 'going');
  // The wedding day itself.
  const day = resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: '2026-12-18', hasPass: true });
  assert.equal(day?.kind, 'day-of');
  assert.equal(day?.label, 'Show your pass');
  // After.
  assert.equal(resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: '2026-12-19' })?.kind, 'after');

  // The trap, stated: at 00:30 Manila on the 18th, UTC still reads the 17th.
  const justAfterMidnightManila = new Date('2026-12-18T00:30:00+08:00');
  const utcDay = justAfterMidnightManila.toISOString().slice(0, 10);
  assert.equal(utcDay, '2026-12-17', 'precondition: UTC is a day behind at that instant');
  const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(justAfterMidnightManila);
  assert.equal(manilaDay, '2026-12-18');
  assert.equal(
    resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: manilaDay, hasPass: true })?.kind,
    'day-of',
    'Manila’s day is the one that decides',
  );
});

test('a guest with no pass is not sent to a QR that is not there', () => {
  const a = resolveArrivalAction({ ...BASE, rsvpStatus: 'attending', today: '2026-12-18', hasPass: false });
  assert.equal(a?.kind, 'day-of');
  assert.doesNotMatch(a?.label ?? '', /pass/i);
});

test('someone who declined is not handed a door pass on the day', () => {
  const a = resolveArrivalAction({ ...BASE, rsvpStatus: 'declined', today: '2026-12-18', hasPass: true });
  assert.equal(a?.kind, 'declined', 'their answer stands; no pass is offered');
});

test('the page resolves it with manilaToday(), never a bare Date', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'), 'utf8');
  const call = src.slice(src.indexOf('resolveArrivalAction({'));
  const head = call.slice(0, call.indexOf('})') + 2);
  assert.match(head, /today: manilaToday\(\)/, 'the Manila helper decides the day');
  assert.doesNotMatch(head, /new Date\(/, 'a bare Date here is the eight-hour bug');
  assert.equal(typeof manilaToday(), 'string');
  assert.match(manilaToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('it renders under the mark, and is not a second fixed bar', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'), 'utf8');
  const hero = src.lastIndexOf("plan.body === 'normal' && plan.heroShouldRender", src.indexOf('<ArrivalActionRow'));
  const row = src.indexOf('<ArrivalActionRow');
  const card = src.indexOf('<GuestHubCard');
  assert.ok(hero > 0 && row > hero, 'the action sits below the hero');
  assert.ok(row < card, 'and above the status card');

  const component = readFileSync(
    join(__dirname, '..', 'app', '[slug]', '_components', 'arrival-action.tsx'),
    'utf8',
  );
  assert.doesNotMatch(component, /fixed bottom-0/, 'GuestHubBar was retired for covering the menu');
});
