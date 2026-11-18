/**
 * 💬 EVERY CLIENT CARD OPENS THE CHAT, AND "SEE THEIR FIRST" OPENS THE PICKED CLIENT (CHAT-15, W1 walk 16 Nov 2026).
 *
 * Measured live: the booked card (TEST W1 story 16 Nov) offered "Open their Hub" and no chat, while a pending card's door
 * IS "Open the chat"; and its "see their first · …" link went to the old full-screen `/vendor-dashboard/messages/<thread>`
 * — the split CHAT-07 closed for notices.
 *
 * SABOTAGE (seen red, then restored): the roster's chat door removed (test 1 red); the first-event link back to
 * `/vendor-dashboard/messages/${first.thread_id}` (test 2 red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { supplierChatHref } from './upcoming-schedule-door';

const src = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

test('1 · a card whose main door is not Chat also offers "Open the chat", on the picked client', () => {
  const roster = src('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  assert.match(roster, /\{door\.page !== 'chat' \? \(\s*<RememberPickedOrigin to=\{customerCardHref\(r\.eventId, 'chat'\)\}>/, 'a booked card has no chat door again');
  assert.match(roster, /label=\{DOOR_WORDS\.chat!\}[\s\S]{0,200}href=\{customerCardHref\(r\.eventId, 'chat'\)\}/);
});

test('2 · "see their first" opens that event’s picked client on Chat', () => {
  const lines = src('lib/supplier-event-lines.server.ts');
  assert.match(lines, /href: supplierChatHref\(first\.event_id, first\.thread_id\),/, 'the first-event link opens the old thread page again');
  assert.doesNotMatch(lines, /`\/vendor-dashboard\/messages\/\$\{first\.thread_id\}`/);
  assert.equal(supplierChatHref('e1', 't1'), '/vendor-dashboard/clients/e1?tab=chat');
});
