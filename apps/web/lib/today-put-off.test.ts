/**
 * today-put-off.test.ts — ⏭ "DO IT TOMORROW" (Today v3 part 2, owner 19 Nov 2026: *"drag it to the left do it
 * tomorrow"* · *"yes. except urgent"*).
 *
 *   1 · tomorrow is one calendar day on, across a month and a year;
 *   2 · a record holds a task off only while its day is after today — and an UNREAD set holds nothing off;
 *   3 · a red row can never go to tomorrow;
 *   4 · the drag: right past halfway opens, left past halfway is tomorrow, a red row follows a third and is refused,
 *       a short drag springs back.
 * SABOTAGE (each seen red once, 2026-11-19): `>=` for `>` in activePutOffs → 2 red · `canPutOff` true for red → 3 red ·
 * a red row's left offset not divided by 3 → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { activePutOffs, canPutOff, dragArmed, dragOffset, dragOutcome, tomorrowOf } from './today-put-off';

test('1 · tomorrow is one calendar day on', () => {
  assert.equal(tomorrowOf('2026-11-19'), '2026-11-20');
  assert.equal(tomorrowOf('2026-11-30'), '2026-12-01');
  assert.equal(tomorrowOf('2026-12-31'), '2027-01-01');
  assert.throws(() => tomorrowOf('19 Nov'));
});

test('2 · a record holds a task off only while its day is after today; unread holds nothing off', () => {
  const rows = [
    { task_key: 'rev-a', until_day: '2026-11-20' },
    { task_key: 'rev-b', until_day: '2026-11-19' },
    { task_key: 'rev-c', until_day: '2026-11-18' },
    { task_key: 'bad key!', until_day: '2026-11-25' },
  ];
  assert.deepEqual([...activePutOffs(rows, '2026-11-19')], ['rev-a'], 'a record on or before today still hides its task, or a bad key was trusted');
  assert.equal(activePutOffs(null, '2026-11-19').size, 0, 'an unread set hid a task');
});

test('3 · a red row can never go to tomorrow', () => {
  assert.equal(canPutOff('red'), false);
  assert.equal(canPutOff('amber'), true);
  assert.equal(canPutOff(null), true);
});

test('4 · the drag, both ways, at the shipped 84 px', () => {
  const R = 84;
  assert.equal(dragOffset(200, false, R), 84, 'a drag right is not capped at the action area');
  assert.equal(dragOffset(-200, false, R), -84);
  assert.equal(dragOffset(-84, true, R), -28, 'a red row dragged left follows the whole finger');
  assert.equal(dragOutcome(50, false, R), 'open');
  assert.equal(dragOutcome(50, true, R), 'open', 'a red row cannot be opened by a drag right');
  assert.equal(dragOutcome(-50, false, R), 'tomorrow');
  assert.equal(dragOutcome(dragOffset(-84, true, R), true, R), 'refused', 'a red row went to tomorrow');
  assert.equal(dragOutcome(20, false, R), 'back');
  assert.equal(dragOutcome(-20, false, R), 'back');
  assert.equal(dragArmed(-50, true, R), null, 'a red row shows Tomorrow armed');
  assert.equal(dragArmed(-50, false, R), 'tomorrow');
});
