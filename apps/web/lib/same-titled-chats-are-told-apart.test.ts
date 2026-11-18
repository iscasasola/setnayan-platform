/**
 * 🔎 TWO SUPPLIER CHAT ROWS WITH ONE TITLE SAY WHAT TELLS THEM APART (CHAT-11, W1 walk 16 Nov 2026).
 *
 * Measured live: five rows of one supplier's Chats read "TEST's Birthday (date not set)" — one customer, five undated
 * birthdays, whose own names ("TEST W1 fee walk", "… 2", "… 3") differed. The title stays the owner's chat words; the
 * row's event line (the shipped slot, `InboxRow.eventLine`) carries the event's own name, else its city.
 *
 * SABOTAGE (seen red, then restored): the page's `eventLine: tellApart.get(r.eventId) ?? ''` back to `eventLine: ''`
 * (test 2 red); `chatRowTellApart` saying the own name even when it repeats in the group (test 1 red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chatRowTellApart, eventChatTitle } from './event-chat-title';
import { stripComments } from './strip-comments';

const NOW = Date.parse('2026-11-16T04:00:00Z');
const row = (key: string, ownName: string | null, city: string | null = null) => ({
  key,
  ownName,
  city,
  title: eventChatTitle({ name: ownName, kind: 'Birthday', date: null, nowMs: NOW }),
});

test('1 · same title → the word that differs; a unique title or a repeated word → nothing', () => {
  const live = [row('a', 'TEST W1 fee walk'), row('b', 'TEST W1 fee walk 2'), row('c', 'TEST W1 fee walk 3')];
  assert.ok(live.every((r) => r.title === "TEST's Birthday (date not set)"), 'the fixture no longer reproduces the walk');
  const lines = chatRowTellApart(live);
  assert.deepEqual([...lines.entries()], [
    ['a', 'TEST W1 fee walk'],
    ['b', 'TEST W1 fee walk 2'],
    ['c', 'TEST W1 fee walk 3'],
  ]);
  // A title nobody else has keeps its single line (390: a second one cut the title's date).
  assert.equal(chatRowTellApart([row('a', 'Ana & Miguel'), row('b', 'TEST x')]).size, 0);
  // The same own name on both → the city, when it differs.
  assert.deepEqual([...chatRowTellApart([row('a', 'TEST', 'Makati'), row('b', 'TEST', 'Pasig')]).entries()], [
    ['a', 'Makati'],
    ['b', 'Pasig'],
  ]);
  // Nothing differs → nothing said (a line that repeats on every row tells nothing apart).
  assert.equal(chatRowTellApart([row('a', 'TEST', 'Makati'), row('b', 'TEST', 'Makati')]).size, 0);
});

test('2 · the supplier Chats page puts it on the row’s event line', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', 'vendor-dashboard', 'messages', 'page.tsx'), 'utf8'));
  assert.match(src, /const tellApart = chatRowTellApart\(/);
  assert.match(src, /title: titleOf\(r\), ownName: facts\?\.displayName, city: facts\?\.city/);
  assert.match(src, /eventLine: tellApart\.get\(r\.eventId\) \?\? '',/, 'the row no longer says what tells it apart');
  assert.match(src, /const name = titleOf\(r\);/, 'the row title is no longer the one chat title');
});
