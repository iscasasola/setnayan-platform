/**
 * The FINISHED shelf splitting into "Unpublished" and "Published" (owner
 * 2026-08-20), and the end-date rule that decides when a celebration reaches
 * that shelf at all.
 *
 * What is locked here:
 *   • an UNMEASURED story read must not split the shelf — it degrades to the
 *     one shelf the board has today rather than telling somebody their written
 *     story does not exist;
 *   • a multi-day celebration is not finished on its first day;
 *   • only the organiser is offered the write action.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canWriteStoryFor,
  isFinishedEvent,
  splitFinishedByStory,
} from './event-board';
import type { EventWithRole } from './events';

function ev(over: Partial<EventWithRole> & { event_id: string }): EventWithRole {
  return {
    public_id: `S89E-${over.event_id}`,
    event_type: 'wedding',
    display_name: over.display_name ?? 'A day',
    event_date: over.event_date ?? null,
    is_primary: false,
    archived: over.archived ?? false,
    venue_name: null,
    venue_address: null,
    monogram_text: null,
    monogram_color: null,
    member_type: over.member_type ?? 'couple',
    ...over,
  } as EventWithRole;
}

test('a one-day celebration is finished the day after', () => {
  const e = ev({ event_id: 'a', event_date: '2026-08-19' });
  assert.equal(isFinishedEvent(e, '2026-08-20'), true);
  assert.equal(isFinishedEvent(ev({ event_id: 'b', event_date: '2026-08-20' }), '2026-08-20'), false);
});

test('a celebration that runs to Sunday is not finished on Saturday', () => {
  const e = ev({ event_id: 'a', event_date: '2026-08-18', event_end_date: '2026-08-23' } as never);
  assert.equal(isFinishedEvent(e, '2026-08-20'), false, 'still running');
  assert.equal(isFinishedEvent(e, '2026-08-24'), true, 'over');
});

test('an undated celebration is never finished', () => {
  assert.equal(isFinishedEvent(ev({ event_id: 'a', event_date: null }), '2026-08-20'), false);
});

test('an archived celebration is finished whatever its date', () => {
  assert.equal(
    isFinishedEvent(ev({ event_id: 'a', event_date: '2030-01-01', archived: true }), '2026-08-20'),
    true,
  );
});

test('the shelf splits on the stories this account has posted', () => {
  const finished = [ev({ event_id: 'a' }), ev({ event_id: 'b' }), ev({ event_id: 'c' })];
  const { unpublished, published, measured } = splitFinishedByStory(
    finished,
    new Set(['b']),
  );
  assert.equal(measured, true);
  assert.deepEqual(unpublished.map((e) => e.event_id), ['a', 'c']);
  assert.deepEqual(published.map((e) => e.event_id), ['b']);
});

test('AN UNMEASURED READ KEEPS ONE SHELF — it never claims nothing is written', () => {
  const finished = [ev({ event_id: 'a' }), ev({ event_id: 'b' })];
  const { unpublished, published, measured } = splitFinishedByStory(finished, null);
  assert.equal(measured, false);
  assert.equal(published.length, 0);
  assert.deepEqual(unpublished.map((e) => e.event_id), ['a', 'b']);
});

test('only the organiser is offered the write action', () => {
  assert.equal(canWriteStoryFor({ member_type: 'couple' }), true);
  assert.equal(canWriteStoryFor({ member_type: 'guest' }), false);
  assert.equal(canWriteStoryFor({ member_type: 'vendor' }), false);
});
