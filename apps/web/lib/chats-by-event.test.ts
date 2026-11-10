/**
 * ✉️ THE CHATS LISTS' RULES (Supplier Build 3 · Lane A, 9 Nov 2026): one row per event, unread pinned on top, then the
 * most recent. Owner, 8 Nov: *"that will just list all the events (no dupes) … the most recent conversation will be the
 * one on top. above it will be pinned messages if unread."*
 *
 * SABOTAGE (done once, 9 Nov): fold by `threadId` instead of `eventId` → test 1 RED (two rows for one event); make
 * `unread` the lead's only → test 2 RED; `archived: some(...)` → test 3 RED; sort the pinned group oldest first →
 * test 4 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldByEvent, messengerOrder } from './chats-by-event';

const t = (threadId: string, eventId: string, lastAt: string, unread = false, archived = false) => ({
  threadId,
  eventId,
  lastAt,
  unread,
  archived,
});

test('1 · one row per event — never the same event twice — newest event first', () => {
  const folds = foldByEvent([
    t('a1', 'ev-a', '2026-11-08T10:00:00Z'),
    t('b1', 'ev-b', '2026-11-08T12:00:00Z'),
    t('a2', 'ev-a', '2026-11-08T13:00:00Z'),
  ]);
  assert.deepEqual(folds.map((f) => f.lead.eventId), ['ev-a', 'ev-b']);
  assert.equal(folds[0]!.lead.threadId, 'a2', 'the event row speaks for its NEWEST thread');
  assert.deepEqual(folds[0]!.threads.map((x) => x.threadId), ['a2', 'a1']);
});

test('2 · an event is unread when ANY of its threads is', () => {
  const [f] = foldByEvent([t('a1', 'ev-a', '2026-11-08T10:00:00Z', true), t('a2', 'ev-a', '2026-11-08T13:00:00Z', false)]);
  assert.equal(f!.unread, true);
});

test('3 · an event folds into Archived only when EVERY thread is archived', () => {
  const [mixed] = foldByEvent([t('a1', 'ev-a', '2026-11-08T10:00:00Z', false, true), t('a2', 'ev-a', '2026-11-08T13:00:00Z')]);
  assert.equal(mixed!.archived, false);
  const [gone] = foldByEvent([t('a1', 'ev-a', '2026-11-08T10:00:00Z', false, true), t('a2', 'ev-a', '2026-11-08T13:00:00Z', false, true)]);
  assert.equal(gone!.archived, true);
});

test('4 · Messenger order: unread pinned on top, then the rest, each newest first as given', () => {
  const rows = [
    { id: 'newest-read', unread: false },
    { id: 'newer-unread', unread: true },
    { id: 'older-read', unread: false },
    { id: 'oldest-unread', unread: true },
  ];
  const { pinned, recent } = messengerOrder(rows);
  assert.deepEqual(pinned.map((r) => r.id), ['newer-unread', 'oldest-unread']);
  assert.deepEqual(recent.map((r) => r.id), ['newest-read', 'older-read']);
});

test('5 · an unreadable time sorts last, never throws', () => {
  const folds = foldByEvent([t('x', 'ev-x', 'not a date'), t('y', 'ev-y', '2026-11-08T10:00:00Z')]);
  assert.deepEqual(folds.map((f) => f.lead.eventId), ['ev-y', 'ev-x']);
});
